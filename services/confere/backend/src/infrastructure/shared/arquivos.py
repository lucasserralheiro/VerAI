"""Tradução de falhas das bibliotecas de leitura em erro de domínio.

Um XLSX truncado faz o ``openpyxl`` levantar ``BadZipFile``; um PDF corrompido
faz o ``pdfplumber`` levantar ``PDFSyntaxError``. Deixar essas exceções subirem
transformaria erro do usuário em erro de servidor, e o que chegaria a ele seria
um 500 sem explicação. A fronteira com a biblioteca é o lugar de traduzir.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import openpyxl
import pdfplumber

from domain.errors import ExtractionError


def abrir_planilha(caminho: Path, rotulo: str) -> Any:
    try:
        return openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    except Exception as erro:
        raise ExtractionError(
            f"não foi possível abrir o arquivo de {rotulo}: não é uma planilha XLSX válida"
        ) from erro


def abrir_planilha_com_estilos(caminho: Path, rotulo: str) -> Any:
    """Abre a planilha em modo completo, para os anexos (ESPEC 004).

    O modo somente-leitura não popula ``merged_cells``, e sem as mesclagens os
    títulos e resumos das abas sairiam espalhados por várias colunas em vez de
    ocupar a linha. O custo é abrir o arquivo inteiro em memória — cerca de
    1,7 s para esta planilha, pago uma vez para as 19 abas.
    """
    try:
        return openpyxl.load_workbook(caminho, data_only=True)
    except Exception as erro:
        raise ExtractionError(
            f"não foi possível abrir o arquivo de {rotulo}: não é uma planilha XLSX válida"
        ) from erro


def abrir_pdf(caminho: Path, rotulo: str) -> Any:
    try:
        return pdfplumber.open(caminho)
    except Exception as erro:
        raise ExtractionError(
            f"não foi possível abrir o arquivo de {rotulo}: não é um PDF válido"
        ) from erro


def aliviar_pagina(pagina: Any) -> None:
    """Descarta a árvore de layout da página e mantém os objetos já extraídos.

    Para página que **ainda vai ser lida de novo**. O ``_layout`` é a árvore do
    ``pdfminer`` (um objeto Python por caractere); os dicionários de ``objects``
    (chars, rects, lines) já saíram dela e são tudo de que a leitura precisa.
    Voltar à página não reanalisa nada.
    """
    pagina.flush_cache(["_layout"])
    pagina.get_textmap.cache_clear()


def liberar_pagina(pagina: Any) -> None:
    """Descarta tudo o que a página guardou — para página que não será relida.

    Se for relida, o ``pdfplumber`` reanalisa sob demanda (funciona, mas custa
    o tempo da análise de novo).
    """
    pagina.close()


def paginas_liberando(pdf: Any) -> Iterator[tuple[int, Any]]:
    """Percorre as páginas liberando cada uma ao passar para a próxima.

    O ``pdfplumber`` guarda em ``pdf.pages`` cada página lida com tudo o que foi
    analisado — por volta de 1 KB por caractere. Sem liberar, o documento
    inteiro fica vivo até o ``with`` fechar o PDF; com contrato, aditivos e
    várias passadas, o pico passava de 500 MB e o Render matava a instância
    (19/10/2026). Use na **última** passada por cada página.
    """
    for numero, pagina in enumerate(pdf.pages, start=1):
        try:
            yield numero, pagina
        finally:
            liberar_pagina(pagina)
