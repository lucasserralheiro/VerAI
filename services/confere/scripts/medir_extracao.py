"""T-2196 / ESPEC 033 — a régua da não-regressão da extração.

Extrai cada peça do corpus e imprime, por documento, o que **não pode mudar**::

    itens · total declarado · soma dos totais · blocos · geometrias · sha

O ``sha`` é o ``sha256`` da lista de tuplas ``(código, descrição, unidade,
quantidade, preço, meses, total, página)`` de **todos** os itens. É igualdade do
conjunto, e não amostra: o defeito que esta régua previne — uma linha fatiada
com as divisórias erradas — não aparece em item que alguém escolheria conferir.

**Por que script, e não teste.** Ele é rodado três vezes na ESPEC 033: antes de
qualquer código (`T-2197`), com o documento-alvo **ainda quebrando** (`T-2211`)
e no fim (`T-2216`). O estado do meio é o que teste nenhum aceita — e é
justamente o que prova que a leitura por faixa entregou o que promete antes de a
correção do sinal mascarar o resultado.

Uso::

    python scripts/medir_extracao.py                 # o corpus versionado
    python scripts/medir_extracao.py a.pdf b.pdf     # peças avulsas
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend" / "src"))

import pdfplumber
from infrastructure.contract.grid import analisar_geometria
from infrastructure.contract.pdfplumber_extractor import (
    PdfPlumberContractExtractor,
)

FIXTURES = RAIZ / "backend" / "tests" / "fixtures"

# O corpus versionado, na ordem da ESPEC 033 §8.2. Os documentos de
# `docs/documentos/` são os mesmos arquivos das fixtures e saem com o mesmo
# `sha` — a repetição é deliberada na espec, e aqui seria ruído.
CORPUS = (
    FIXTURES / "contrato.pdf",
    FIXTURES / "contrato_pgm.pdf",
    FIXTURES / "aditivo_pgm.pdf",
    FIXTURES / "modelo.pdf",
    FIXTURES / "amostra_sem_tabela.pdf",
    FIXTURES / "contrato_smul.pdf",
    FIXTURES / "aditivo_smul.pdf",
)


def medir(caminho: Path) -> dict[str, object]:
    """O que a extração daquela peça produz, reduzido ao que tem de ser estável."""
    extrator = PdfPlumberContractExtractor()

    with pdfplumber.open(caminho) as pdf:
        geometria = analisar_geometria(pdf)
        admitidas = len(extrator._geometrias_de_itens(pdf, geometria))

    try:
        contrato = extrator.extrair(caminho)
    except Exception as erro:  # noqa: BLE001 — a falha é resultado, não acidente
        return {"erro": f"{type(erro).__name__}: {erro}", "geometrias": admitidas}

    tuplas = [
        [
            str(item.codigo),
            item.descricao,
            item.unidade,
            str(item.quantidade),
            str(item.preco_unitario),
            str(item.meses),
            str(item.total_declarado),
            item.pagina,
        ]
        for item in contrato.itens
    ]
    return {
        "itens": len(tuplas),
        "total": str(contrato.total_declarado),
        "soma": str(contrato.soma_dos_totais),
        "blocos": [
            f"{bloco.rotulo}:{len(bloco.itens)}:{bloco.total_declarado}"
            for bloco in contrato.blocos
        ],
        "geometrias": admitidas,
        "sha": hashlib.sha256(
            json.dumps(tuplas, ensure_ascii=False).encode()
        ).hexdigest(),
    }


def main() -> int:
    analise = argparse.ArgumentParser(description=__doc__)
    analise.add_argument("pdf", nargs="*", type=Path, help="peças a medir")
    argumentos = analise.parse_args()

    caminhos = [Path(p) for p in argumentos.pdf] or list(CORPUS)

    for caminho in caminhos:
        if not caminho.exists():
            print(f"{caminho.name:24s} AUSENTE")
            continue

        medida = medir(caminho)
        if "erro" in medida:
            print(f"{caminho.name:24s} ERRO  {medida['erro']}")
            continue

        print(
            f"{caminho.name:24s} "
            f"itens={medida['itens']:3d}  "
            f"total={medida['total']:>15s}  "
            f"soma={medida['soma']:>15s}  "
            f"geom={medida['geometrias']}  "
            f"sha={str(medida['sha'])[:16]}"
        )
        for bloco in medida["blocos"]:  # type: ignore[union-attr]
            print(f"{'':24s}   bloco {bloco}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
