"""T-201 — O modelo institucional como recurso do pacote.

`Papel de Carta e Capa de Apostila.docx`, com a capa, o papel timbrado, as 7
fontes embutidas e as 3 imagens. Vive dentro de `src/` pelo mesmo motivo do
catálogo padrão: acompanha o código no container e no deploy.

O relatório é gerado a partir de uma **cópia** deste arquivo. Montá-lo do zero
perderia as fontes embutidas, que não podem ser reconstruídas (ESPEC 003 D-01).
"""

from __future__ import annotations

from pathlib import Path

MODELO = Path(__file__).parent / "modelo_prodam.docx"

# ── T-1400 / ESPEC 020 · a capa ───────────────────────────────────────────────

# `R-CAP-09` — as cadeias do modelo que **identificam um contrato**, e a fonte
# única da varredura de resíduo.
#
# Não entram aqui `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA`, `DIRETORIA DE
# INFRAESTRUTURA E TECNOLOGIA` e `GIO - GERÊNCIA DE OPERAÇÕES`: identificam a
# PRODAM, ficam no documento por `R-CAP-08`, e listá-las faria a varredura acusar
# o comportamento correto.
#
# **O critério é sobre estas cadeias, nunca sobre a palavra `SMIT`.** O documento
# do PGM contém `SMIT` por um motivo legítimo — a aba `NAS` do levantamento do
# próprio cliente traz a palavra numa célula, que vira linha de anexo (ESPEC 020
# §2.9). Um critério escrito sobre a palavra seria inatingível.
CADEIAS_DO_MODELO = (
    "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA",
    "SMIT SUSTENTAÇÃO",
    "Contrato : TC 52/SMIT/2024 - TA 02",
    "Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /",
    "PA-SMIT-260319-739",
)

# `R-CAP-08` — o que fica, e é conferido como tal.
CADEIAS_INSTITUCIONAIS = (
    "UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA",
    "DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA",
    "GIO - GERÊNCIA DE OPERAÇÕES",
)

# T-1409 / `R-CAP-03` · `D-09` — **o endereço de um campo é a posição, nunca a
# cadeia.** A capa são três caixas lógicas, e cada uma aparece **duas vezes** no
# pacote por `mc:AlternateContent`.
#
# Casar por texto quebraria: `PA-SMIT-260319-739` tem **dois papéis** — a
# continuação da linha `Proposta :` na caixa 1 e o rodapé da capa na caixa 2. Um
# `replace` escreveria a lista de propostas nos dois e a duplicaria na caixa 1.
#
# **A unidade do endereço é o nó `<w:t>`, não o parágrafo.** Medido no modelo, os
# parágrafos por caixa são 3, 4 e 2 — a caixa do contrato tem um vazio no meio, e
# na do rodapé o `GIO` e a proposta dividem o mesmo parágrafo em dois *runs*. Já
# os nós `<w:t>` são **exatamente três em todas as seis**, e cada campo é um deles
# inteiro (ESPEC 020 §2.2). Endereçar por parágrafo erraria em duas das três
# caixas; foi o que a T-1404 pegou antes de existir código.
CAPA_CLIENTE = (0, 1)
CAPA_SUBTITULO = (0, 2)
CAPA_CONTRATO = (1, 0)
CAPA_PROPOSTAS = (1, 1)
CAPA_PROPOSTAS_CONTINUACAO = (1, 2)
CAPA_PROPOSTAS_RODAPE = (2, 2)

# As três posições que `R-CAP-08` preserva, para o teste de não-regressão.
CAPA_FIXAS = ((0, 0), (2, 0), (2, 1))

# Quantas caixas lógicas, quantas cópias de cada e quantos `<w:t>` cada uma tem.
# `D-09` depende desta forma, e por isso ela é afirmada em teste (T-1406) antes de
# ser usada.
CAPA_CAIXAS_LOGICAS = 3
CAPA_COPIAS_POR_CAIXA = 2
CAPA_TEXTOS_POR_CAIXA = 3
