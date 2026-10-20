"""PDF cujo texto virou desenho — o contrato do HSPM (TC 094/2023), 20/10/2026.

O ``PC-HSPM-230207-13 v3.0`` foi impresso pelo "Microsoft: Print To PDF" com
as letras convertidas em contorno: 12 páginas, **0 caracteres** e ~40 mil
traços. A extração analisava cada traço (62 s e 275 MB aqui, ~10 min no Render
free) e terminava sem itens; a tela ficava parada em "Extraindo a tabela de
itens do contrato".

O que estes testes afirmam é a causa, não o cronômetro: o PDF sem fonte é
recusado **antes** de qualquer análise de página, com a mensagem que diz qual
arquivo trocar; e PDF com texto — inclusive o que o desenha por *Form XObject*
— segue o caminho de sempre.
"""

from __future__ import annotations

from pathlib import Path

import pdfplumber.page
import pytest
from fastapi.testclient import TestClient

from api.main import app
from domain.errors import ExtractionError
from infrastructure.di.container import Entradas, get_container
from infrastructure.shared.arquivos import pdf_sem_texto

FIXTURES = Path(__file__).parent / "fixtures"

_DESENHO = b"0 0 m 100 100 l 50 0 l h f"
_TEXTO = b"BT /F1 12 Tf 72 720 Td (14.049.00038.00) Tj ET"


def _pdf(conteudo_da_pagina: bytes, recursos: bytes, extras: list[bytes] | None = None) -> bytes:
    """Monta um PDF mínimo e válido (com xref) — sem binário de fixture."""
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources "
        + recursos
        + b" /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(conteudo_da_pagina)
        + conteudo_da_pagina
        + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        *(extras or []),
    ]
    saida = bytearray(b"%PDF-1.4\n")
    posicoes = []
    for numero, corpo in enumerate(objetos, start=1):
        posicoes.append(len(saida))
        saida += b"%d 0 obj\n" % numero + corpo + b"\nendobj\n"
    inicio_do_xref = len(saida)
    saida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for posicao in posicoes:
        saida += b"%010d 00000 n \n" % posicao
    saida += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objetos) + 1,
        inicio_do_xref,
    )
    return bytes(saida)


@pytest.fixture
def so_desenho(tmp_path: Path) -> Path:
    caminho = tmp_path / "contrato.pdf"
    caminho.write_bytes(_pdf(_DESENHO, b"<< >>"))
    return caminho


def test_pdf_so_com_desenho_nao_tem_texto(so_desenho: Path) -> None:
    assert pdf_sem_texto(so_desenho)


def test_pdf_com_fonte_tem_texto(tmp_path: Path) -> None:
    caminho = tmp_path / "com-texto.pdf"
    caminho.write_bytes(_pdf(_TEXTO, b"<< /Font << /F1 5 0 R >> >>"))
    assert not pdf_sem_texto(caminho)


def test_fonte_dentro_de_form_xobject_conta_como_texto(tmp_path: Path) -> None:
    formulario = (
        b"<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Length %d >>\nstream\n" % len(_TEXTO)
        + _TEXTO
        + b"\nendstream"
    )
    caminho = tmp_path / "form.pdf"
    caminho.write_bytes(_pdf(b"/X1 Do", b"<< /XObject << /X1 6 0 R >> >>", [formulario]))
    assert not pdf_sem_texto(caminho)


def test_arquivo_que_nao_e_pdf_fica_para_abrir_pdf(tmp_path: Path) -> None:
    caminho = tmp_path / "quebrado.pdf"
    caminho.write_bytes(b"isto nao e um pdf")
    assert not pdf_sem_texto(caminho)


@pytest.mark.parametrize(
    "documento", sorted(p.name for p in FIXTURES.glob("*.pdf"))
)
def test_os_contratos_reais_da_suite_tem_texto(documento: str) -> None:
    assert not pdf_sem_texto(FIXTURES / documento)


def test_geracao_recusa_antes_de_analisar_qualquer_pagina(
    so_desenho: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    analisadas: list[int] = []
    original = pdfplumber.page.Page.parse_objects

    def contado(self: pdfplumber.page.Page) -> object:
        analisadas.append(self.page_number)
        return original(self)

    monkeypatch.setattr(pdfplumber.page.Page, "parse_objects", contado)

    entradas = Entradas(
        contrato=so_desenho,
        levantamento=FIXTURES / "levantamento.xlsx",
        nome_do_contrato="PC-HSPM-230207-13 v3.0.pdf",
    )
    with pytest.raises(ExtractionError) as erro:
        get_container().gerar(entradas)

    mensagem = str(erro.value)
    assert "PC-HSPM-230207-13 v3.0.pdf" in mensagem
    assert "não tem texto" in mensagem
    assert analisadas == []


def test_aditivo_sem_texto_e_apontado_pela_posicao(tmp_path: Path, so_desenho: Path) -> None:
    contrato = tmp_path / "com-texto.pdf"
    contrato.write_bytes(_pdf(_TEXTO, b"<< /Font << /F1 5 0 R >> >>"))
    entradas = Entradas(
        contrato=contrato,
        levantamento=FIXTURES / "levantamento.xlsx",
        aditivos=(contrato, so_desenho),
    )
    with pytest.raises(ExtractionError, match="2º aditivo"):
        get_container().conferir_identidade(entradas)


def test_reports_responde_422_com_a_mensagem(so_desenho: Path) -> None:
    resposta = TestClient(app).post(
        "/reports",
        files={
            "contrato": ("PC-HSPM.pdf", so_desenho.read_bytes(), "application/pdf"),
            "levantamento": (
                "levantamento.xlsx",
                (FIXTURES / "levantamento.xlsx").read_bytes(),
                "application/octet-stream",
            ),
        },
    )
    assert resposta.status_code == 422
    assert "PC-HSPM.pdf" in resposta.json()["detail"]
