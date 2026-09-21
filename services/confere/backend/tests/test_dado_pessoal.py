"""T-304 — Guarda de dados pessoais nas fixtures (ESPEC 004 `R-ANX-10`).

O hook de pré-commit já bloqueia a planilha íntegra. Este teste pega o **outro**
caminho, que é o mais provável: alguém regenerar a fixture com a lista de
colunas desatualizada, e o dado real passar sem ninguém notar.

Ele também é a contraprova do desenho: as duas abas com dado pessoal precisam
**estar presentes** e com a contagem original, senão os dois anexos mais
difíceis ficariam sem cobertura — que era exatamente o problema de removê-las.
"""

from __future__ import annotations

import re
from pathlib import Path

import openpyxl
import pytest

# Endereços de e-mail que não sejam do domínio reservado para exemplos.
EMAIL = re.compile(r"[\w.\-+]+@[\w.\-]+")
DOMINIO_SINTETICO = "exemplo.invalid"

ABAS_SENSIVEIS = {"Usuários": 1021, "Office365": 363}


@pytest.fixture(scope="module")
def livro(caminho_levantamento: Path) -> object:
    return openpyxl.load_workbook(caminho_levantamento, read_only=True, data_only=True)


def test_as_abas_sensiveis_estao_na_fixture(livro: object) -> None:
    """Removê-las deixaria `Usuários` e `Office365` sem teste — os dois piores."""
    assert ABAS_SENSIVEIS.keys() <= set(livro.sheetnames)  # type: ignore[attr-defined]


@pytest.mark.parametrize(("aba", "linhas"), sorted(ABAS_SENSIVEIS.items()))
def test_a_contagem_de_linhas_e_a_da_planilha_real(livro: object, aba: str, linhas: int) -> None:
    """Dado sintético, forma real: é o que faz o teste de volume valer alguma coisa."""
    assert livro[aba].max_row == linhas  # type: ignore[index]


@pytest.mark.parametrize("aba", sorted(ABAS_SENSIVEIS))
def test_nenhum_endereco_real_sobreviveu(livro: object, aba: str) -> None:
    vazamentos = [
        valor
        for linha in livro[aba].iter_rows(values_only=True)  # type: ignore[index]
        for valor in linha
        if isinstance(valor, str)
        and EMAIL.search(valor)
        and DOMINIO_SINTETICO not in valor
    ]
    assert not vazamentos, f"{len(vazamentos)} endereço(s) real(is) em '{aba}': {vazamentos[:3]}"


def test_os_logins_sao_os_sintetizados(livro: object) -> None:
    """Login real desta planilha tem a forma `x062020`; o sintético, `u000000`."""
    aba = livro["Usuários"]  # type: ignore[index]
    # `cell()` não existe em modo somente-leitura; a faixa é lida por iteração.
    logins = [
        linha[0]
        for linha in aba.iter_rows(min_row=9, max_row=19, min_col=3, max_col=3, values_only=True)
    ]
    assert all(isinstance(login, str) and login.startswith("u") for login in logins)
