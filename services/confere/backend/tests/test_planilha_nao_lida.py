"""T-2034 a T-2036 — ESPEC 027: a âncora dos sessenta achados.

**A causa mais provável de "o layout mudou" é código deslocado de coluna**,
e essa causa produz uma cascata: `V-MED-01` bloqueia, e `V-MED-02` e
`V-CTR-05` — que leem do mesmo cabeçalho vazio e do mesmo conjunto de
códigos vazio — repetem a mesma falha por outros ângulos (ESPEC 027 §2.1).

O único teste deste arquivo nasceu como a âncora do `P0` — sessenta achados
contra o código intocado — e foi reancorado pela `T-2026` assim que a guarda de
`R-LEV-01` existiu, para um achado só. É o portão `P1`: sem a versão de sessenta
medida primeiro, a afirmação de que "sessenta viram um" não teria testemunha.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from conftest import FontesCaras, _ContainerComFontesEmCache

from infrastructure.di.container import Entradas


def test_planilha_deslocada_produz_um_achado_so_com_a_guarda(
    fontes_caras: FontesCaras, caminho_contrato: Path, caminho_codigos_deslocados: Path
) -> None:
    """`[portão P0]` — a âncora, contra o código intocado.

    **T-2026 — a reancoragem.** Medido em 2026-08-19 contra `f5c9f3d`, antes da
    guarda: **60** achados no piloto — 1 `V-MED-01`, 2 `V-MED-02`,
    57 `V-CTR-05`. A guarda de `R-LEV-01` (T-2037) leva isso a **um** achado
    só, `V-MED-01`, e nenhum aviso.

    Sobre o **dicionário de contagens por validação**, e não sobre o primeiro
    achado (regra 2 do TASKS 027 §1.1): com índice, uma guarda que suprimisse
    a validação errada ficaria verde do mesmo jeito.

    `_ContainerComFontesEmCache` evita os ~7 s de extração do PDF do piloto —
    o contrato já está em `fontes_caras`. O leitor de anexos que ele também
    substitui é indiferente aqui: com bloqueio, os anexos não são lidos.
    """
    resultado = _ContainerComFontesEmCache(fontes_caras).gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_codigos_deslocados)
    )
    contagem = Counter(a.validacao for a in resultado.achados.achados)
    assert contagem == {"V-MED-01": 1}
    assert resultado.achados.avisos == []


def test_o_arquivo_real_nao_estava_disponivel() -> None:
    """`[insumo I-39]` — T-2036.

    O degrau 2 da ESPEC 027 §2.3 é dedução do código-fonte — cinco colunas
    lidas — verificada em planilha sintética (`levantamento_codigos_deslocados.xlsx`).
    **Não foi visto o arquivo real** que motivou a espec. Registrado aqui para
    que a lacuna não se perca: se ele aparecer, passá-lo pelo diagnóstico da
    `T-2039` e conferir em qual degrau cai antes de a E3 escrever os textos —
    se cair no degrau 3, a prioridade das frases da ESPEC §8.1 muda.

    Não bloqueia nada: este teste só documenta a lacuna.
    """
    assert True
