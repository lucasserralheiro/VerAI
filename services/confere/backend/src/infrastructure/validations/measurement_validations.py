"""T-30 — Validações da medição (ESPEC 001 §6).

ESPEC 027 acrescentou a causa e o cartão de quatro partes de `V-MED-01`, e
fundiu `V-MED-02` num achado só — o mesmo tratamento que a ESPEC 025 deu ao
lado do contrato.
"""

from __future__ import annotations

from enum import StrEnum

from domain.entities.measurement import DiagnosticoDaAba, Measurement
from domain.entities.validation_finding import Severity, ValidationReport

# ── V-MED-01 · a causa da leitura vazia (ESPEC 027 `R-LEV-05`) ────────────────


class CausaDaLeituraVazia(StrEnum):
    """ESPEC 027 §2.3 — por que a aba `Levantamento` não rendeu item nenhum.

    Três valores, na ordem em que são perguntados — a mesma forma de
    `CausaProvavel` em `contract_validations.py`, do outro lado do formulário.
    """

    ABA_VAZIA = "ABA_VAZIA"
    CODIGO_DESLOCADO = "CODIGO_DESLOCADO"
    SEM_CODIGO = "SEM_CODIGO"


def causa_da_leitura_vazia(diagnostico: DiagnosticoDaAba | None) -> CausaDaLeituraVazia | None:
    """A causa, decidida **só** sobre o diagnóstico — função pura, sem planilha.

    É o que permite exercitar os três degraus da `R-LEV-05` sem abrir arquivo,
    inclusive o degrau *aba vazia*, para o qual o repositório não tem fixture
    (`D-02` da ESPEC 027, no espírito da `D-04` da 025).

    `None` quando não há diagnóstico — chamada direta, fora do fluxo do
    leitor, é o caminho que a `R-GRD-06` mantém chamável sem quebrar.
    """
    if diagnostico is None:
        return None
    if diagnostico.linhas_preenchidas == 0:
        return CausaDaLeituraVazia.ABA_VAZIA
    if diagnostico.codigos_por_coluna:
        return CausaDaLeituraVazia.CODIGO_DESLOCADO
    return CausaDaLeituraVazia.SEM_CODIGO


def _coluna_predominante(codigos_por_coluna: dict[int, int]) -> str:
    """A letra da coluna com **mais** códigos, e não a primeira encontrada.

    Uma planilha com um código perdido na coluna C e setenta e quatro na H
    precisa apontar H — é a coluna que de fato explica a leitura vazia.
    """
    from openpyxl.utils import get_column_letter

    coluna = max(codigos_por_coluna, key=lambda c: codigos_por_coluna[c])
    letra: str = get_column_letter(coluna)
    return letra


def _frase_da_causa_med01(diagnostico: DiagnosticoDaAba) -> str:
    """ESPEC 027 §8.1 — a evidência, em vocabulário de quem confere."""
    causa = causa_da_leitura_vazia(diagnostico)
    if causa is CausaDaLeituraVazia.ABA_VAZIA:
        return "A aba Levantamento está vazia."
    if causa is CausaDaLeituraVazia.CODIGO_DESLOCADO:
        letra = _coluna_predominante(diagnostico.codigos_por_coluna)
        return (
            f"Os códigos de serviço desta planilha estão na coluna {letra}. "
            "O Confere lê os códigos das colunas A a E da aba Levantamento."
        )
    return (
        f"Nenhuma das {diagnostico.linhas_preenchidas} linhas preenchidas da aba "
        "traz um código de serviço no formato 00.000.00000.00."
    )


def _frase_da_acao_med01(diagnostico: DiagnosticoDaAba) -> str:
    """ESPEC 027 §8.1 — o que fazer, em um passo. Muda com o degrau.

    A ação, e não só a causa, é o que separa esta espec de trocar uma frase:
    no degrau de coluna deslocada o conserto é reposicionar; no de aba sem
    código, é confirmar o arquivo — uma ação única mandaria metade das
    pessoas para o lugar errado.
    """
    causa = causa_da_leitura_vazia(diagnostico)
    if causa is CausaDaLeituraVazia.CODIGO_DESLOCADO:
        return (
            "Envie a planilha no layout padrão do levantamento, com o código "
            "de serviço até a coluna E."
        )
    if causa is CausaDaLeituraVazia.SEM_CODIGO:
        return (
            "Confirme que este é o arquivo de levantamento — a aba existe, "
            "mas não traz itens de serviço."
        )
    return "Envie a planilha de levantamento da competência, com os itens medidos."


def _detalhe_med01(diagnostico: DiagnosticoDaAba) -> str:
    """ESPEC 027 §8.1 — os números da leitura, recolhidos para o suporte."""
    mapa = dict(sorted(diagnostico.codigos_por_coluna.items()))
    return (
        f"V-MED-01 · aba Levantamento · {diagnostico.linhas_preenchidas} linhas "
        f"preenchidas · colunas lidas A–E · códigos por coluna: {mapa}"
    )


def _titulo_med01(nome_do_arquivo: str) -> str:
    """ESPEC 027 §8.1 — o título, fixo, mais o nome do arquivo submetido.

    Nome entre parênteses, na mesma frase — o padrão de `_identificar` em
    `contract_validations.py` (`R-DOC-06`), e não uma segunda linha: `titulo`
    é um `<p>` só no `ResultadoPanel`, sem `white-space: pre-line`.
    """
    base = "Nenhum item foi lido da aba Levantamento"
    return f"{base} ({nome_do_arquivo})." if nome_do_arquivo else f"{base}."


def v_med_01_aba_reconhecida(
    medicao: Measurement, achados: ValidationReport, nome_do_arquivo: str = ""
) -> None:
    """A aba `Levantamento` foi lida e produziu itens. Bloqueante.

    ESPEC 027 `R-LEV-04` — com diagnóstico, o achado sai em quatro partes,
    com a causa e a ação do degrau que `causa_da_leitura_vazia` apurou. Sem
    diagnóstico, cai no texto genérico de sempre (`R-GRD-06`): a validação
    continua chamável fora do fluxo do leitor, como os testes de unidade a
    chamam.
    """
    if medicao.itens:
        return

    if medicao.diagnostico is None:
        achados.registrar(
            "V-MED-01",
            Severity.BLOQUEIA,
            "nenhum item encontrado na aba 'Levantamento' — o layout da planilha "
            "pode ter mudado",
        )
        return

    diagnostico = medicao.diagnostico
    achados.registrar_em_partes(
        "V-MED-01",
        Severity.BLOQUEIA,
        titulo=_titulo_med01(nome_do_arquivo),
        causa=_frase_da_causa_med01(diagnostico),
        acao=_frase_da_acao_med01(diagnostico),
        detalhe=_detalhe_med01(diagnostico),
    )


def v_med_02_cabecalho_localizado(medicao: Measurement, achados: ValidationReport) -> None:
    """Data do levantamento e contrato de referência saíram do cabeçalho.

    Apenas avisa: os dois alimentam o topo do relatório, e sua ausência degrada
    o documento sem invalidar os números.

    ESPEC 027 `R-LEV-07` — **um** achado, não dois: os dois campos saem das
    mesmas dez primeiras linhas, e falhar juntos é a regra, não a exceção — o
    texto se ajusta a qual faltou.
    """
    falta_data = medicao.data_levantamento is None
    falta_contrato = not medicao.contrato_referencia
    if not falta_data and not falta_contrato:
        return

    if falta_data and falta_contrato:
        campo = "a data nem o contrato"
        titulo_campo = "não traz a data nem o contrato"
    elif falta_data:
        campo = "a data"
        titulo_campo = "não traz a data"
    else:
        campo = "o contrato"
        titulo_campo = "não traz o contrato"

    achados.registrar_em_partes(
        "V-MED-02",
        Severity.AVISA,
        titulo=f"O cabeçalho da aba Levantamento {titulo_campo}.",
        causa=f"O relatório sai com {campo} em branco no topo.",
        acao=(
            "Confira as dez primeiras linhas da aba: elas devem trazer "
            '"Data do Levantamento :" e "conforme contrato :".'
        ),
    )


def v_med_03_desconto_por_posicao(medicao: Measurement, achados: ValidationReport) -> None:
    """T-1207 — código repetido resolvido por posição, e não pela marca.

    `R-MED-02` manda prevalecer a variante que desconta recursos de
    desenvolvimento: **o cliente não paga por servidor de desenvolvimento**.
    Quando nenhuma das ocorrências traz a marca, ``item_para`` cai no atalho
    *"vale a última lida"* — que acerta enquanto a planilha listar o desconto
    por último, e erra em silêncio no dia em que a ordem inverter.

    É a rede da ESPEC 018 `D-09`. Com a faixa mesclada reconhecida
    (`R-REL-11`), não dispara em nenhum dos dois pares reais; **dispararia em
    oito dos nove códigos repetidos do PGM** antes da correção.
    """
    for codigo in sorted(medicao.codigos):
        ocorrencias = medicao.itens_de(codigo)
        if len(ocorrencias) < 2:
            continue
        if any(item.desconta_desenvolvimento for item in ocorrencias):
            continue

        escolhida = ocorrencias[-1]
        achados.registrar_em_partes(
            "V-MED-03",
            Severity.AVISA,
            titulo=(
                f"O código {codigo} aparece {len(ocorrencias)} vezes na planilha "
                "sem marca de desconto."
            ),
            causa=(
                "O sistema não conseguiu identificar qual ocorrência já desconta o "
                "uso de desenvolvimento, então usou a última."
            ),
            acao=(
                f"Confira a linha {escolhida.linha} da planilha (medida "
                f"{escolhida.medida_texto}) — é ela que entrou no relatório."
            ),
            codigo=codigo,
        )


def v_med_04_apuracao_sem_par(medicao: Measurement, achados: ValidationReport) -> None:
    """T-2152 / ESPEC 031 `R-APU-05` — bloco descontado que não achou o bruto.

    A `R-APU-01` pareia pelo título: o do bloco descontado, menos a marca e o
    separador, tem de dar o título do bloco bruto. Nos dois pares reais os quatro
    blocos pareiam. Não pareando, a `R-APU-03` **não faz nada** — e a leitura
    volta a ser a de antes, com o valor bruto sendo emitido como faturável.

    **É a única validação deste projeto que protege contra algo que não aparece
    como vermelho.** Uma planilha futura que grafe `DESCONTANDO REC. DE
    DESENVOLVIMENTO`, ou que troque o hífen por travessão em outro ponto do
    título, desligaria a regra **sozinha e em silêncio**, devolvendo o defeito que
    a ESPEC 031 corrigiu sem que nenhum teste acusasse.

    É o modo de falha da ESPEC 018 §2.8, e ele já custou vários incrementos com a
    `R-MED-02` inerte em produção e a suíte verde. A diferença desta vez é que a
    ausência de par vira achado em vez de silêncio.

    `AVISA` e não `BLOQUEIA`: o documento continua correto para todo o resto da
    planilha, e a decisão de emitir assim mesmo é de quem confere.
    """
    for titulo in medicao.blocos_descontados_sem_par():
        achados.registrar_em_partes(
            "V-MED-04",
            Severity.AVISA,
            titulo="Um bloco de desconto não teve o par correspondente encontrado.",
            causa=(
                f"O bloco '{titulo}' desconta recursos de desenvolvimento, mas a "
                "planilha não tem o bloco sem desconto para comparar."
            ),
            acao=(
                "As quantidades saem como a planilha traz, sem o desconto — confira "
                "se os dois blocos existem na aba Levantamento."
            ),
            detalhe="ESPEC 031 R-APU-05",
        )
