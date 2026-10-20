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
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdfminer.pdftypes import resolve1

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


def pdf_sem_texto(caminho: Path) -> bool:
    """O PDF não tem **nenhuma** fonte — o texto foi gravado como desenho? (20/10/2026)

    O ``Microsoft: Print To PDF`` às vezes converte as letras em contorno: a
    página mostra o texto, mas não há um caractere sequer para extrair. Foi o
    caso do ``PC-HSPM-230207-13 v3.0`` (TC 094/2023 do HSPM): 12 páginas, 0
    caracteres e ~40 mil traços. O ``pdfplumber`` analisava cada traço — 62 s e
    275 MB aqui, ~10 min no Render free — para no fim não achar item nenhum.

    A resposta sai do dicionário de recursos das páginas, sem analisar o
    conteúdo: milissegundos. Página sem ``/Font`` própria pode desenhar texto
    por um *Form XObject* com fontes, e por isso eles também são olhados. Só
    responde *sim* quando nenhuma página, de nenhum jeito, declara fonte — PDF
    com texto em alguma página segue o caminho de sempre.

    Arquivo que nem abre como PDF responde ``False``: quem decide a mensagem
    desse caso é ``abrir_pdf``.
    """
    try:
        with caminho.open("rb") as arquivo:
            documento = PDFDocument(PDFParser(arquivo))
            for pagina in PDFPage.create_pages(documento):
                if _declara_fonte(pagina.resources, profundidade=2):
                    return False
    except Exception:
        return False
    return True


def _declara_fonte(recursos: Any, profundidade: int) -> bool:
    recursos = resolve1(recursos) or {}
    if not isinstance(recursos, dict):
        return False
    if resolve1(recursos.get("Font")):
        return True
    if profundidade <= 0:
        return False
    objetos = resolve1(recursos.get("XObject")) or {}
    if not isinstance(objetos, dict):
        return False
    for referencia in objetos.values():
        objeto = resolve1(referencia)
        atributos = getattr(objeto, "attrs", None)
        if not isinstance(atributos, dict):
            continue
        subtipo = resolve1(atributos.get("Subtype"))
        if getattr(subtipo, "name", None) == "Form" and _declara_fonte(
            atributos.get("Resources"), profundidade - 1
        ):
            return True
    return False


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
