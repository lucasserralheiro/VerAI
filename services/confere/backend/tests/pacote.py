"""T-2000 / ESPEC 026 — Comparação de pacotes OOXML entrada a entrada.

Um `.docx` e um `.xlsx` são ZIPs, e a pergunta *"este artefato mudou?"* se
responde comparando o conteúdo de cada entrada, não o arquivo inteiro. As duas
formas dão a mesma resposta; só uma delas diz **onde**.

Veio de `test_quantitativo_consolidado.py`, onde nasceu com a ESPEC 022 para
provar que os aditivos não alcançavam o documento. A ESPEC 026 precisa da mesma
comparação para provar o contrário — que uma reescrita do renderizador não
alcança o documento —, e duas cópias divergiriam na primeira vez que alguém
mexesse na exclusão abaixo.
"""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

# A parte do zip que difere entre duas execuções quaisquer: `dcterms:modified`,
# o carimbo de hora da geração. **Medida antes de ser excluída** (ESPEC 022
# §2.3) — excluí-la sem olhar esconderia alteração de metadado real, e é o que
# a próxima pessoa fará se este comentário não estiver aqui.
#
# T-2002 / ESPEC 026 — **remedida, e os dois artefatos se comportam de forma
# oposta.**
#
# No `.docx` ela **não varia**: dois processos separados geram o mesmo pacote
# byte a byte, esta parte inclusive, porque o `dcterms:modified` vem do
# `modelo.docx` e o `python-docx` só o reescreve se alguém tocar em
# `core_properties` — o que este projeto não faz. Ali a exclusão é cinto.
#
# No `.xlsx` ela **varia a cada renderização**: o `openpyxl` monta o pacote do
# zero e grava `dcterms:modified` com a hora corrente. Duas renderizações
# consecutivas do mesmo objeto diferem no arquivo inteiro e são idênticas em
# **todas** as outras entradas — verificado. Ali a exclusão é obrigatória, e é a
# razão de a comparação por entrada valer para os dois.
PARTE_COM_CARIMBO_DE_HORA = "docProps/core.xml"


def partes(caminho: Path) -> dict[str, str]:
    """Hash de cada entrada do zip, sem o carimbo de hora."""
    with zipfile.ZipFile(caminho) as pacote:
        return {
            entrada.filename: hashlib.sha256(pacote.read(entrada.filename)).hexdigest()
            for entrada in pacote.infolist()
            if entrada.filename != PARTE_COM_CARIMBO_DE_HORA
        }
