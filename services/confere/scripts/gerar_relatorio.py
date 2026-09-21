"""Gera o relatorio completo a partir dos tres arquivos do piloto.

Ate a API existir (E6), este e o ponto de entrada para inspecao manual.

Uso:
    python scripts/gerar_relatorio.py
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "backend" / "src"))

from infrastructure.di.container import DIContainer, Entradas  # noqa: E402

FIXTURES = RAIZ / "backend" / "tests" / "fixtures"
DESTINO = RAIZ / "saida" / "relatorio.docx"


def main() -> None:
    container = DIContainer()
    resultado = container.gerar(
        Entradas(
            contrato=FIXTURES / "contrato.pdf",
            levantamento=FIXTURES / "levantamento.xlsx",
        )
    )

    for achado in resultado.achados.achados:
        marca = "[BLOQUEIA]" if achado.severidade.value == "BLOQUEIA" else "[aviso]   "
        print(f"{marca} {achado.validacao}: {achado.mensagem}")

    if resultado.bloqueado or resultado.relatorio is None:
        sys.exit("\n[erro] achado bloqueante - nenhum PDF foi gerado.")

    caminho = container.renderizador().renderizar(resultado.relatorio, DESTINO)
    print(f"\n[ok] {caminho}")
    relatorio = resultado.relatorio
    print(
        f"     {len(relatorio.linhas)} linhas do contrato"
        f" + {len(relatorio.demais_itens)} do bloco final"
        f" = {relatorio.total_linhas}"
    )


if __name__ == "__main__":
    main()
