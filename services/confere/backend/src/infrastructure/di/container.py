"""T-42 — Container de injeção de dependências.

IoC manual, no padrão do TRIADE: sem biblioteca, com cache de singletons e uma
factory única. É o lugar onde a aplicação conhece as implementações concretas
dos ports — em nenhum outro ponto do código elas aparecem juntas.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, TypeVar

from application.use_cases.generate_measurement_report import (
    GenerateMeasurementReport,
    ReportResult,
)
from domain.entities.contract import Contract
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from infrastructure.annex.anexo_reader import AnexoReader
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.measurement.levantamento_reader import LevantamentoReader
from infrastructure.report.docx_renderer import DocxRenderer
from infrastructure.report.xlsx_analise_renderer import XlsxAnaliseRenderer
from infrastructure.validations.annex_validations import (
    v_anx_01_nenhuma_aba_de_anexo_reconhecida,
    v_anx_02_cabecalho_nao_localizado,
)
from infrastructure.validations.contract_validations import (
    v_adt_01_peca_sem_itens,
    v_adt_02_aditivo_sem_efeito,
    v_adt_03_peca_repetida_ou_trocada,
    v_adt_04_movimento_de_codigo_ausente,
    v_cap_01_cliente_nao_derivado,
    v_ctr_01_tabela_localizada,
    v_ctr_03_checksum,
    v_ctr_05_codigo_contratado_ausente_da_aba,
    v_ctr_06_cauda_sem_linha_anterior,
    v_ctr_07_periodo_nao_numerico,
    v_ctr_08_ordem_alternativa_de_colunas,
    v_doc_01_peca_nao_e_proposta,
)
from infrastructure.validations.identity_validations import (
    v_idt_01_levantamento_de_outro_orgao,
    v_idt_02_numero_de_contrato_divergente,
    v_idt_03_peca_de_outro_contrato,
)
from infrastructure.validations.measurement_validations import (
    v_med_01_aba_reconhecida,
    v_med_02_cabecalho_localizado,
    v_med_03_desconto_por_posicao,
    v_med_04_apuracao_sem_par,
)
from infrastructure.validations.reconciliation_validations import (
    v_rec_01_divergencia_de_quantidade_contratada,
)


@dataclass(frozen=True)
class Entradas:
    contrato: Path
    levantamento: Path
    # T-1909 / ESPEC 025 `R-DOC-06` — o nome com que o arquivo foi submetido.
    #
    # **Só para exibição.** O caminho em disco continua posicional
    # (`contrato.pdf`, `aditivo-1.pdf`) porque dois aditivos homônimos se
    # sobrescreveriam, e essa razão não mudou (`R-ADT-10`). O que mudou é que a
    # tela precisa dizer *qual arquivo* não serve, e a peça nem sempre tem
    # identificação interna: o relatório GRC não traz `Proposta de Aditivo:`.
    #
    # Padrão vazio: dezenas de testes constroem `Entradas` com dois campos, e a
    # mensagem cai para a identificação de sempre quando o nome não vem.
    nome_do_contrato: str = ""
    # ESPEC 027 `R-LEV-09` — o mesmo para o levantamento, pela mesma razão:
    # `V-MED-01` precisa dizer qual arquivo enviar, e o caminho em disco
    # continua posicional (`levantamento.xlsx`).
    nome_do_levantamento: str = ""
    # T-2095 / ESPEC 029 `R-IDT-10` — a resposta de quem confere ao portão.
    #
    # **Padrão `False`, e é o que faz a ausência não confirmar nada**: quem chama
    # a API sem o campo recebe o portão, não o documento. Decide **a severidade
    # do achado**, nunca a sua existência — confirmado, ele desce a aviso e
    # permanece na lista (`R-IDT-11`).
    identidade_confirmada: bool = False
    # ESPEC 019 `R-ADT-10` — zero ou mais aditivos. O padrão vazio é o caminho de
    # hoje, bit a bit: é o que o piloto exercita, e é o que mantém `R-REL-10`
    # (*"dois arquivos"*) valendo para quem não tem aditivo.
    aditivos: tuple[Path, ...] = ()


T = TypeVar("T")


class DIContainer:
    def __init__(self) -> None:
        self._singletons: dict[str, Any] = {}

    def _obter(self, nome: str, fabrica: Callable[[], T]) -> T:
        if nome not in self._singletons:
            self._singletons[nome] = fabrica()
        instancia: T = self._singletons[nome]
        return instancia

    def extrator_de_contrato(self) -> PdfPlumberContractExtractor:
        return self._obter("contrato", PdfPlumberContractExtractor)

    def leitor_de_medicao(self) -> LevantamentoReader:
        return self._obter("medicao", LevantamentoReader)

    def leitor_de_anexos(self) -> AnexoReader:
        return self._obter("anexos", AnexoReader)

    def renderizador(self) -> DocxRenderer:
        return self._obter("renderer", DocxRenderer)

    def renderizador_de_analise(self) -> XlsxAnaliseRenderer:
        """ESPEC 009 — o segundo entregável, e o segundo formato de saída."""
        return self._obter("renderer_analise", XlsxAnaliseRenderer)

    def caso_de_uso(self) -> GenerateMeasurementReport:
        return self._obter("caso_de_uso", GenerateMeasurementReport)

    # ── O portão de entrada (ESPEC 029) ──────────────────────────────────────

    def conferir_identidade(self, entradas: Entradas) -> ConferenciaDeIdentidade:
        """ESPEC 029 `R-IDT-10` — os arquivos são do mesmo contrato?

        Caminho **separado** de `gerar`, e barato: nenhuma tabela de itens é
        extraída, nenhuma aba é percorrida. Ver `_conferir_identidade_das_fontes`.
        """
        return _conferir_identidade_das_fontes(self, entradas)

    # ── Fluxo completo ────────────────────────────────────────────────────────

    def gerar(self, entradas: Entradas) -> ReportResult:
        """Lê as três fontes, valida e monta o relatório em memória.

        A ordem importa: as validações bloqueantes das fontes rodam **antes** da
        reconciliação, para que um contrato mal extraído nunca chegue a produzir
        linhas.
        """
        achados = ValidationReport()

        extrator = self.extrator_de_contrato()
        proposta = extrator.extrair(entradas.contrato)
        aditivos = [extrator.extrair(caminho) for caminho in entradas.aditivos]
        medicao = self.leitor_de_medicao().ler(entradas.levantamento)

        # ESPEC 019 §8 — as peças são conferidas **uma a uma, antes** de
        # consolidar, e os achados saem agrupados por peça: quem submeteu quatro
        # arquivos precisa saber qual deles não serve.
        #
        # `R-ADT-09` — o checksum vale por peça, sobre **todos** os blocos dela,
        # inclusive os que a consolidação vai descartar. É a prova de ponta a
        # ponta da extração, e continua bloqueando pelo motivo da ESPEC 018: uma
        # peça lida pela metade reordenaria o documento em silêncio e mandaria
        # itens legítimos para o bloco final.
        #
        # A guarda `if .itens` vive aqui, e não dentro das validações, para que
        # elas não precisem saber em que ordem são chamadas (`R-GRD-06`, `D-06`).
        #
        # `R-REL-13` — a `V-CTR-04` continua **não** sendo registrada: depois da
        # ESPEC 017 ela dispara para todo contrato que não seja o piloto, e a
        # medição segue no `DiagnosticoDaGrade`, que é onde o suporte olha.
        # T-1923 / ESPEC 025 `R-DOC-03` — **`V-DOC-01` antes**, e as duas nunca
        # na mesma peça: descrevem o mesmo silêncio por motivos diferentes, e se
        # ambas registrassem esta entrega teria trocado três mensagens por duas.
        # A exclusão mútua vive nos predicados das próprias validações — é o que
        # as mantém chamáveis fora de ordem (`R-GRD-06`).
        v_doc_01_peca_nao_e_proposta(
            proposta, "Contrato", achados, entradas.nome_do_contrato
        )
        v_adt_01_peca_sem_itens(
            proposta, "Contrato", achados, entradas.nome_do_contrato
        )
        if proposta.itens:
            v_ctr_03_checksum(proposta, achados)
            # T-2182 / ESPEC 032 `R-CON-05` — **por peça, ao lado do checksum**, e
            # não sobre o consolidado: as caudas órfãs viajam no `diagnostico`, e
            # `Contract.aplicar` propaga o da proposta, perdendo o dos aditivos.
            v_ctr_06_cauda_sem_linha_anterior(proposta, achados)
            # T-2622 / ESPEC 040 `R-MES-04` — mesma guarda de `v_ctr_06`, pelo
            # mesmo motivo: por peça, ao lado do checksum.
            v_ctr_07_periodo_nao_numerico(proposta, achados)
            # T-2685 / ESPEC 045 `R-COL-07` — mesma guarda, mesmo motivo.
            v_ctr_08_ordem_alternativa_de_colunas(proposta, achados)
            # T-1912 / ESPEC 025 `R-DOC-07` — **sob a guarda**, e não ao lado
            # dela.
            #
            # ESPEC 020 — o cliente da capa sai da **proposta**, e é dela que se
            # cobra: o aditivo não traz a frase, e não deveria trazer.
            #
            # Peça sem itens não tem capa a identificar: o relatório não sai. A
            # frase *"a capa identificará o cliente pelo título do levantamento"*
            # prometia, na tela de bloqueio, um documento que não seria emitido —
            # consequência da mesma extração que já foi acusada, e é o que a
            # `R-GRD-06` proíbe desde os 57 achados do `PA-PGM`.
            #
            # Fora do bloqueio nada muda: proposta legítima sem cliente derivado
            # continua avisando, e a `T-1425` é quem guarda isso.
            v_cap_01_cliente_nao_derivado(proposta, achados)

        for indice, aditivo in enumerate(aditivos, start=1):
            papel = f"{indice}º aditivo"
            v_doc_01_peca_nao_e_proposta(aditivo, papel, achados)
            v_adt_01_peca_sem_itens(aditivo, papel, achados)
            if aditivo.itens:
                v_ctr_03_checksum(aditivo, achados)
                v_ctr_06_cauda_sem_linha_anterior(aditivo, achados)
                v_ctr_07_periodo_nao_numerico(aditivo, achados)
                v_ctr_08_ordem_alternativa_de_colunas(aditivo, achados)
                v_adt_02_aditivo_sem_efeito(aditivo, achados)
                # T-2091 / ESPEC 029 `R-IDT-08` — **antes de `aplicar`**, que
                # vem seis linhas abaixo. Depois dela os itens já estão somados
                # e a peça de origem não é mais distinguível: o aditivo de outro
                # contrato entraria no escopo em silêncio, e é o que a `T-2079`
                # guarda com a sua segunda asserção.
                v_idt_03_peca_de_outro_contrato(
                    proposta,
                    aditivo,
                    papel,
                    achados,
                    identidade_confirmada=entradas.identidade_confirmada,
                )

        v_adt_03_peca_repetida_ou_trocada(proposta, aditivos, achados)

        # `R-ADT-02` a `R-ADT-07` — só `Inclusão` e `Exclusão` são aplicadas.
        # Daqui para baixo o resto do fluxo não sabe de quantas peças o contrato
        # veio, e é o que manteve `GenerateMeasurementReport` intocado.
        #
        # **`V-CTR-03` não roda no consolidado** (`R-ADT-09`, `D-07`): ele mistura
        # um escopo com deltas, e a soma dos totais das suas linhas não
        # corresponde a número de documento nenhum. Conferir ali daria bloqueio
        # permanente e falso. `V-ADT-01` é o que cobre o buraco que sobra.
        contrato = proposta.aplicar(aditivos)
        v_adt_04_movimento_de_codigo_ausente(contrato, aditivos, achados)

        # T-1911 / ESPEC 025 `R-DOC-07` — a `V-CTR-01` fala do **consolidado**, e
        # um consolidado vazio porque uma peça veio vazia é consequência, não
        # causa: `V-ADT-01` já acusou a peça, pelo nome. Duas mensagens para o
        # mesmo fato treinam o olho a pular o bloco (`R-REL-13`).
        #
        # A guarda vive aqui, e não dentro da validação, para que ela não precise
        # saber em que ordem é chamada (`R-GRD-06`, ESPEC 019 `D-06`) — e o texto
        # da `V-CTR-01` continua o de sempre, que é o que a `T-1121` mede.
        if all(peca.itens for peca in (proposta, *aditivos)):
            v_ctr_01_tabela_localizada(contrato, achados)
        v_med_01_aba_reconhecida(medicao, achados, entradas.nome_do_levantamento)
        # ESPEC 027 `R-LEV-01` — sem item lido, as três abaixo descrevem a
        # **mesma** falha por outros ângulos: o cabeçalho sai das mesmas
        # linhas de onde os itens não saíram, e `contrato.codigos - ∅` é o
        # contrato inteiro. Sessenta cartões para uma causa (ESPEC 027 §2.1).
        #
        # A guarda vive aqui, e não dentro das validações, para que elas não
        # precisem saber em que ordem são chamadas (`R-GRD-06`) — é a mesma
        # forma da guarda de `v_ctr_01`, sete linhas acima.
        #
        # `R-LEV-03` — é por **peça**, não por gravidade: a condição é
        # `medicao.itens`, nunca `achados.bloqueado`. Um contrato bloqueado por
        # checksum não invalida a observação de que a aba não traz um código
        # contratado — suprimir por `achados.bloqueado` apagaria essa
        # observação sem quebrar teste nenhum.
        if medicao.itens:
            v_med_02_cabecalho_localizado(medicao, achados)
            v_med_03_desconto_por_posicao(medicao, achados)
            # T-2153 / ESPEC 031 `R-APU-05` — ao lado da `V-MED-03`, e é o lugar
            # certo: as duas guardam a mesma regra por ângulos opostos. A
            # `V-MED-03` acusa o código repetido **sem** marca em bloco nenhum; a
            # `V-MED-04`, o bloco **com** marca que não achou o seu par. Entre as
            # duas, nenhuma forma de a regra do desconto ficar inerte passa calada.
            v_med_04_apuracao_sem_par(medicao, achados)
            # T-2091 / ESPEC 029 — **dentro desta guarda**, e não ao lado dela.
            #
            # A identidade da aba sai do mesmo cabeçalho de onde os itens não
            # saíram: acusar *"o levantamento é de outro contrato"* sobre uma
            # planilha que o leitor não reconheceu seria descrever consequência
            # como causa, que é o que `R-GRD-06` proíbe desde os 57 achados do
            # `PA-PGM`. A `T-2080` guarda esta linha.
            #
            # **Sobre o consolidado**, como a `V-CTR-05` logo acima: é ele que
            # carrega a identidade da proposta (`R-IDT-09`), e é dele que o
            # documento sai.
            v_idt_01_levantamento_de_outro_orgao(
                contrato,
                medicao,
                achados,
                entradas.nome_do_levantamento,
                identidade_confirmada=entradas.identidade_confirmada,
            )
            v_idt_02_numero_de_contrato_divergente(
                contrato,
                medicao,
                achados,
                identidade_confirmada=entradas.identidade_confirmada,
            )
            # T-2111 / ESPEC 029 `D-07` — **a `V-CTR-05` vem depois, e só se o
            # par não estiver sob pergunta.**
            #
            # `contrato.codigos - medicao.codigos` entre dois instrumentos
            # diferentes não descobre nada: é aritmética de conjuntos alheios, e
            # foi ela que produziu os **dezenove** cartões que a §1 desta espec
            # abriu denunciando. Emiti-los ao lado da pergunta que os explica
            # seria trocar dezenove mensagens por vinte.
            #
            # A guarda é sobre **o par estar em questão**, não sobre gravidade
            # (`R-LEV-03`): confirmado o envio, a divergência passa a ser
            # deliberada, os códigos ausentes voltam a ser observação legítima —
            # e a `V-CTR-05` volta com eles.
            if not _sob_pergunta_de_identidade(achados):
                v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)
        # T-1615 / ESPEC 022 `R-QTD-06` — sem `explicados`. O contrato que chega
        # aqui é o consolidado **com** os deltas, e a validação volta a comparar:
        # cala quando os números batem, acusa quando não batem. A `D-08` da ESPEC
        # 019 calava por lista de códigos, e naqueles códigos nada era conferido.
        #
        # T-1713 / ESPEC 023 `R-FON-04` — os deltas por código, para *descrever* a
        # divergência, nunca para decidi-la. É o segundo consumidor de
        # `codigos_ignorados()`, e confirma a decisão da T-1617 de mantê-la viva.
        divergencias = v_rec_01_divergencia_de_quantidade_contratada(
            contrato, medicao, achados, deltas=_deltas_por_codigo(aditivos)
        )

        # Os anexos são lidos **por último e só se o relatório vai existir**.
        # São 25 mil células e cerca de 20 s; pagá-los para depois devolver 422
        # seria fazer o usuário esperar por uma resposta que já estava decidida.
        anexos = [] if achados.bloqueado else self.leitor_de_anexos().ler(entradas.levantamento)
        # T-2306 / ESPEC 036 `V-ANX-01` — o sinal que a omissão da página tirou
        # do documento.
        #
        # Até a ESPEC 036, uma planilha que nomeasse as abas de outro jeito
        # produzia dezenove páginas dizendo que não havia conteúdo. Feias, mas
        # eram o **único** aviso de que o arquivo inteiro podia estar errado.
        # Omitidas as páginas, o aviso passa a sair aqui — uma vez, e não
        # dezenove (`R-GRD-06`).
        #
        # Depois do teste de `bloqueado`, e sem alterá-lo: `AVISA` não entra em
        # `ValidationReport.bloqueado`, e com o relatório bloqueado `anexos` é
        # `[]`, caso em que a validação cala por não haver leitura que julgar.
        v_anx_01_nenhuma_aba_de_anexo_reconhecida(anexos, achados)
        # T-2338 / ESPEC 037 `V-ANX-02` — o cabeçalho que a âncora não achou.
        #
        # Ao lado da `V-ANX-01` e pelo mesmo motivo: sem o achado, a correção da
        # 037 troca um defeito ruidoso — uma linha de dados repetida no topo de
        # cada página — por um mudo: o anexo sai sem repetição e nada denuncia.
        v_anx_02_cabecalho_nao_localizado(anexos, achados)

        return self.caso_de_uso().executar(
            contrato, medicao, achados, anexos=anexos, divergencias=tuple(divergencias)
        )


@dataclass(frozen=True)
class ConferenciaDeIdentidade:
    """ESPEC 029 `R-IDT-10` — o que o portão apurou.

    As duas identidades vão junto dos achados porque a tela mostra os dois lados
    lado a lado, e derivá-las de novo lá seria uma segunda leitura do mesmo dado.
    Texto e não objeto de valor: é o que o documento escreveu, e é o que a pessoa
    vai procurar no arquivo.
    """

    achados: ValidationReport
    contrato: str = ""
    levantamento: str = ""

    @property
    def combinam(self) -> bool:
        """Inclui o caso em que um dos lados não declara nada (`R-IDT-06`)."""
        return not self.achados.achados


def _sob_pergunta_de_identidade(achados: ValidationReport) -> bool:
    """ESPEC 029 `D-07` — este par ainda está esperando uma resposta?

    Predicado nomeado, e não um `if` sobre `achados.confirmaveis` no meio do
    fluxo: o que ele afirma — *o par está em questão* — é um fato sobre os
    arquivos, e é sobre fatos que `R-GRD-06` manda guardar. Que hoje esse fato
    se leia na severidade é detalhe de representação.
    """
    return bool(achados.confirmaveis)


def _conferir_identidade_das_fontes(
    container: DIContainer, entradas: Entradas
) -> ConferenciaDeIdentidade:
    """T-2097 / ESPEC 029 `R-IDT-10` — o portão, em 0,65 s.

    Lê **só** a primeira página de cada peça e o cabeçalho da aba, e roda as
    **mesmas três validações** do fluxo completo. Rodar as mesmas, e não uma
    comparação própria, é o que garante que a pergunta do portão e o achado do
    relatório digam a mesma frase — uma segunda redação seria a primeira porta
    para as duas divergirem.

    `identidade_confirmada` **não é passado**: aqui a pergunta está sendo feita,
    e ainda não há resposta.
    """
    achados = ValidationReport()

    extrator = container.extrator_de_contrato()
    proposta = extrator.identificar(entradas.contrato)
    medicao = container.leitor_de_medicao().identificar(entradas.levantamento)

    v_idt_01_levantamento_de_outro_orgao(
        proposta, medicao, achados, entradas.nome_do_levantamento
    )
    v_idt_02_numero_de_contrato_divergente(proposta, medicao, achados)

    # `I-05` — os aditivos entram. Custam 0,31 s cada, e deixá-los de fora
    # criaria a única divergência que só apareceria depois dos 30 s — que é
    # exatamente o que `D-10` existe para evitar.
    for indice, caminho in enumerate(entradas.aditivos, start=1):
        v_idt_03_peca_de_outro_contrato(
            proposta, extrator.identificar(caminho), f"{indice}º aditivo", achados
        )

    return ConferenciaDeIdentidade(
        achados=achados,
        contrato=str(proposta.identidade) if proposta.identidade else "",
        levantamento=medicao.contrato_referencia,
    )


def _deltas_por_codigo(aditivos: Sequence[Contract]) -> dict[str, Decimal]:
    """T-1713 — quanto cada aditivo somou a cada código.

    Percorre os blocos `Aumento` e `Redução` das peças submetidas, na ordem de
    submissão, **acumulando**: duas peças podem tocar o mesmo código, e o que
    interessa a `R-FON-04` é o total que entrou no consolidado.

    Só descreve. O que decide se um código diverge é `Contract.quantidade_para`,
    que já soma esses mesmos itens — este mapa é a mesma informação vista por
    outro ângulo, para a tela poder mostrar `proposta + aditivo` em vez de um
    total que o leitor teria de aceitar.
    """
    deltas: dict[str, Decimal] = {}
    for aditivo in aditivos:
        for rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO):
            for bloco in aditivo.blocos_com(rotulo):
                for item in bloco.itens:
                    codigo = item.codigo.valor
                    deltas[codigo] = deltas.get(codigo, Decimal(0)) + item.quantidade
    return deltas


_container: DIContainer | None = None


def get_container() -> DIContainer:
    global _container
    if _container is None:
        _container = DIContainer()
    return _container
