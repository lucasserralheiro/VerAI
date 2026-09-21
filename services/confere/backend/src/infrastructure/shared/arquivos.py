"""Tradução de falhas das bibliotecas de leitura em erro de domínio.

Um XLSX truncado faz o ``openpyxl`` levantar ``BadZipFile``; um PDF corrompido
faz o ``pdfplumber`` levantar ``PDFSyntaxError``. Deixar essas exceções subirem
transformaria erro do usuário em erro de servidor, e o que chegaria a ele seria
um 500 sem explicação. A fronteira com a biblioteca é o lugar de traduzir.
"""

from __future__ import annotations

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
