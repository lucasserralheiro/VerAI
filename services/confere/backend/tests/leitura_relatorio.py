"""T-202 — Leitura das linhas de um relatório gerado, seja PDF ou DOCX.

O teste-âncora compara o relatório com as páginas 2 e 3 do documento GRC. Para
que ele aceite mais de um renderizador, a leitura precisa devolver a **mesma
forma** qualquer que seja o formato.

Ler DOCX é mais direto que ler PDF: o conteúdo já vem em células, sem depender
de extração por coordenada.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import docx
import pdfplumber

CODIGO = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")

# Colunas do relatório, na ordem: Código, Descrição, Unidade, Contratada, Medida.
COLUNAS = 5


@dataclass(frozen=True)
class Linha:
    codigo: str
    descricao: str
    unidade: str
    contratada: str
    medida: str


def normalizar(texto: str | None) -> str:
    """Espaço é acidente de renderização, não conteúdo."""
    return re.sub(r"\s+", " ", (texto or "").replace("\n", " ")).strip()


def _e_linha_de_item(celulas: list[str]) -> bool:
    return len(celulas) >= COLUNAS and bool(CODIGO.match(celulas[0]))


def por_codigo(linhas: list[Linha]) -> dict[str, Linha]:
    """T-1269 — indexa as linhas por código, para comparação sem ordem.

    O âncora da ESPEC 018 compara **por código**, não por posição: o documento
    passa a seguir a ordem do contrato, e a do modelo GRC é editorial
    (ESPEC 018 §2.3).

    `14.025.00011.00` aparece **duas vezes** no modelo, desdobrado por
    qualificador. A `D-01` consolida os dois numa linha só, e o âncora o trata
    como divergência declarada — aqui vence a **última** ocorrência, e a
    asserção sobre esse código vive na exceção, não nesta função.
    """
    return {linha.codigo: linha for linha in linhas}


def ler_pdf(caminho: Path, paginas: tuple[int, ...] | None = None) -> list[Linha]:
    achadas: list[Linha] = []
    with pdfplumber.open(caminho) as pdf:
        indices = paginas if paginas is not None else range(len(pdf.pages))
        for indice in indices:
            for tabela in pdf.pages[indice].extract_tables():
                for bruta in tabela:
                    celulas = [normalizar(c) for c in bruta]
                    if _e_linha_de_item(celulas):
                        achadas.append(Linha(*celulas[:COLUNAS]))
    return achadas


def ler_docx(caminho: Path) -> list[Linha]:
    achadas: list[Linha] = []
    documento = docx.Document(str(caminho))
    for tabela in documento.tables:
        for fileira in tabela.rows:
            celulas = [normalizar(c.text) for c in fileira.cells]
            if _e_linha_de_item(celulas):
                achadas.append(Linha(*celulas[:COLUNAS]))
    return achadas


def ler(caminho: Path) -> list[Linha]:
    """Despacha pelo sufixo do arquivo."""
    if caminho.suffix.lower() == ".docx":
        return ler_docx(caminho)
    return ler_pdf(caminho)
