"""17/11/2026 — leitura da tabela de itens sem grade desenhada.

Achado no `PA-SPCine-211118-152` e medido no corpus ContratosReceita: 99 de
469 PC/PA (16 sem candidato de divisória nenhum, 83 com candidato errado —
`analisar_geometria` acha outra tabela de 8 divisórias, como o cronograma
físico-financeiro, e erra a tabela de itens) não têm a tabela de itens real
desenhada com borda nenhuma. É texto puro, alinhado por coluna.

Este módulo deriva a posição das colunas do **cabeçalho** da própria tabela
(CÓDIGO, DESCRIÇÃO, UNIDADE, PREÇO/UNITÁRIO, QTDE, PERÍODO, TOTAL) e a
fronteira entre linhas do **código** de cada item — sem depender de traço
nenhum —, e devolve o mesmo formato de linha que `ler_celulas` (grid.py) já
produz: uma lista de sete células por item, na ordem do catálogo. Caminho
paralelo, só tentado pelo extrator quando a grade falhou — nunca substitui
uma leitura que já funciona.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from domain.value_objects.service_code import PADRAO_EM_TEXTO

COLUNAS_DA_TABELA_DE_ITENS = 7

# R-COL-01 (header_grid) — o vocabulário fechado dos sete rótulos, na ordem
# fixa do catálogo (a mesma de `COL_CODIGO`..`COL_TOTAL` em
# `pdfplumber_extractor.py`). Lista fechada, decisão: três ou quatro palavras
# por rótulo, não um parser genérico de cabeçalho — o mesmo racional de
# `_VOCABULARIO_DE_ORGAO`.
_ROTULOS: tuple[re.Pattern[str], ...] = (
    re.compile(r"C[ÓO]DIGO"),
    re.compile(r"DESCRI[ÇC][ÃA]O"),
    re.compile(r"UNIDADE"),
    re.compile(r"PRE[ÇC]O|UNIT[ÁA]RIO"),
    re.compile(r"QTDE|QUANTIDADE"),
    re.compile(r"PER[ÍI]ODO"),
    re.compile(r"TOTAL"),
)

# Quantos pontos acima e abaixo da linha-âncora (CÓDIGO + DESCRIÇÃO na mesma
# altura) o cabeçalho pode se espalhar. Medido no PA-SPCine: PREÇO/PERÍODO/
# TOTAL vêm ACIMA da linha de CÓDIGO/DESCRIÇÃO/UNIDADE/QTDE, e (MÊS)/(R$)
# vêm ABAIXO — o cabeçalho embrulha em até três linhas.
ALTURA_DO_CABECALHO = 24.0

# Duas palavras contam como "a mesma linha visual" até esta diferença de
# `top`. Cobre o ruído de fonte/baseline entre palavras impressas juntas.
TOLERANCIA_MESMA_LINHA = 3.0

# Uma palavra que começa com numeração de seção (`5.3.`, `6.`, ou colada ao
# título — `5.2.SERVIÇOS`) na coluna do código não é item — é o início da
# seção seguinte, e fecha a tabela aqui. O que distingue de um código real
# (`NN.NNN.NNNNN.NN`) é o que vem depois do prefixo: numeração de seção é
# seguida de letra maiúscula ou do fim da palavra; código real é seguido de
# mais um dígito (`14.`, no código `14.048.00010.00`, falha nesta condição).
_NUMERACAO_DE_SECAO = re.compile(
    r"^\d{1,2}(?:\.\d{1,2}){0,2}\.?(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]|$)"
)

# Quanto a descrição do ÚLTIMO item de uma seção pode embrulhar sem
# fronteira de item seguinte nem de nova seção para fechá-la — limite
# declarado (R-COL-07 header_grid), cobre 6-7 linhas. Seção real cuja
# descrição for mais longa que isto sai truncada; não ocorre nos documentos
# medidos em 17/11/2026.
LIMITE_DA_ULTIMA_DESCRICAO = 80.0


@dataclass(frozen=True)
class CabecalhoAchado:
    """Um cabeçalho de tabela de itens achado por texto, sem grade."""

    topo: float
    base: float
    divisorias: tuple[float, ...]


def _rotulo_de(texto: str) -> str:
    return texto.strip().strip("()")


def _papeis_da_janela(palavras: list[dict[str, Any]]) -> dict[int, float] | None:
    """Para cada um dos sete rótulos, o `x0` da ocorrência mais à esquerda —
    ou `None` se algum dos sete não apareceu na janela."""
    melhores: dict[int, float] = {}
    for palavra in palavras:
        texto = _rotulo_de(palavra["text"])
        for papel, rotulo in enumerate(_ROTULOS):
            if rotulo.fullmatch(texto):
                x0 = palavra["x0"]
                if papel not in melhores or x0 < melhores[papel]:
                    melhores[papel] = x0
    return melhores if len(melhores) == COLUNAS_DA_TABELA_DE_ITENS else None


def achar_cabecalhos(pagina: Any) -> list[CabecalhoAchado]:
    """Todo cabeçalho de tabela de itens nesta página, achado por texto.

    A linha-âncora é CÓDIGO e DESCRIÇÃO na mesma altura visual — as duas
    sempre andam juntas no catálogo (R-COL-02 header_grid), e as outras cinco
    palavras do cabeçalho podem vir embrulhadas em linhas vizinhas
    (`ALTURA_DO_CABECALHO`). Devolve uma entrada por seção que repetir o
    cabeçalho — o `PA-SPCine-211118-152` tem duas na mesma página.
    """
    palavras = pagina.extract_words()
    codigos = [p for p in palavras if _ROTULOS[0].fullmatch(_rotulo_de(p["text"]))]
    descricoes = [p for p in palavras if _ROTULOS[1].fullmatch(_rotulo_de(p["text"]))]

    achados: list[CabecalhoAchado] = []
    vistos: set[float] = set()
    for codigo in codigos:
        if codigo["top"] in vistos:
            continue
        descricao = next(
            (
                d
                for d in descricoes
                if abs(d["top"] - codigo["top"]) < TOLERANCIA_MESMA_LINHA
            ),
            None,
        )
        if descricao is None:
            continue
        vistos.add(codigo["top"])

        janela = [p for p in palavras if abs(p["top"] - codigo["top"]) <= ALTURA_DO_CABECALHO]
        papeis = _papeis_da_janela(janela)
        if papeis is None:
            continue

        xs = [papeis[i] for i in range(COLUNAS_DA_TABELA_DE_ITENS)]
        if xs != sorted(xs):
            # R-COL-04 (header_grid) — a ordem das sete colunas é fixa no
            # catálogo; fora de ordem não é o cabeçalho que se procura.
            continue

        # R-COL-03 (header_grid) — a fronteira é a margem **antes do rótulo
        # seguinte**, não o ponto médio entre os dois. As colunas são largas
        # e o conteúdo é alinhado à esquerda: a descrição de um item comum
        # ocupa quase toda a largura até a coluna seguinte começar, e um
        # ponto médio simétrico corta texto real antes da fronteira
        # desenhada (medido no `PA-SPCine-211118-152`: "INFORMAÇÃO" da
        # descrição ficava 7 pt depois do ponto médio DESCRIÇÃO/UNIDADE).
        margem = 5.0
        divisorias = (
            xs[0] - margem,
            *(x - margem for x in xs[1:]),
            float(pagina.width),
        )
        base = max(
            p["bottom"]
            for p in janela
            if any(r.fullmatch(_rotulo_de(p["text"])) for r in _ROTULOS)
        )
        achados.append(CabecalhoAchado(topo=codigo["top"], base=base, divisorias=divisorias))

    return sorted(achados, key=lambda c: c.topo)


def _indice(valor: float, fronteiras: tuple[float, ...]) -> int | None:
    for i in range(len(fronteiras) - 1):
        if fronteiras[i] <= valor < fronteiras[i + 1]:
            return i
    return None


def _candidatos_de_codigo(
    palavras: list[dict[str, Any]], cabecalho: CabecalhoAchado, fim: float
) -> list[dict[str, Any]]:
    esquerda, direita = cabecalho.divisorias[0], cabecalho.divisorias[1]
    return sorted(
        (
            p
            for p in palavras
            if cabecalho.base <= p["top"] < fim and esquerda <= (p["x0"] + p["x1"]) / 2 < direita
        ),
        key=lambda p: p["top"],
    )


def _montar_linha(
    palavras: list[dict[str, Any]], divisorias: tuple[float, ...], inicio: float, fim: float
) -> list[str]:
    """As sete células de uma linha de item, no vão `[inicio, fim)`.

    Toda palavra no vão entra na sua coluna, a mesma regra de `ler_celulas`
    (grid.py) — inclusive as numéricas. Medido no `12.029.00008.00` do
    `PA-SPCine-211118-152`: o preço sai impresso numa linha de continuação
    da descrição, não na linha do código; restringir as colunas numéricas à
    primeira linha perderia exatamente esse valor.
    """
    celulas: list[list[dict[str, Any]]] = [[] for _ in range(len(divisorias) - 1)]
    for palavra in palavras:
        centro_y = (palavra["top"] + palavra["bottom"]) / 2
        if not (inicio <= centro_y < fim):
            continue
        coluna = _indice((palavra["x0"] + palavra["x1"]) / 2, divisorias)
        if coluna is None:
            continue
        celulas[coluna].append(palavra)
    return [
        " ".join(p["text"] for p in sorted(grupo, key=lambda p: (round(p["top"], 1), p["x0"])))
        for grupo in celulas
    ]


def ler_linhas_sem_grade(pagina: Any) -> list[list[str]]:
    """As linhas da tabela de itens desta página, sem grade desenhada.

    Mesmo formato de `ler_celulas` (grid.py): uma lista de sete células por
    linha, na ordem do catálogo. Vazia se a página não tiver cabeçalho
    nenhum, ou tendo, se nenhuma linha dele trouxer código de serviço.
    """
    palavras = pagina.extract_words()
    cabecalhos = achar_cabecalhos(pagina)
    linhas: list[list[str]] = []

    for indice, cabecalho in enumerate(cabecalhos):
        fim_da_secao = (
            cabecalhos[indice + 1].topo if indice + 1 < len(cabecalhos) else float(pagina.height)
        )
        candidatos = _candidatos_de_codigo(palavras, cabecalho, fim_da_secao)

        itens: list[dict[str, Any]] = []
        for candidato in candidatos:
            texto = candidato["text"].strip()
            if PADRAO_EM_TEXTO.fullmatch(texto):
                itens.append(candidato)
            elif _NUMERACAO_DE_SECAO.match(texto):
                # R-COL-05 (header_grid) — numeração de nova seção na coluna
                # do código fecha a tabela aqui: o que vem depois não é item.
                fim_da_secao = candidato["top"]
                break

        for posicao, item in enumerate(itens):
            e_ultimo = posicao + 1 == len(itens)
            fim_da_linha = (
                min(fim_da_secao, item["top"] + LIMITE_DA_ULTIMA_DESCRICAO)
                if e_ultimo
                else itens[posicao + 1]["top"]
            )
            linhas.append(_montar_linha(palavras, cabecalho.divisorias, item["top"], fim_da_linha))

    return linhas
