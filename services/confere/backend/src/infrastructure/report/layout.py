"""Constantes de layout, medidas no relatório modelo.

Nada aqui foi arbitrado: página, colunas, altura de linha, corpo de fonte e
cores saíram da inspeção do PDF de referência (``pdfplumber``: ``page.rects``
para os preenchimentos, ``page.chars`` para a fonte). Reproduzir o documento
atual é o critério de aceite — estimar essas medidas seria trocar fidelidade
verificável por aparência plausível.

**Sem dependência de biblioteca de renderização.** As cores são hexadecimais e
as medidas, pontos tipográficos; cada renderizador converte para o que precisa.
É o que permite trocar o formato de saída sem tocar nas medidas (ESPEC 003
D-05).
"""

from __future__ import annotations

# ── Página ────────────────────────────────────────────────────────────────────
LARGURA_PAGINA = 841.7
ALTURA_PAGINA = 595.2

MARGEM_ESQUERDA = 37.3
MARGEM_DIREITA = LARGURA_PAGINA - 799.3
MARGEM_SUPERIOR = 50.0
MARGEM_INFERIOR = 30.0

# ── Colunas ───────────────────────────────────────────────────────────────────
# Fronteiras observadas: 37 | 160 | 597 | 681 | 744 | 799
LARGURAS_COLUNAS = (
    160.0 - 37.3,   # Código
    597.0 - 160.0,  # Descrição
    681.0 - 597.0,  # Unidade
    744.0 - 681.0,  # Quantidade Contratada
    799.3 - 744.0,  # Quantidade Medida
)

LARGURA_DA_TABELA = sum(LARGURAS_COLUNAS)

# Folga descontada da coluna de descrição, e só dela.
#
# No DOCX cada célula tem margem interna, e a soma delas empurra a tabela para
# fora da área útil: com as medidas do GRC exatas, a última coluna saía cortada.
# A margem foi reduzida ao mínimo (ver `ooxml.MARGEM_CELULA`), e o que ainda
# sobra é absorvido aqui.
#
# A descrição é a única coluna que pode ceder: as quatro restantes têm largura
# ditada pelo conteúdo — código e quantidades não quebram linha, e apertá-las
# cortaria número. A descrição já quebra em várias linhas no relatório modelo,
# então uma linha a mais não altera a leitura.
FOLGA_DESCRICAO = 24.0


# ── Tipografia ────────────────────────────────────────────────────────────────
CORPO_FONTE = 5.6
ALTURA_LINHA = 7.6
ENTRELINHA = 6.6

FONTE_REGULAR = "Calibri"
FONTE_NEGRITO = "Calibri-Bold"
FONTE_REGULAR_ALTERNATIVA = "Helvetica"
FONTE_NEGRITO_ALTERNATIVA = "Helvetica-Bold"

# ── Cores, em hexadecimal ─────────────────────────────────────────────────────
NAVY = "#222854"     # faixas de título, cabeçalho e seção
LAVANDA = "#E6E6FA"  # coluna "Quantidade Medida"
BRANCO = "#FFFFFF"
PRETO = "#000000"
GRADE = "#7F7F7F"

# ── Cabeçalho da tabela ───────────────────────────────────────────────────────
CABECALHO_COLUNAS = (
    "Código",
    "Descrição",
    "Unidade",
    "Quantidade Contratada",
    "Quantidade Medida",
)

# ESPEC 018 `D-06` — título do bloco final, com o que a aba `Levantamento` traz
# e o contrato submetido não conhece.
#
# Neutro de propósito. O documento vai ao órgão, e "sem previsão contratual"
# seria juízo que a aplicação não tem elementos para emitir: no PGM, dois desses
# itens a planilha dá por **contratados**, e quem não os conhece é o PDF. Os
# números se leem sozinhos — `0 / 1` diz uma coisa, `5 / 0` diz outra.
#
# ESPEC 024 `R-NOT-01` — o asterisco remete à nota de `NOTA_DEMAIS_ITENS`. Sem
# condicional própria: o chamador em `docx_renderer.py` só usa este título
# quando o bloco final existe.
TITULO_DEMAIS_ITENS = "DEMAIS ITENS DO LEVANTAMENTO*"

# ESPEC 024 `R-NOT-02` — a explicação do asterisco acima, escrita no rodapé do
# documento e só quando o bloco final existe (`R-NOT-03`). Mantém a
# neutralidade da `D-06`: descreve o mecanismo (código sem correspondência no
# contrato analisado), não a causa da ausência.
#
# O `*` inicial é o par do que fecha `TITULO_DEMAIS_ITENS`: é ele que liga a
# faixa à nota. Sem o marcador, a frase fica solta no rodapé e o asterisco do
# título não remete a lugar nenhum.
NOTA_DEMAIS_ITENS = (
    "*Itens presentes na aba de levantamento sem código correspondente na "
    "tabela de itens do contrato analisado."
)

# Larguras usadas na renderização em DOCX. Idênticas às do GRC, exceto a
# descrição, que cede a folga acima.
LARGURAS_COLUNAS_DOCX = (
    LARGURAS_COLUNAS[0],
    LARGURAS_COLUNAS[1] - FOLGA_DESCRICAO,
    LARGURAS_COLUNAS[2],
    LARGURAS_COLUNAS[3],
    LARGURAS_COLUNAS[4],
)
