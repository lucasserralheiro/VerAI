"""T-1200 / T-1258 — Fixtures da regra do desconto (ESPEC 018 `D-09`).

Duas planilhas mínimas, no formato da aba `Levantamento`, para exercitar o que
os dois arquivos reais **não** exercitam:

* ``levantamento_blocos_invertidos.xlsx`` — o bloco ``DESCONTANDO RECURSOS DE
  DESENVOLVIMENTO`` vem **acima** do total cheio, com a faixa **mesclada** nas
  cinco colunas, como no levantamento do PGM. Nos dois pares reais o desconto
  vem por último, e é por isso que o atalho *"vale a última lida"* acertava por
  coincidência;
* ``levantamento_sem_marca_de_desconto.xlsx`` — código repetido em dois blocos,
  **nenhum** com a marca. É o caso que a ``V-MED-03`` tem de acusar;
* ``levantamento_apuracao_incompleta.xlsx`` — **T-2139 / ESPEC 031 `R-APU-03`.**
  Bloco bruto com três códigos, apuração descontada com dois. O terceiro é o
  órfão: presente em cima, ausente embaixo, e por isso mede zero. É o piloto em
  miniatura — um código que encolhe, um que não muda e um que some.

**Regenerar as duas primeiras é desnecessário e indesejável.** Elas já estão
versionadas e o seu conteúdo não muda; regravá-las só produziria bytes novos com
o mesmo conteúdo. A ``main`` as reconstrói para quem precisar, mas a T-2139
gravou **apenas** a terceira.

Uso:
    python scripts/gerar_fixtures_desconto.py
"""

from __future__ import annotations

from pathlib import Path

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "backend" / "tests" / "fixtures"

INVERTIDOS = DESTINO / "levantamento_blocos_invertidos.xlsx"
SEM_MARCA = DESTINO / "levantamento_sem_marca_de_desconto.xlsx"
INCOMPLETA = DESTINO / "levantamento_apuracao_incompleta.xlsx"

COLUNAS = 5
MARCA = "DESCONTANDO RECURSOS DE DESENVOLVIMENTO"

# O código repetido e o que cada bloco afirma dele. A diferença entre 5 e 9 é a
# mesma do `14.049.00038.00` no PGM — dois servidores de desenvolvimento e um a
# mais, que o cliente não paga.
CODIGO = "14.049.00038.00"
MEDIDA_DESCONTADA = "5"
MEDIDA_CHEIA = "9"


def _cabecalho(aba: Worksheet, linha: int) -> int:
    aba.cell(row=linha, column=1, value="LEVANTAMENTO - COMPROVAÇÃO FIXTURE")
    aba.cell(row=linha + 1, column=1, value="Data do Levantamento : 15/07/2026")
    aba.cell(row=linha + 2, column=1, value="*Valores conforme contrato : TC 00/FIXTURE/2026")
    return linha + 3


def _faixa_mesclada(aba: Worksheet, linha: int, titulo: str) -> int:
    """A faixa **como o leitor a recebe** do arquivo do PGM.

    O texto vai em **todas as cinco colunas**, e não só na âncora. Medido: o
    levantamento do PGM chega ao leitor assim, e é essa forma que o crivo
    anterior rejeitava, por exigir *"texto só na primeira coluna"*.

    **Sem ``merge_cells``, e de propósito.** Medido: o arquivo do PGM traz a
    mesclagem ``A57:E57`` *e* as células não-âncora materializadas, e por isso o
    modo somente-leitura devolve o texto cinco vezes. O ``merge_cells`` do
    ``openpyxl`` faz o contrário — apaga as não-âncora —, e a fixture voltaria a
    chegar como coluna única, passando nos dois crivos e provando nada.

    A fixture reproduz o **insumo observado**, não a hipótese sobre como ele foi
    produzido. A mesclagem é cosmética; o que o leitor vê são as cinco células.
    """
    for coluna in range(1, COLUNAS + 1):
        aba.cell(row=linha, column=coluna, value=titulo)
    return linha + 1


def _cabecalho_de_colunas(aba: Worksheet, linha: int) -> int:
    for coluna, texto in enumerate(
        ["Tipo", "Código", "Unidade", "Quantidade Contratada", "Quantidade Medida"], start=1
    ):
        aba.cell(row=linha, column=coluna, value=texto)
    return linha + 1


def _item(aba: Worksheet, linha: int, medida: str) -> int:
    aba.cell(row=linha, column=1, value="HOSPEDAGEM DE APLICAÇÃO TIPO B - GERENCIADA - WINDOWS")
    aba.cell(row=linha, column=3, value=CODIGO)
    aba.cell(row=linha, column=4, value="5")
    aba.cell(row=linha, column=5, value=medida)
    return linha + 1


def _bloco(aba: Worksheet, linha: int, titulo: str, medida: str) -> int:
    linha = _faixa_mesclada(aba, linha, titulo)
    linha = _cabecalho_de_colunas(aba, linha)
    linha = _item(aba, linha, medida)
    return linha + 1


def _gravar(caminho: Path, titulos_e_medidas: list[tuple[str, str]]) -> None:
    livro = openpyxl.Workbook()
    aba = livro.active
    assert aba is not None
    aba.title = "Levantamento"

    linha = _cabecalho(aba, 1)
    for titulo, medida in titulos_e_medidas:
        linha = _bloco(aba, linha, titulo, medida)

    livro.save(caminho)
    livro.close()


# ── T-2139 · a apuração descontada que omite um código (ESPEC 031) ───────────
#
# Os três códigos são inventados de propósito, fora das faixas que os dois pares
# reais usam: uma fixture que reaproveitasse `14.049.00054.00` faria um teste
# construído parecer medição de arquivo real, e a regra 1 do TASKS 031 existe
# contra exatamente essa confusão.

BASE_INCOMPLETA = "E1.1 - APURAÇÃO INCOMPLETA - TOTAL DE RECURSOS"

#: descrição, código, contratada, medida — no bloco bruto.
BRUTO: list[tuple[str, str, str, str]] = [
    ("HOSPEDAGEM TIPO A - GERENCIADA - WINDOWS", "14.049.00090.00", "5", "4"),
    ("HOSPEDAGEM TIPO B - GERENCIADA - LINUX", "14.049.00091.00", "2", "2"),
    ("HOSPEDAGEM TIPO C - NÃO GERENCIADA - LINUX", "14.049.00092.00", "0", "2"),
]

#: a apuração descontada — **sem o `…00092.00`**, que é o ponto da fixture.
DESCONTADO: list[tuple[str, str, str, str]] = [
    ("HOSPEDAGEM TIPO A - GERENCIADA - WINDOWS", "14.049.00090.00", "5", "2"),
    ("HOSPEDAGEM TIPO B - GERENCIADA - LINUX", "14.049.00091.00", "2", "2"),
]

ORFAO = "14.049.00092.00"


def _itens(aba: Worksheet, linha: int, itens: list[tuple[str, str, str, str]]) -> int:
    for descricao, codigo, contratada, medida in itens:
        aba.cell(row=linha, column=1, value=descricao)
        aba.cell(row=linha, column=3, value=codigo)
        aba.cell(row=linha, column=4, value=contratada)
        aba.cell(row=linha, column=5, value=medida)
        linha += 1
    return linha


def gerar_apuracao_incompleta() -> None:
    """Grava ``levantamento_apuracao_incompleta.xlsx``.

    A faixa vai pelas cinco colunas, como em ``_faixa_mesclada`` e pelo mesmo
    motivo medido: é a forma em que o leitor a recebe dos arquivos reais.
    """
    livro = openpyxl.Workbook()
    aba = livro.active
    assert aba is not None
    aba.title = "Levantamento"

    linha = _cabecalho(aba, 1)
    for titulo, itens in (
        (BASE_INCOMPLETA, BRUTO),
        (f"{BASE_INCOMPLETA} - {MARCA}", DESCONTADO),
    ):
        linha = _faixa_mesclada(aba, linha, titulo)
        linha = _cabecalho_de_colunas(aba, linha)
        linha = _itens(aba, linha, itens) + 1

    livro.save(INCOMPLETA)
    livro.close()


def main() -> None:
    base = "E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS"

    # A ordem é o ponto: o desconto **em cima**. Nos dois pares reais ele vem
    # embaixo, e é o que fazia o atalho por posição acertar sem regra.
    _gravar(
        INVERTIDOS,
        [
            (f"{base} - {MARCA}", MEDIDA_DESCONTADA),
            (base, MEDIDA_CHEIA),
        ],
    )

    _gravar(
        SEM_MARCA,
        [
            (base, MEDIDA_CHEIA),
            (f"{base} (SEGUNDA APURAÇÃO)", MEDIDA_DESCONTADA),
        ],
    )

    gerar_apuracao_incompleta()

    print(f"[ok] {INVERTIDOS.name} — desconto acima, faixa mesclada")
    print(f"[ok] {SEM_MARCA.name} — dois blocos, nenhum com a marca")
    print(f"[ok] {INCOMPLETA.name} — apuração descontada sem o {ORFAO}")


if __name__ == "__main__":
    main()
