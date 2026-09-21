"""Diagnóstico — por que uma linha de item não chegou a `contrato.itens`.

Só há **dois** caminhos de descarte silencioso na extração:

  A. a palavra cai fora de `[horizontais[0], horizontais[-1]]` e `_indice`
     devolve `None` — `ler_celulas` a joga fora, e a linha inteira some;
  B. `celulas[COL_CODIGO]` não casa `_CODIGO_EXATO` e o laço faz `continue`.

Este script mostra, por página, qual dos dois aconteceu: imprime `horizontais[0]`,
as palavras que ficaram acima dele, a faixa de divisórias escolhida por linha
(ESPEC 033 `R-FXA-01`) e as células como o extrator as viu.

Uso::

    python diagnosticar_linha_perdida.py <arquivo.pdf> [pagina]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# acha `backend/src` subindo a partir do cwd, para rodar da raiz ou de backend/
_aqui = Path.cwd().resolve()
for _c in (_aqui, *_aqui.parents):
    if (_c / "backend" / "src").is_dir():
        sys.path.insert(0, str(_c / "backend" / "src")); break
    if (_c / "src" / "infrastructure").is_dir():
        sys.path.insert(0, str(_c / "src")); break

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import pdfplumber  # noqa: E402
from infrastructure.contract.grid import (  # noqa: E402
    analisar_geometria,
    ler_celulas,
    montar_grade,
    verticais_por_linha,
)

CODIGO = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")


def limpar(t: str) -> str:
    return re.sub(r"\s+", " ", t or "").strip()


def main() -> int:
    caminho = Path(sys.argv[1])
    alvo = int(sys.argv[2]) if len(sys.argv) > 2 else None

    with pdfplumber.open(caminho) as pdf:
        geo = analisar_geometria(pdf)
        print(f"gabarito eleito : {geo.gabarito}")
        print(f"candidatas 7col : {len(geo.candidatos)}")
        for c in geo.candidatos:
            print(f"   paginas={c.paginas} codigos={c.codigos} vao={c.vao:.1f} {c.divisorias}")

        if geo.gabarito is None:
            return 1

        for numero, pagina in enumerate(pdf.pages, start=1):
            if alvo is not None and numero != alvo:
                continue
            print(f"\n───── página {numero} ─────")
            for divisorias in {c.divisorias for c in geo.candidatos}:
                grade = montar_grade(pagina, divisorias)
                if grade is None:
                    continue
                h = grade.horizontais
                print(f" geometria {divisorias}")
                print(f"   horizontais[0]={h[0]:.1f}  horizontais[-1]={h[-1]:.1f}  linhas={len(h) - 1}")

                # (A) o que a grade descarta por estar acima do primeiro traço
                acima = [
                    w
                    for w in pagina.extract_words()
                    if (w["top"] + w["bottom"]) / 2 < h[0]
                    and grade.verticais[0] <= w["x0"] < grade.verticais[-1]
                ]
                if acima:
                    print(f"   ACIMA DE horizontais[0] ({len(acima)} palavras — DESCARTADAS):")
                    print("     " + " ".join(w["text"] for w in acima[:40]))
                    if any(CODIGO.match(w["text"]) for w in acima):
                        print("     >>> HÁ CÓDIGO DE SERVIÇO AQUI: linha de item perdida (caminho A)")

                # (B) as células, como o extrator as vê
                por_linha = verticais_por_linha(pagina, grade)
                for i, celulas in enumerate(ler_celulas(pagina, grade, por_faixa=True)):
                    texto = " | ".join(limpar(c) for c in celulas)
                    if not texto.strip(" |"):
                        continue
                    cod = limpar(celulas[0])
                    marca = "  ITEM" if CODIGO.match(cod) else ""
                    if CODIGO.search(texto) and not CODIGO.match(cod):
                        marca = "  >>> CÓDIGO FORA DA COLUNA 0 (caminho B)"
                    faixa = "propria" if por_linha[i] != grade.verticais else "PAGINA"
                    print(f"   [{i:2d}] ({faixa}) {texto}{marca}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
