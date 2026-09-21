"""T-2626 a T-2628 / ESPEC 041 — a linha de uma tabela lida pela régua de outra.

`R-FXA-04` (ESPEC 033) lê uma linha sem faixa própria de oito com "as
divisórias da página" — o comportamento de antes daquela espec, preservado
porque o `contrato_pgm.pdf` depende dele para linhas que pertencem à tabela de
itens mas não têm borda própria desenhada.

O que faltava medir: uma linha pode ter faixa própria — só que de uma tabela de
formato **diferente** (a de escopo, sem preço), que só por acidente de
coordenada tem código de serviço na primeira coluna quando lida pelas colunas
da tabela de preços. `R-FXA-09` fecha essa lacuna: só cai em "as divisórias da
página" a linha cujos traços próprios — havendo algum — pertencem à união das
geometrias que o documento de fato usa para itens.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from infrastructure.contract.grid import Grade, verticais_por_linha
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor


class _PaginaDeTraços:
    """Página mínima: só o que `_faixas_verticais` lê — no molde de `test_grade_por_faixa.py`."""

    def __init__(self, rects: list[dict[str, float]]) -> None:
        self.rects = rects


def _traco(x0: float, topo: float, base: float) -> dict[str, float]:
    return {"x0": x0, "top": topo, "bottom": base, "width": 0.7, "height": base - topo}


# As divisórias medidas na ESPEC 041 §2.1: a linha de escopo do `14.023.00002.00`
# (página 10 do `contrato_cgm.pdf`) contra a tabela de preços da mesma folha.
ESCOPO = [68.6, 126.5, 337.5, 394.0, 421.1]
PRECO = [33.2, 101.8, 298.3, 361.8, 401.5, 470.6, 507.4, 555.5]


# ── T-2626 · `R-FXA-09` — traços de outra tabela não pertencem à página ───────


def test_t2626_linha_de_outra_tabela_nao_e_lida_pela_geometria_da_pagina() -> None:
    """`R-FXA-09` — a linha tem faixa própria, mas de uma tabela diferente.

    Sem faixa de oito e sem herança, a linha do `14.023.00002.00` cairia na
    grade da página. `R-FXA-09` pergunta antes: os cinco traços dela pertencem
    à união das geometrias que o documento usa para item? Não — e por isso ela
    não produz célula nenhuma, em vez de ser lida com as colunas da tabela de
    preços.
    """
    pagina = _PaginaDeTraços([_traco(x, 138.2, 149.9) for x in ESCOPO])
    grade = Grade(horizontais=[138.2, 149.9], verticais=PRECO)

    por_linha = verticais_por_linha(pagina, grade, geometrias=(tuple(PRECO),))

    assert por_linha == [None]


def test_t2626_sem_geometrias_o_comportamento_de_hoje_nao_muda() -> None:
    """Compatibilidade: sem o parâmetro novo, `R-FXA-09` não se aplica.

    É o mesmo padrão de `por_faixa=False` em `ler_celulas` — o default
    preserva o comportamento anterior à espec, bit a bit, para quem chama a
    função sem saber da regra nova.
    """
    pagina = _PaginaDeTraços([_traco(x, 138.2, 149.9) for x in ESCOPO])
    grade = Grade(horizontais=[138.2, 149.9], verticais=PRECO)

    assert verticais_por_linha(pagina, grade) == [PRECO]


# ── T-2626 · `R-FXA-10` — o degrau original continua intocado ─────────────────


def test_t2626_linha_sem_traco_proprio_continua_caindo_na_pagina() -> None:
    """`R-FXA-10` — sem traço nenhum, é o branco entre blocos, não outra tabela.

    É o caso que o `contrato_pgm.pdf` exercita hoje (ESPEC 033 `R-FXA-04`), e
    esta espec não pode mexer nele: a regra nova só se aplica quando a linha
    **tem** borda própria.
    """
    pagina = _PaginaDeTraços([])
    grade = Grade(horizontais=[100.0, 120.0], verticais=PRECO)

    por_linha = verticais_por_linha(pagina, grade, geometrias=(tuple(PRECO),))

    assert por_linha == [PRECO]


def test_t2626_traco_proprio_que_pertence_a_outra_geometria_admitida_nao_e_rejeitado() -> None:
    """`D-01` — a comparação é contra a união, não contra uma geometria só.

    Medido no `aditivo_pgm.pdf` (ESPEC 041 §2.3): duas linhas têm traços que
    não batem com a geometria escolhida como gabarito, mas batem com uma
    **segunda** geometria legitimamente admitida na mesma página. Comparar só
    contra uma delas as rejeitaria — e é exatamente o que este teste reprova.
    """
    segunda_geometria = [53.2, 127.5, 274.5, 354.0, 408.0, 449.2, 497.2, 561.0]
    pagina = _PaginaDeTraços([_traco(x, 598.5, 638.2) for x in segunda_geometria])
    grade = Grade(horizontais=[598.5, 638.2], verticais=PRECO)

    por_linha = verticais_por_linha(
        pagina, grade, geometrias=(tuple(PRECO), tuple(segunda_geometria))
    )

    assert por_linha == [segunda_geometria]


# ── T-2627 · Sobre o documento real ───────────────────────────────────────────


def test_t2627_as_duas_linhas_de_escopo_nao_bloqueiam_mais_a_extracao(
    caminho_contrato_cgm: Path,
) -> None:
    """ESPEC 040 `I-04` fechado: a extração do `contrato_cgm.pdf` não falha mais.

    Sucessora de `test_t2609_mensagem_prevista_apos_a_correcao` (ESPEC 040) —
    aquele teste documentava a mensagem prevista *antes* desta correção
    existir; agora ela não ocorre mais.

    `total_declarado` era `None` até a ESPEC 042 (`I-01` desta espec, total
    expresso em prosa) fechar essa lacuna — ver `test_total_por_convergencia.py`.
    """
    extrator = PdfPlumberContractExtractor()

    contrato = extrator.extrair(caminho_contrato_cgm)

    assert len(contrato.itens) == 33
    assert contrato.soma_dos_totais == Decimal("5532203.96")
    assert contrato.total_declarado == Decimal("5532203.96")


def test_t2627_os_dois_codigos_aparecem_com_o_preco_real_da_pagina_12(
    caminho_contrato_cgm: Path,
) -> None:
    """Cada código tem duas ocorrências — escopo (p10) e preço (p12) — e só a
    segunda vira item, com dado de verdade. É o mesmo padrão do
    `10.050.00001.00` na ESPEC 040: a linha de escopo nunca devia ter sido
    lida como item, e agora não é.
    """
    extrator = PdfPlumberContractExtractor()
    contrato = extrator.extrair(caminho_contrato_cgm)

    por_codigo = {item.codigo.valor: item for item in contrato.itens}

    acesso = por_codigo["14.023.00002.00"]
    assert acesso.pagina == 12
    assert acesso.preco_unitario == Decimal("13.79")
    assert acesso.total_declarado == Decimal("42197.40")

    etl = por_codigo["15.069.00001.00"]
    assert etl.pagina == 12
    assert etl.preco_unitario == Decimal("9976.84")
    assert etl.total_declarado == Decimal("119722.08")
