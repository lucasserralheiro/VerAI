"""Extrai do relatório GRC a largura das colunas e a altura de linha de cada anexo.

O mesmo princípio do `layout.py`, agora para os anexos: **nada é arbitrado**. As
fronteiras de coluna e as alturas de linha saem dos retângulos de borda do PDF de
referência, que é o documento que hoje circula.

O resultado vai para `medidas_grc.json`, versionado ao lado do código. É gerado,
não editado à mão — e fica separado do `anexos.json`, que é configuração humana.

**Quando a medição é ambígua, ela é descartada.** As fronteiras vêm das bordas, e
uma coluna sem borda não produz fronteira: `Central de Servicos` tem 3 colunas na
planilha e 2 fronteiras no PDF. Nesses casos o anexo fica sem larguras medidas e
o renderizador cai na proporção da planilha, ajustada à largura total do GRC —
que continua sendo medida.

Uso:
    python scripts/medir_anexos_grc.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl
import pdfplumber

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "backend" / "src"))

from infrastructure.annex.configuracao import anexos_configurados  # noqa: E402
from infrastructure.measurement.aba_reader import AbaReader  # noqa: E402
from infrastructure.measurement.figuras import figuras_por_aba  # noqa: E402

GRC = (
    RAIZ
    / "docs"
    / "documentos"
    / "SMIT_SUSTENTACAO_Levantamento_05969_TC_52SMIT2024_15072026_101414_V2.0___GRC.pdf"
)
PLANILHA = RAIZ / "backend" / "tests" / "fixtures" / "levantamento.xlsx"
DESTINO = RAIZ / "backend" / "src" / "infrastructure" / "annex" / "medidas_grc.json"

# Primeira página de cada anexo no GRC — a mesma tabela de ESPEC 004 §3.
PRIMEIRA_PAGINA = {
    "Detalhes": 4,
    "DetalhesSemDesenv": 5,
    "Servidores": 6,
    "ServidoresSemDesenv": 7,
    "BD": 8,
    "Usuários": 9,
    "NAS": 25,
    "Central de Servicos": 26,
    "Colocation": 27,
    "Comunicação Dados": 28,
    "SDWAN": 29,
    "WIFI": 30,
    "CertificadosDigitais": 31,
    "Internet": 32,
    "SOA": 33,
    "OutrosServicos": 35,
    "Office365": 36,
    "ServicosVcloud": 40,
    "ServicosEmNuvem": 41,
}

# Duas fronteiras a menos de 1 pt são a mesma linha, desenhada duas vezes.
TOLERANCIA = 1.0


def _fronteiras(pagina: Any) -> tuple[list[float], list[float]]:
    horizontais = {round(r["x0"], 1) for r in pagina.rects} | {
        round(r["x1"], 1) for r in pagina.rects
    }
    verticais = {round(r["top"], 1) for r in pagina.rects} | {
        round(r["bottom"], 1) for r in pagina.rects
    }
    return sorted(horizontais), sorted(verticais)


def _intervalos(fronteiras: list[float]) -> list[float]:
    return [
        round(fim - inicio, 1)
        for inicio, fim in zip(fronteiras, fronteiras[1:], strict=False)
        if fim - inicio > TOLERANCIA
    ]


def _colunas_da_aba(livro: Any, aba: str) -> int:
    if aba not in livro.sheetnames:
        return 0
    return len(AbaReader().ler(livro[aba]).proporcoes)


def _imagens_da_aba(figuras: dict[str, Any], aba: str) -> int:
    return len(figuras.get(aba, ()))


def _imagens_impressas(pdf: Any, aba: str) -> list[list[float]]:
    """Tamanho com que cada figura sai impressa, na primeira pagina do anexo.

    O Excel estica a figura ao cola-la: o PNG de `ServicosEmNuvem` tem 1238 px
    de largura, que a 96 dpi dariam 929 pt, e o GRC imprime 516. Sem esta
    medida a figura sairia com quase o dobro da largura da pagina.
    """
    pagina = pdf.pages[PRIMEIRA_PAGINA[aba] - 1]
    return [
        [round(im["width"], 1), round(im["height"], 1)]
        for im in sorted(pagina.images, key=lambda i: i["top"])
    ]


def main() -> None:
    if not GRC.exists():
        sys.exit(f"relatorio de referencia nao encontrado: {GRC}")

    livro = openpyxl.load_workbook(PLANILHA, data_only=True)
    figuras = figuras_por_aba(PLANILHA)
    medidas: dict[str, dict[str, Any]] = {}
    descartadas = []

    with pdfplumber.open(GRC) as pdf:
        for config in anexos_configurados():
            pagina = pdf.pages[PRIMEIRA_PAGINA[config.aba] - 1]
            horizontais, verticais = _fronteiras(pagina)
            larguras = _intervalos(horizontais)
            alturas = _intervalos(verticais)

            registro: dict[str, Any] = {
                "largura_total_pt": round(horizontais[-1] - horizontais[0], 1),
                # A altura de linha e a moda: as faixas de titulo e os respiros
                # tem altura propria, e a linha de dados e a que se repete.
                "altura_linha_pt": Counter(alturas).most_common(1)[0][0] if alturas else None,
            }

            impressas = _imagens_impressas(pdf, config.aba)
            if impressas and len(impressas) == _imagens_da_aba(figuras, config.aba):
                registro["imagens_pt"] = impressas

            colunas = _colunas_da_aba(livro, config.aba)
            if colunas and len(larguras) == colunas:
                registro["larguras_pt"] = larguras
            else:
                descartadas.append(f"{config.aba} ({len(larguras)} medidas / {colunas} colunas)")

            medidas[config.aba] = registro

    livro.close()
    DESTINO.write_text(
        json.dumps(medidas, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    com_larguras = sum(1 for m in medidas.values() if "larguras_pt" in m)
    com_imagens = sum(1 for m in medidas.values() if m.get("imagens_pt"))
    print(
        f"[ok] {DESTINO.name}: {len(medidas)} anexos, {com_larguras} com larguras medidas, "
        f"{com_imagens} com figura"
    )
    if descartadas:
        print("     sem larguras (medicao ambigua, cai na proporcao da planilha):")
        for item in descartadas:
            print(f"       - {item}")


if __name__ == "__main__":
    main()
