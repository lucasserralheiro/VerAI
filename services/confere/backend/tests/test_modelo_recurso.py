"""T-204 — O modelo institucional é um recurso do pacote.

Vive dentro de `src/`, pelo mesmo motivo do catálogo padrão: acompanha o código
no container e no deploy. Se sumir, o relatório perde a identidade visual — e
uma falha assim precisa aparecer como teste, não na entrega.
"""

from __future__ import annotations

import zipfile

import docx

from infrastructure.report.modelo import MODELO


def test_modelo_acompanha_o_codigo() -> None:
    assert MODELO.exists(), f"modelo ausente em {MODELO}"
    assert MODELO.suffix == ".docx"


def test_modelo_preserva_fontes_e_imagens() -> None:
    """Os números vêm da inspeção do pacote (ESPEC 003 §3)."""
    with zipfile.ZipFile(MODELO) as pacote:
        nomes = pacote.namelist()

    assert len(nomes) == 39
    assert sum(1 for n in nomes if "fonts/" in n) == 7
    assert sum(1 for n in nomes if "media/" in n) == 3
    assert "word/header1.xml" in nomes
    assert "word/footer1.xml" in nomes


def test_modelo_abre_e_tem_uma_secao_retrato() -> None:
    documento = docx.Document(str(MODELO))
    assert len(documento.sections) == 1
    secao = documento.sections[0]
    assert round(secao.page_width.cm, 1) == 21.0
    assert round(secao.page_height.cm, 1) == 29.7
