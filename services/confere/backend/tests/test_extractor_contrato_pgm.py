"""T-1101 — Teste-âncora do segundo contrato real (ESPEC 017).

Arquivo próprio, e não um bloco em `test_extractor_contract.py`: aquele é o
contrato de não-regressão do piloto, e a ESPEC 017 §9.1 exige que ele não seja
tocado. Misturar os dois faria qualquer diff nele parecer violação da regra.

**A procedência dos números importa mais que os números.** Um teste-âncora cujo
valor esperado foi copiado da saída do código que ele julga não é âncora, é
espelho. Cada valor abaixo foi lido do PDF:

* ``24551037.72`` está impresso na linha ``TOTAL:`` da página 25;
* ``47`` e ``46`` saem da contagem de linhas com código de serviço nas páginas
  22 a 25 — 47 linhas, das quais duas repetem ``10.050.00001.00``;
* as páginas ``22`` a ``25`` são onde a tabela de itens começa e termina, como
  as 26 a 29 no piloto.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.contract import Contract
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

TOTAL_DECLARADO = Decimal("24551037.72")
PAGINAS_DA_TABELA = {22, 23, 24, 25}


@pytest.fixture(scope="module")
def contrato_pgm(caminho_contrato_pgm: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_contrato_pgm)


def test_todas_as_linhas_de_item_foram_extraidas(contrato_pgm: Contract) -> None:
    assert len(contrato_pgm.itens) == 47


def test_os_codigos_distintos_conferem(contrato_pgm: Contract) -> None:
    assert len(contrato_pgm.codigos) == 46


def test_a_tabela_ocupa_as_paginas_22_a_25(contrato_pgm: Contract) -> None:
    """A página 25 é a do quadro de totais, e é a que o defeito B descartava.

    Ela traz 5 itens **e** a linha ``TOTAL:``. Perdê-la não bloqueia por falta
    de itens — bloqueia por `V-CTR-03` sem total, que é um sintoma mais difícil
    de ler (ESPEC 017 §2.3).
    """
    assert {item.pagina for item in contrato_pgm.itens} == PAGINAS_DA_TABELA


def test_proposta_de_origem_e_identificada(contrato_pgm: Contract) -> None:
    """Não depende da grade: `_proposta` lê o texto da página 1.

    É o que distingue "o extrator não leu a tabela" de "o extrator não abriu o
    arquivo" — esta asserção já passava antes da ESPEC 017.
    """
    assert contrato_pgm.proposta == "PA-PGM-251015-159"


def test_o_total_declarado_foi_localizado(contrato_pgm: Contract) -> None:
    assert contrato_pgm.total_declarado == TOTAL_DECLARADO


def test_checksum_confere_com_o_total_declarado(contrato_pgm: Contract) -> None:
    """A prova de ponta a ponta, no segundo contrato (PLANO 001 D-03).

    Dois contratos reais, de órgãos diferentes e geometrias diferentes,
    extraídos pelo mesmo código sem parâmetro de layout. É o que separa
    "funciona no piloto" de "funciona" (ESPEC 017 §9.3).
    """
    assert contrato_pgm.soma_dos_totais == TOTAL_DECLARADO
