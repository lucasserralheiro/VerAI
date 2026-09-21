"""T-2320 / ESPEC 037 `D-07` — as âncoras de cabeçalho, transcritas da planilha.

Gerado, não editado à mão. São 19 tuplas com acento, asterisco, parêntese e `Nº`
— `Download*`, `Qtde RAM(GB)`, `COD. MPLS`, `ORGÃO SIGNATÁRIO` —, e transcrição
à mão erra. `anexos.json` continua sendo configuração humana: o que este script
dispensa é a digitação, não a revisão.

A âncora sai da fileira que `linha_cabecalho` aponta **no piloto**, que é onde a
ESPEC 004 §3 mediu aquele número. É essa coincidência que a `R-CAB-06` trava
depois, em teste: se a âncora daqui deixar de resolver o número de lá, uma das
duas está errada.

Uso::

    python scripts/transcrever_ancoras_de_cabecalho.py [--rotulos N]

Imprime o JSON pronto para colar em `anexos.json`, na ordem do catálogo.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "backend" / "src"))

from infrastructure.annex.configuracao import anexos_configurados  # noqa: E402
from infrastructure.measurement.aba_reader import AbaReader  # noqa: E402
from infrastructure.shared.arquivos import abrir_planilha_com_estilos  # noqa: E402

PILOTO = RAIZ / "backend" / "tests" / "fixtures" / "levantamento.xlsx"

# Três rótulos. **Um** já resolve as duas planilhas versionadas — medido —, e
# três é margem: o custo de discriminar é zero e o de não discriminar aparece na
# planilha do mês seguinte. Anexo cujo cabeçalho tem menos rótulos fica com os
# que tem (`Central de Servicos`, `WIFI`, `OutrosServicos`, `ServicosEmNuvem`).
ROTULOS_POR_ANCORA = 3


def rotulos_da_fileira(linha: tuple) -> list[str]:
    """Os textos, na ordem, **descartadas as células vazias**.

    Descartar é o que torna a âncora indiferente a mesclagem: o ``openpyxl``
    guarda o valor só na âncora da região mesclada, então ``Nome | · | · | ·``
    e ``Nome`` dão o mesmo rótulo. É o que faz a âncora de ``Office365`` valer
    tanto para o SMIT, onde ``Nome`` ocupa quatro colunas, quanto para uma
    planilha em que ocupe uma.
    """
    return [celula.texto.strip() for celula in linha if celula.texto.strip()]


def main() -> int:
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument("--rotulos", type=int, default=ROTULOS_POR_ANCORA)
    argumentos = analisador.parse_args()

    livro = abrir_planilha_com_estilos(PILOTO, "medição")
    leitor = AbaReader()
    saida: dict[str, list[str]] = {}
    try:
        for config in anexos_configurados():
            if config.aba not in livro.sheetnames:
                print(f"!! aba ausente do piloto: {config.aba}", file=sys.stderr)
                continue
            if config.linha_cabecalho is None:
                print(f"!! sem linha_cabecalho: {config.aba}", file=sys.stderr)
                continue
            forma = leitor.ler(livro[config.aba])
            indice = config.linha_cabecalho - 1
            if not 0 <= indice < len(forma.linhas):
                print(f"!! linha_cabecalho fora da aba: {config.aba}", file=sys.stderr)
                continue
            rotulos = rotulos_da_fileira(forma.linhas[indice])
            if not rotulos:
                print(f"!! fileira sem rótulos: {config.aba}", file=sys.stderr)
                continue
            saida[config.aba] = rotulos[: argumentos.rotulos]
    finally:
        livro.close()

    for aba, ancora in saida.items():
        print(f'"aba": "{aba}", "cabecalho": {json.dumps(ancora, ensure_ascii=False)}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())