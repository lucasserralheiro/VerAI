"""T-2326 / ESPEC 037 — onde está o cabeçalho de colunas de uma aba.

Função pura sobre `CelulaAnexo`: não abre planilha, não conhece configuração e
não sabe o que é um anexo. É o que permite testá-la com três linhas construídas
à mão, e é onde as duas decisões medidas da `D-02` ficam escritas.
"""

from __future__ import annotations

from domain.entities.annex import CelulaAnexo


def _rotulos(linha: tuple[CelulaAnexo, ...]) -> tuple[str, ...]:
    """Os textos da fileira, na ordem, **descartadas as vazias**.

    Descartar é o que torna a comparação indiferente a mesclagem: o ``openpyxl``
    guarda o valor só na âncora da região, então ``Nome | · | · | ·`` e ``Nome``
    dão o mesmo rótulo. É o que faz a âncora de `Office365` valer tanto para o
    SMIT, onde ``Nome`` ocupa quatro colunas, quanto para uma planilha em que
    ocupe uma.
    """
    return tuple(c.texto.strip().casefold() for c in linha if c.texto.strip())


def localizar_cabecalho(
    linhas: tuple[tuple[CelulaAnexo, ...], ...], ancora: tuple[str, ...]
) -> int | None:
    """A **primeira** fileira cujos rótulos **começam** pela âncora.

    As duas escolhas foram medidas nas 35 combinações aba×planilha, e as duas
    existem porque a alternativa quebraria abas que hoje estão certas:

    * **prefixo, não igualdade** — `BD` traz ``VOLUME GB | PERFIL`` no piloto e
      ``AMBIENTE | VOLUME GB | …`` no PGM. O mesmo cabeçalho, com uma coluna a
      mais. Igualdade devolveria ``None`` para uma aba correta;
    * **primeira, não única** — os rótulos se repetem dentro da aba, porque
      algumas têm um segundo bloco com a mesma tabela: `NAS` casa nas linhas 7
      e 40 do piloto, e 7 e 179 do PGM; `OutrosServicos` casa em 3, 7 e 11 do
      PGM. Exigir unicidade reprovaria três das 35, todas hoje corretas.

    Caixa e espaço nas pontas não separam; **acento e palavra, sim**. Dobrar
    acento criaria casamentos que ninguém pediu, e a medição diz que não é
    preciso.

    ``None`` quando não encontra — e aí o anexo sai **sem repetição**
    (`R-CAB-04`), nunca com "a linha que estiver lá".
    """
    if not ancora:
        return None
    chave = tuple(r.strip().casefold() for r in ancora)
    for indice, linha in enumerate(linhas):
        if _rotulos(linha)[: len(chave)] == chave:
            return indice
    return None