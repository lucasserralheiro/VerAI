"""T-1221 a T-1243 — Montagem do relatório a partir das duas fontes.

**O universo é a aba `Levantamento`; a ordem é a do contrato** (ESPEC 018
`R-REL-01` e `R-REL-03`). Era o catálogo quem iterava, e por isso um item
medido sem entrada de catálogo nunca virava linha: não era comparado, não era
somado, não aparecia. A aba **contém** o contrato nos dois pares reais, então
sair dela não perde item contratado nenhum e ganha os que só ela conhece.

Orquestra pelos ports; não conhece PDF, XLSX nem framework.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from domain.entities.annex import Anexo
from domain.entities.contract import Contract
from domain.entities.measurement import Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.entities.report import (
    DivergenciaDeFonte,
    LinhaDerivada,
    LinhaZerada,
    Report,
    ReportLine,
)
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.quantity import Quantity
from domain.value_objects.service_code import ServiceCode

# Usado apenas quando a planilha não trouxer o título na primeira linha.
TITULO_PADRAO = "LEVANTAMENTO - COMPROVAÇÃO {contrato} - CATÁLOGO DE SERVIÇOS DIT"

# Itens de perfil ou pacote entram sempre como 1 e 1 (ESPEC 001 R-REC-04).
UNIDADE = Decimal("1")

# `R-REL-06` / `D-02` — o que a aba `Levantamento` traz e a comprovação não
# cobra: horas de especialista/analista e consultoria de BI são faturadas por
# outro instrumento. Aparecem na aba com medida 0, e as duas planilhas reais as
# agrupam sob a faixa `A - SISTEMAS DE INFORMAÇÃO`.
#
# É a **única** exclusão do documento, e a única regra desta camada que não sai
# dos arquivos submetidos. Fica em constante nomeada, e não em cadastro, porque
# não varia por contrato: `10.050` é família do Catálogo de Serviços DIT.
#
# Fora do **documento**, dentro da **comparação**: continuam validadas, e contam
# para o grid e para a análise.
FAMILIAS_FORA_DO_DOCUMENTO = frozenset({"10.050"})


def _fora_do_documento(codigo: str) -> bool:
    return any(codigo.startswith(f"{familia}.") for familia in FAMILIAS_FORA_DO_DOCUMENTO)


@dataclass(frozen=True)
class ReportResult:
    relatorio: Report | None
    achados: ValidationReport
    # T-1510 / ESPEC 021 — as linhas que saíram `1 / 1` por derivação, na ordem
    # da aba. **Por último e com padrão**: o caminho bloqueado devolve
    # `relatorio=None` antes do laço que as acumula, e sem o padrão aquele
    # retorno deixaria de compilar.
    derivadas: tuple[LinhaDerivada, ...] = ()
    # T-1714 / ESPEC 023 — as divergências de contratado, já ordenadas por
    # `R-FON-06`. **Por último e com padrão**, pelo mesmo motivo de `derivadas`:
    # o caminho bloqueado devolve `relatorio=None` antes de qualquer laço.
    #
    # Vêm prontas da validação (`I-29`), e não são montadas aqui: a comparação é
    # a `V-REC-01`, e reconstruí-la no caso de uso a poria em dois lugares.
    divergencias: tuple[DivergenciaDeFonte, ...] = ()
    # T-2151 / ESPEC 031 `R-APU-08` — as linhas que saíram `0` porque a apuração
    # descontada da seção não as lista. **Por último e com padrão**, pelo mesmo
    # motivo de `derivadas` e `divergencias`: o caminho bloqueado devolve
    # `relatorio=None` antes do laço que as acumula.
    zeradas: tuple[LinhaZerada, ...] = ()

    @property
    def bloqueado(self) -> bool:
        return self.achados.bloqueado


class GenerateMeasurementReport:
    def executar(
        self,
        contrato: Contract,
        medicao: Measurement,
        achados: ValidationReport,
        titulo: str | None = None,
        anexos: list[Anexo] | None = None,
        divergencias: tuple[DivergenciaDeFonte, ...] = (),
    ) -> ReportResult:
        if achados.bloqueado:
            return ReportResult(relatorio=None, achados=achados)

        relatorio = Report(
            titulo=titulo
            or medicao.titulo
            or TITULO_PADRAO.format(contrato=medicao.contrato_referencia or "").strip(),
            data_levantamento=medicao.data_levantamento,
            contrato_referencia=medicao.contrato_referencia,
            # `R-ADT-11` — todas as peças, e não só a primeira: o quantitativo
            # pode vir de uma proposta mais os seus aditivos.
            proposta_origem=contrato.identificacao,
            propostas=contrato.propostas,
            # ESPEC 020 `R-CAP-04` — o órgão que a capa nomeia.
            cliente=contrato.cliente,
            # ESPEC 004 — o detalhamento entra no agregado sem passar pela
            # reconciliação: as abas não são itens de serviço (`R-ANX-05`).
            anexos=list(anexos or []),
        )

        # `R-REL-03` — o contrato dá a **posição**; a aba dá o conteúdo. Quem
        # ele não conhece cai no bloco final, na ordem da aba (`D-06`).
        ordenadas: list[tuple[int, ReportLine]] = []
        # `R-PER-05` — acumulador na ordem em que o laço passa, que é a **ordem
        # da aba**: `codigos_em_ordem` vem dela, e a ordenação por posição no
        # contrato acontece depois, só sobre `relatorio.linhas`. Nenhum `sorted`
        # aqui — ele produziria a mesma sequência nos dois pares medidos e
        # esconderia a dependência até o dia em que ela deixasse de valer.
        derivadas: list[LinhaDerivada] = []
        zeradas: list[LinhaZerada] = []
        for codigo in medicao.codigos_em_ordem:
            if _fora_do_documento(codigo):
                continue

            item = medicao.item_para(codigo)
            if item is None:  # pragma: no cover — o código veio da própria aba
                continue

            linha = self._montar_linha(item, medicao, contrato, achados, derivadas, zeradas)
            posicao = contrato.posicao_de(codigo)
            if posicao is None:
                relatorio.demais_itens.append(linha)
            else:
                ordenadas.append((posicao, linha))

        relatorio.linhas = [linha for _, linha in sorted(ordenadas, key=lambda par: par[0])]
        return ReportResult(
            relatorio=relatorio,
            achados=achados,
            derivadas=tuple(derivadas),
            divergencias=divergencias,
            zeradas=tuple(zeradas),
        )

    # ── Montagem de uma linha ─────────────────────────────────────────────────

    def _montar_linha(
        self,
        item: MeasurementItem,
        medicao: Measurement,
        contrato: Contract,
        achados: ValidationReport,
        derivadas: list[LinhaDerivada],
        zeradas: list[LinhaZerada],
    ) -> ReportLine:
        codigo = item.codigo.valor

        # `R-APU-03` — **antes do ramo de perfil ou pacote, e é decisão.**
        #
        # A apuração descontada da seção restabelece a seção inteira: código que
        # ela omite mediu zero depois do desconto. `omitido_da_apuracao_descontada`
        # já traz a guarda de medida numérica (`R-APU-07`), e é por isso que ela
        # não se repete aqui — repetida em dois lugares, divergiria no dia em que
        # um deles mudasse. Sem a guarda, um item de `PACOTE` ausente da apuração
        # sairia `0` em vez de `1 / 1`, e **nenhum arquivo real acusaria**.
        #
        # A linha sai `0` e o `LinhaZerada` guarda o que a célula trazia. Com a
        # contratada também zerada — que é o caso dos dois códigos reais — a
        # `R-ZER-01` da ESPEC 028 a tira do bloco final do `.docx`, e o dado
        # continua no `Report`, na análise e na API (`R-ZER-05`).
        if (omitido := medicao.omitido_da_apuracao_descontada(codigo)) is not None:
            contratada_do_codigo = medicao.contratada_para(codigo)
            emitida = ReportLine(
                codigo=ServiceCode(codigo),
                descricao=self._descricao(item, contrato),
                unidade=self._unidade(item, contrato),
                contratada=Quantity(
                    contratada_do_codigo if contratada_do_codigo is not None else Decimal(0)
                ),
                medida=Quantity(Decimal(0)),
                contratada_declarada=contratada_do_codigo is not None,
            )
            zeradas.append(
                LinhaZerada(
                    linha_na_aba=omitido.linha,
                    codigo=codigo,
                    # A descrição **da aba** (`R-PER-03`): esta tabela existe
                    # para levar alguém até a célula, não ao contrato.
                    descricao=omitido.descricao,
                    bloco_bruto=omitido.bloco_titulo,
                    bloco_descontado=medicao.apuracao_descontada_de(omitido.bloco_titulo) or "",
                    # **O texto da célula, intacto** — a `R-PER-02`. Pôr aqui o
                    # `0` emitido repetiria na tela o apagamento que este
                    # registro existe para desfazer.
                    medida_texto=omitido.medida_texto,
                    emitida=emitida,
                )
            )
            return emitida

        # `R-REL-08` — medida não numérica é perfil ou pacote, e sai `1 / 1`.
        # A marcação deixou de ser dado de catálogo e passou a ser leitura da
        # aba: a correspondência é exata no piloto, nos dois sentidos, e alcança
        # no PGM cinco códigos que o catálogo do SMIT desconhecia.
        if item.medida is None:
            emitida = ReportLine(
                codigo=ServiceCode(codigo),
                descricao=self._descricao(item, contrato),
                unidade=self._unidade(item, contrato),
                contratada=Quantity(UNIDADE),
                medida=Quantity(UNIDADE),
                perfil_ou_pacote=True,
            )
            # T-1509 / ESPEC 021 — o registro que torna a inferência visível.
            #
            # **`item.descricao`, e não `self._descricao(...)`** — a linha acima
            # usa a designação contratual, que é o que o documento leva ao órgão
            # (`R-REL-07`). Aqui vale a da aba (`D-01`): esta tabela existe para
            # levar alguém até a célula, e a descrição contratual do
            # `14.048.00008.00` **termina na palavra `PERFIL`**, cortada antes da
            # letra, justamente no item cujo perfil contratado difere do medido.
            derivadas.append(
                LinhaDerivada(
                    linha_na_aba=item.linha,
                    codigo=codigo,
                    descricao=item.descricao,
                    contratada_texto=item.contratada_texto,
                    medida_texto=item.medida_texto,
                    emitida=emitida,
                )
            )
            return emitida

        # `contratada_para` e não `item.contratada`: a variante que desconta
        # desenvolvimento traz a coluna vazia, e o total contratado está na
        # ocorrência primária do código.
        contratada = medicao.contratada_para(codigo)
        return ReportLine(
            codigo=ServiceCode(codigo),
            descricao=self._descricao(item, contrato),
            unidade=self._unidade(item, contrato),
            # `R-REL-04` / `D-05` — **as duas quantidades vêm da aba**. A
            # `R-CTR-01`, que mandava usar a do contrato, fica revogada; a
            # `V-REC-01` continua expondo quando as fontes divergem.
            contratada=Quantity(contratada if contratada is not None else Decimal(0)),
            medida=Quantity(item.medida),
            contratada_declarada=contratada is not None,
        )

    def _descricao(self, item: MeasurementItem, contrato: Contract) -> str:
        """`R-REL-07` / `D-08` — a designação **contratual**, onde ela existir.

        As duas fontes falam línguas diferentes: o contrato diz `SOLUÇÃO DE
        ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS`, a aba diz `MPLS - 8 Mbps`.
        São 34 descrições realmente diferentes em 57 no piloto.

        Decide o caso o `14.024.00005.00`, cuja descrição na aba carrega
        `- DESCONTANDO RECURSOS DE DESENVOLVIMENTO`: a aba traz a **metodologia
        de apuração** dentro do texto, e o documento vai ao cliente.

        No bloco final não há contrato de onde tirar, e vale a da aba.
        """
        return contrato.descricao_para(item.codigo.valor) or item.descricao

    def _unidade(self, item: MeasurementItem, contrato: Contract) -> str:
        itens = contrato.itens_de(item.codigo.valor)
        return itens[0].unidade if itens else ""
