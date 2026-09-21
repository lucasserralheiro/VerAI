"""T-15 / T-17 — Reconstrução da grade da tabela de itens do contrato.

A tabela não é extraível por linha de texto: a descrição de um item ocupa três
a cinco linhas, com o código no meio delas. Extração por linha resolve 15 de 60
linhas, e ``extract_tables()`` resolve 58 de 60.

A grade, porém, está desenhada no PDF — em retângulos finos de 0,7 pt que
formam as bordas. Derivando as fronteiras desses traços e atribuindo cada
palavra à célula que a contém, a descrição multilinha cai naturalmente numa
única célula: não é preciso heurística de continuação.

**ESPEC 017 — de onde vêm as fronteiras.** Até aqui, as divisórias verticais
eram comparadas contra as coordenadas medidas no contrato-piloto, e um contrato
de outro órgão, com a tabela 17 pt à direita, não era lido de forma alguma.
Hoje o gabarito é descoberto no próprio documento (``derivar_gabarito``), por
duas propriedades do negócio — a tabela tem sete colunas e é onde estão os
códigos de serviço —, ligadas pela repetição do conjunto de divisórias entre as
páginas que ela ocupa. Igualdade exata, sem coordenada absoluta e sem
tolerância a calibrar.
"""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from domain.entities.contract import DiagnosticoDaGrade

# `R-GRD-01` — a tabela de itens tem sete colunas: código, descrição, unidade,
# preço unitário, quantidade, meses e total. É fato do negócio, e a **única**
# afirmação numérica que a descoberta da grade faz sobre o documento.
COLUNAS_DA_TABELA_DE_ITENS = 7
DIVISORIAS_DA_TABELA = COLUNAS_DA_TABELA_DE_ITENS + 1

# `R-GRD-09` — a geometria do contrato-piloto. **Não é mais o seletor da
# tabela**: até a ESPEC 017 ela era comparada contra cada página, e um contrato
# com a margem 17 pt à direita não era lido de forma alguma. Hoje serve de
# referência de conferência — é contra ela que `V-CTR-04` avisa que o documento
# submetido tem geometria diferente da conhecida.
COLUNAS_DA_TABELA = (34.5, 117.0, 262.5, 352.5, 403.5, 447.7, 498.0, 561.0)
TOLERANCIA = 1.5

_CODIGO_DE_SERVICO = re.compile(r"\b\d{2}\.\d{3}\.\d{5}\.\d{2}\b")

ESPESSURA_MAXIMA_DO_TRACO = 2.0
COMPRIMENTO_MINIMO_HORIZONTAL = 20.0
COMPRIMENTO_MINIMO_VERTICAL = 5.0

# T-2678 / ESPEC 045 `R-COL-02` — o vocabulário fechado que classifica o rótulo
# de uma célula de cabeçalho. Lista fechada, e é decisão (`D-02`): três
# palavras, não um parser genérico de cabeçalho — o mesmo racional de
# `_VOCABULARIO_DE_ORGAO` em `pdfplumber_extractor.py`.
_ROTULO_PRECO = re.compile(r"PRE[ÇC]O|UNIT[ÁA]RIO", re.I)
_ROTULO_QUANTIDADE = re.compile(r"QTDE|QUANTIDADE", re.I)
_ROTULO_PERIODO = re.compile(r"PER[ÍI]ODO|M[ÊE]S", re.I)


@dataclass(frozen=True)
class Grade:
    horizontais: list[float]
    verticais: list[float]

    @property
    def total_colunas(self) -> int:
        return len(self.verticais) - 1


def _fronteiras_horizontais(pagina: Any) -> list[float]:
    return sorted(
        {
            round(r["top"], 1)
            for r in pagina.rects
            if r["height"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["width"] > COMPRIMENTO_MINIMO_HORIZONTAL
        }
    )


def _candidatas_verticais(pagina: Any) -> list[float]:
    """T-1132 — toda divisória vertical desenhada, sem juízo sobre qual tabela.

    Separada do filtro porque ``_fronteiras_verticais`` precisa desta metade
    sozinha: é contra as candidatas cruas da página que cada coluna do gabarito
    procura a sua vizinha (``R-GRD-04``).

    **Lê apenas ``x0``, ``width`` e ``height``** — nunca ``bottom``. A recuperação
    de ``R-GRD-03`` é por página, e continua sendo: quem agrupa por faixa é
    ``_faixas_verticais``, e são coisas diferentes de propósito.
    """
    return sorted(
        {
            round(r["x0"], 1)
            for r in pagina.rects
            if r["width"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["height"] > COMPRIMENTO_MINIMO_VERTICAL
        }
    )


def _faixas_verticais(pagina: Any) -> dict[tuple[float, float], set[float]]:
    """T-1301 / ``R-ADT-08`` — os traços verticais agrupados pela faixa que ocupam.

    Cada linha da tabela é desenhada como um conjunto de traços que partilham o
    mesmo par ``(topo, base)``. **Agrupar por faixa antes de contar** é o que
    separa duas tabelas que dividem a página: a página é a *união* dos conjuntos,
    e a união de duas tabelas de sete colunas não tem oito divisórias — tem 11 na
    página 6 do ``PA-PGM-260304-715`` e 15 na 7 (ESPEC 019 §2.3).

    Sem isto, **nenhuma** página daquele aditivo responde a ``R-GRD-02`` e o
    documento inteiro se perde, calado. E não é azar: um aditivo é feito de blocos
    curtos, e bloco curto divide folha. A premissa *uma tabela de itens por
    página* sobreviveu três especs porque só havia propostas na amostra.

    É **estreitamento**, não afrouxamento: passa a exigir que as oito divisórias
    sejam contemporâneas na mesma linha desenhada, e não apenas coexistentes na
    página.
    """
    faixas: defaultdict[tuple[float, float], set[float]] = defaultdict(set)
    for r in pagina.rects:
        if (
            r["width"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["height"] > COMPRIMENTO_MINIMO_VERTICAL
        ):
            faixas[(round(r["top"], 1), round(r["bottom"], 1))].add(round(r["x0"], 1))
    return faixas


def _codigos_na_pagina(pagina: Any) -> int:
    """Quantos códigos de serviço distintos a página traz.

    É o desempate de ``R-GRD-02``, e a razão de ele existir: a geometria não
    distingue a tabela de itens de outras tabelas de sete colunas — a página 30
    do piloto tem oito divisórias e 85% da largura útil, contra 88% da tabela
    certa. O que as separa é onde estão os códigos de serviço.
    """
    return len(set(_CODIGO_DE_SERVICO.findall(pagina.extract_text() or "")))


@dataclass(frozen=True)
class _Candidato:
    """Um conjunto de divisórias que se repete, e o que se sabe sobre ele."""

    divisorias: tuple[float, ...]
    paginas: tuple[int, ...]
    codigos: int

    @property
    def vao(self) -> float:
        return self.divisorias[-1] - self.divisorias[0]


def _escolher_gabarito(candidatos: list[_Candidato]) -> tuple[float, ...] | None:
    """T-1133 / ``R-GRD-02`` — mais códigos de serviço; empatando, maior vão.

    Função à parte, com entrada de dados simples, para que o desempate possa ser
    provado sem abrir PDF nenhum. É o único ponto onde ``R-GRD-02`` pode falhar
    em silêncio: um ``max()`` por vão passa em todos os outros testes da ESPEC
    017 e escolhe a tabela errada.
    """
    if not candidatos:
        return None
    return max(candidatos, key=lambda c: (c.codigos, c.vao)).divisorias


@dataclass(frozen=True)
class GeometriaDoContrato:
    """O que uma única passada pelo PDF apura sobre a grade."""

    gabarito: tuple[float, ...] | None
    diagnostico: DiagnosticoDaGrade
    # T-1302 / `R-ADT-08` — **todas** as geometrias de sete colunas encontradas,
    # da mais promissora para a menos, com as páginas em que cada uma aparece.
    #
    # O `gabarito` acima continua sendo *a* escolhida por `R-GRD-02`, e é o que
    # `V-CTR-04` compara e o que `derivar_gabarito` devolve. Mas um documento pode
    # ter mais de uma tabela de itens — o aditivo do PGM tem três, com geometrias
    # distintas —, e quem extrai precisa da lista, não do campeão.
    #
    # As `paginas` viajam junto porque o crivo de admissão (`D-05`) é testado nas
    # páginas onde as faixas daquela geometria realmente estão. Testá-lo no
    # documento inteiro custaria uma releitura por candidata.
    candidatos: tuple[_Candidato, ...] = ()


def analisar_geometria(pdf: Any) -> GeometriaDoContrato:
    """T-1109 / T-1134 — deriva o gabarito e o diagnóstico na **mesma** passada.

    As duas coisas saem do mesmo laço de propósito: o diagnóstico de
    ``R-GRD-07`` precisa exatamente do que a derivação já olha — bordas,
    divisórias e presença de texto. Uma segunda leitura do PDF custaria tempo
    para reapurar o que já se sabia.

    A presença de texto é medida por ``pagina.chars`` e não por
    ``extract_text()``: o que interessa é *existe camada de texto?*, e a
    resposta está nos caracteres, sem pagar a análise de layout.
    """
    por_conjunto: defaultdict[tuple[float, ...], set[int]] = defaultdict(set)
    paginas = com_borda = com_texto = maior = 0

    for numero, pagina in enumerate(pdf.pages, start=1):
        paginas += 1
        if pagina.rects or pagina.lines or pagina.curves:
            com_borda += 1
        if pagina.chars:
            com_texto += 1

        # O diagnóstico continua contando por **página** (`R-GRD-07`): é o número
        # que diz a quem dá suporte que o documento tem tabela demais na folha —
        # foi ele que apontou as 15 divisórias da página 7 do aditivo.
        maior = max(maior, len(_candidatas_verticais(pagina)))

        # A descoberta, essa passou a ser por **faixa** (`R-ADT-08`).
        for divisorias in _faixas_verticais(pagina).values():
            if len(divisorias) == DIVISORIAS_DA_TABELA:
                por_conjunto[tuple(sorted(divisorias))].add(numero)

    # A contagem de códigos só é paga para os conjuntos candidatos — poucas
    # páginas —, e não para o documento inteiro.
    candidatos = [
        _Candidato(
            divisorias=conjunto,
            paginas=tuple(sorted(numeros)),
            codigos=sum(_codigos_na_pagina(pdf.pages[n - 1]) for n in sorted(numeros)),
        )
        for conjunto, numeros in por_conjunto.items()
    ]
    gabarito = _escolher_gabarito(candidatos)

    return GeometriaDoContrato(
        gabarito=gabarito,
        diagnostico=DiagnosticoDaGrade(
            paginas=paginas,
            paginas_com_borda=com_borda,
            maior_numero_de_divisorias=maior,
            paginas_com_texto=com_texto,
            gabarito=gabarito,
            # T-1916 / ESPEC 025 `R-DOC-01` — de graça: `candidatos` acabou de
            # ser montado, e `c.codigos` já foi pago pelo desempate de
            # `R-GRD-02`. `parece_proposta` fica de fora aqui e é composto pelo
            # extrator, que é quem lê a página 1.
            geometrias_candidatas=len(candidatos),
            codigos_nas_candidatas=tuple(
                c.codigos
                for c in sorted(candidatos, key=lambda c: (-c.codigos, -c.vao, c.divisorias))
            ),
        ),
        # Ordenadas pelo mesmo critério de `_escolher_gabarito`, para que a
        # primeira seja o `gabarito` e a leitura seja determinística.
        candidatos=tuple(
            sorted(candidatos, key=lambda c: (-c.codigos, -c.vao, c.divisorias))
        ),
    )


def derivar_gabarito(pdf: Any) -> tuple[float, ...] | None:
    """``R-GRD-02`` — descobre a geometria da tabela de itens no próprio PDF.

    O critério não usa coordenada absoluta nem tolerância relativa. Usa duas
    propriedades do negócio: a tabela tem sete colunas (``R-GRD-01``) e é onde
    estão os códigos de serviço.

    A ligação entre as duas é a **repetição**: o conjunto de oito divisórias da
    tabela de itens aparece **idêntico, valor por valor**, nas páginas que ela
    ocupa — três no piloto e três no ``PA-PGM``. Igualdade exata, nada a
    calibrar. As páginas restantes da tabela o **contêm**, junto com as
    divisórias do quadro de totais, e entram por ``R-GRD-03``.

    Devolve ``None`` quando nenhuma página tem oito divisórias; ``V-CTR-01``
    bloqueia em seguida, como sempre bloqueou.

    Acessor de ``analisar_geometria`` — existe porque a regra ``R-GRD-02`` é uma
    afirmação sobre o gabarito sozinho, e é assim que os testes a interrogam.
    """
    return analisar_geometria(pdf).gabarito


def _mais_proxima(candidatas: list[float], coluna: float) -> float | None:
    """A candidata mais próxima desta coluna, ou ``None`` se nenhuma estiver perto.

    Função à parte, e não um ``lambda`` no laço: com ``coluna`` como parâmetro
    não há captura de variável de laço para explicar a quem ler depois.
    """
    perto = [x for x in candidatas if abs(x - coluna) < TOLERANCIA]
    return min(perto, key=lambda x: abs(x - coluna)) if perto else None


def _fronteiras_verticais(pagina: Any, gabarito: tuple[float, ...]) -> list[float]:
    """``R-GRD-04`` — para cada coluna esperada, a candidata mais próxima.

    **A direção da pergunta é o defeito.** O filtro anterior perguntava *"esta
    candidata está perto de alguma coluna?"* e guardava todas as que estivessem,
    para depois exigir que sobrassem oito. Bastava o quadro de totais ter uma
    divisória a 0,7 pt de uma coluna da tabela de itens — é o caso da página 25
    do ``PA-PGM`` — para a contagem virar nove e a página inteira ser
    descartada, com o ``TOTAL:`` dentro (ESPEC 017 §2.3).

    Perguntando *"esta coluna tem candidata perto?"*, duas candidatas para a
    mesma coluna resolvem-se pela distância, e a contagem é oito por construção.
    Devolve vazio quando alguma coluna fica sem candidata: uma grade parcial não
    significa nada.
    """
    candidatas = _candidatas_verticais(pagina)
    escolhidas: list[float] = []
    for coluna in gabarito:
        escolhida = _mais_proxima(candidatas, coluna)
        if escolhida is None:
            return []
        escolhidas.append(escolhida)
    return escolhidas


def _topo_da_linha_de_item(
    orfas: list[Any], verticais: list[float]
) -> float | None:
    """T-2272 / ESPEC 035 ``R-GRD-11`` e ``R-GRD-12`` — a fronteira que falta em cima.

    Recebe as palavras que caem no vão da tabela e **acima** da primeira borda
    desenhada, e responde uma coisa só: *isto é uma linha de item?* Sendo, devolve
    onde a fronteira superior deve ser sintetizada; não sendo, ``None``.

    Função à parte, com entrada de dados simples, para que o crivo possa ser
    provado sem abrir PDF nenhum — no lugar e no espírito de ``_escolher_gabarito``
    (ESPEC 017) e de ``_faixa_mais_estreita`` (ESPEC 033). É o único ponto onde
    ``R-GRD-11`` pode falhar em silêncio, e falhar aqui significa **inventar uma
    linha de item a partir de prosa**.

    ── O crivo é o código de serviço na coluna do código ──────────────────────

    Acima da grade moram três coisas, e só uma delas é linha de item:

    ==========================  =======  ====================================
    documento e página          órfãs    o que é
    ==========================  =======  ====================================
    ``contrato.pdf`` p25            177  prosa sobre SOA
    ``contrato_pgm.pdf`` p22        214  marcadores sobre VPN
    ``aditivo_pgm.pdf`` p6          138  título de seção e explicação
    ``contrato.pdf`` p27/p28       7/10  cauda de descrição — ESPEC 032
    ``PA-FTM-251001-143`` p7         16  **a linha 14.031.00018.00**
    ==========================  =======  ====================================

    Medido no corpus: das nove páginas que imprimem acima da grade, **zero** têm
    código de serviço entre as órfãs — em qualquer coluna. O crivo não chega perto
    de disparar onde não deve, e é isso que faz esta espec não mover um ``sha``.

    **A cauda continua sendo da ESPEC 032, e não briga com esta.** O crivo de lá é
    *tudo na coluna de descrição*; o daqui é *código na coluna do código*. Uma
    linha de item reprova o primeiro por construção — tem código na coluna 0 —, e
    é exatamente por isso que ela sumia calada. Os dois crivos são
    complementares, e a ordem (``R-CON-06``) sai de graça: sintetizada a fronteira,
    ``cauda_da_pagina`` não vê órfã nenhuma.

    ── É tudo ou nada (``R-GRD-12``) ─────────────────────────────────────────

    **Um código só.** Dois códigos são duas linhas, e duas linhas precisam da
    fronteira entre elas — que não está desenhada e não se adivinha.

    **E nada acima da linha do código.** Um bloco que traga cauda de descrição
    *e* linha de item juntaria as duas na mesma célula e produziria descrição que
    **parece** certa, num documento que vai ao órgão. É a ``D-02`` da ESPEC 032
    pelo mesmo motivo: *degradado* é melhor que *errado*. Não ocorre em peça
    nenhuma; recusar custa o comportamento de hoje.
    """
    codigos = [
        palavra
        for palavra in orfas
        if _CODIGO_DE_SERVICO.fullmatch(palavra["text"])
        and _indice((palavra["x0"] + palavra["x1"]) / 2, verticais) == 0
    ]
    if len(codigos) != 1:
        return None

    # A linha visual do código, e não a caixa dele: `top` é o alto da caixa, e
    # comparar centro contra `top` tolera as diferenças de linha de base entre
    # fontes da mesma linha impressa.
    codigo = codigos[0]
    if any((p["top"] + p["bottom"]) / 2 < codigo["top"] for p in orfas):
        return None

    # O mesmo `+ 1.0` da síntese de rodapé, pelo mesmo motivo: a fronteira precisa
    # ficar **fora** da caixa das palavras para que `_indice` as encontre dentro.
    return float(min(p["top"] for p in orfas)) - 1.0


def montar_grade(pagina: Any, gabarito: tuple[float, ...]) -> Grade | None:
    """Devolve a grade da tabela de itens, ou ``None`` se a página não a contiver.

    O ``gabarito`` vem de ``derivar_gabarito`` e é derivado do próprio documento
    (``D-04``): a decisão de *qual é a geometria* precisa de visão do PDF
    inteiro, e esta função só vê uma página.
    """
    verticais = _fronteiras_verticais(pagina, gabarito)
    horizontais = _fronteiras_horizontais(pagina)

    # T-1107 — a contagem passou a ser responsabilidade de quem casa:
    # `_fronteiras_verticais` devolve oito ou nada. Conferi-la aqui de novo
    # seria a mesma verificação em dois lugares, e o dia em que discordarem
    # seria um dia perdido.
    if not verticais or not horizontais:
        return None

    # A moldura não fecha no rodapé: a última linha de cada página fica abaixo
    # da última borda horizontal. Sem este limite sintético ela é descartada —
    # foi assim que 12.074.00005.00 e 14.048.00008.00 se perderam nas
    # abordagens anteriores (ESPEC 001 §9.4).
    limite = horizontais[-1]
    orfas = [
        p
        for p in pagina.extract_words()
        if (p["top"] + p["bottom"]) / 2 >= limite and verticais[0] <= p["x0"] < verticais[-1]
    ]
    if orfas:
        horizontais = [*horizontais, max(p["bottom"] for p in orfas) + 1.0]

    # T-2272 / ESPEC 035 `R-GRD-11` — **e a moldura também não fecha no topo.**
    #
    # A síntese de rodapé acima é da ESPEC 001 §9.4. A de cima nunca foi escrita,
    # e não por decisão: nenhuma peça da amostra tinha linha de item acima da
    # primeira fronteira desenhada, até o `PA-FTM-251001-143`.
    acima = [
        p
        for p in pagina.extract_words()
        if (p["top"] + p["bottom"]) / 2 < horizontais[0]
        and verticais[0] <= p["x0"] < verticais[-1]
    ]
    topo = _topo_da_linha_de_item(acima, verticais)
    if topo is not None:
        horizontais = [topo, *horizontais]

    return Grade(horizontais=horizontais, verticais=verticais)


def cauda_da_pagina(pagina: Any, grade: Grade, coluna_da_descricao: int) -> str:
    """ESPEC 032 `R-CON-01` / `R-CON-02` — a cauda que a página anterior deixou.

    Uma linha de item que atravessa a quebra de página tem o resto impresso no
    **topo da página seguinte**, acima de `horizontais[0]`. `ler_celulas`
    distribui palavras pelo centro e descarta o que cai fora das fronteiras: o
    pedaço não pertence a linha nenhuma **desta** página, e não há quem o devolva
    à anterior. Foram três descrições cortadas em dois contratos, uma delas
    terminando na palavra `PERFIL`, antes da letra.

    Devolve **texto ou vazio**, e não `None` com significado: *"não há cauda"* e
    *"a cauda é vazia"* são o mesmo fato para quem chama.

    ── O crivo, e por que ele existe ────────────────────────────────────────

    Acima da grade também moram prosa de outra seção e títulos de seção. A regra
    ingênua — *"o que está acima pertence à linha anterior"* — anexaria **177
    palavras sobre SOA** a uma descrição contratual no piloto, e 214 no PGM.
    Trocaria descrição cortada por descrição adulterada, num documento que vai ao
    órgão: pior que o defeito que ela corrige.

    O discriminador é a **coluna**, medido nos seis casos reais dos três
    documentos:

    ==========================  =======  ============================
    documento e página          fora     o que é
    ==========================  =======  ============================
    `contrato.pdf` p27                0  cauda do `12.074.00005.00`
    `contrato.pdf` p28                0  cauda do `14.048.00008.00`
    `contrato_pgm.pdf` p23            0  cauda do `12.074.00005.00`
    `contrato.pdf` p25              110  prosa sobre SOA
    `contrato_pgm.pdf` p22          117  marcadores sobre VPN
    `aditivo_pgm.pdf` p6             93  título de seção e explicação
    ==========================  =======  ============================

    Zero contra 93. **Nenhum valor intermediário**, e a separação não depende de
    conteúdo, fonte nem tamanho — só das fronteiras que a ESPEC 017 derivou do
    próprio documento.

    **Por título não; por limiar também não** (`D-01`). *"A tabela começa perto do
    topo, logo o que está acima é continuação"* funciona nos números de hoje —
    55,5 contra 624,7 — e o PGM já tem 78,5. A fronteira entre 78,5 e 329,2 é um
    número que ninguém escolheu, e é a espécie de constante que envelhece sem
    avisar.

    **É tudo ou nada** (`D-02`). Havendo **uma** palavra fora da coluna, nada é
    tomado. Selecionar *"as que estão dentro"* e descartar o resto colaria metade
    de um parágrafo — e a p6 do aditivo **tem** palavras na coluna de descrição.

    A ordem é a de leitura — `top`, depois `x0` —, **a mesma de `ler_celulas`**.
    Reinventá-la aqui poria a mesma decisão em dois lugares, e ela importa: a
    cauda do `12.074.00005.00` tem duas linhas visuais, e trocá-las produz texto
    que *parece* certo.
    """
    topo = grade.horizontais[0]
    esquerda, direita = grade.verticais[0], grade.verticais[-1]

    soltas = [
        palavra
        for palavra in pagina.extract_words()
        if (palavra["top"] + palavra["bottom"]) / 2 < topo
        and esquerda <= palavra["x0"] < direita
    ]
    if not soltas:
        return ""

    inicio = grade.verticais[coluna_da_descricao]
    fim = grade.verticais[coluna_da_descricao + 1]
    if any(not (inicio <= palavra["x0"] < fim) for palavra in soltas):
        return ""

    return " ".join(
        palavra["text"]
        for palavra in sorted(soltas, key=lambda p: (round(p["top"], 1), p["x0"]))
    )


def _faixa_mais_estreita(
    faixas: dict[tuple[float, float], list[float]], topo: float, base: float
) -> list[float] | None:
    """A faixa desenhada que cobre esta linha; havendo mais de uma, a menor.

    **A folga é a espessura do traço, e não uma tolerância a calibrar**
    (``R-FXA-05``). A fronteira horizontal é lida em ``top`` (``_fronteiras_horizontais``)
    e o traço vertical começa na **base** daquela borda: no piloto a linha é
    ``57,0–99,0`` e a faixa que a desenha é ``57,7–99,7``. Exigir coincidência
    exata faria nenhuma linha achar a sua faixa, e todo documento cairia na grade
    da página — sem erro e sem correção.

    ``R-FXA-02`` — entre duas faixas que cobrem, vale a **mais estreita**. Uma
    tabela desenhada com moldura externa *e* traço por linha teria as duas, e a
    externa é a que não sabe nada sobre aquela linha. Não ocorre nos documentos
    de hoje; é limite declarado.
    """
    cobrem = [
        (fim - inicio, divisorias)
        for (inicio, fim), divisorias in faixas.items()
        if inicio <= topo + ESPESSURA_MAXIMA_DO_TRACO
        and fim >= base - ESPESSURA_MAXIMA_DO_TRACO
    ]
    return min(cobrem, key=lambda par: par[0])[1] if cobrem else None


def verticais_por_linha(
    pagina: Any, grade: Grade, geometrias: Sequence[tuple[float, ...]] = ()
) -> list[list[float] | None]:
    """T-2207 / ESPEC 033 ``R-FXA-01`` — as divisórias que valem em cada linha.

    Até a ESPEC 033 a grade era **da página**: as verticais de uma geometria
    valiam para todas as linhas da folha. A descoberta já era por faixa desde a
    ESPEC 019 (``R-ADT-08``, ``_faixas_verticais``); a **leitura** não era, e
    essa metade só passou a decidir quando apareceu um documento com tabelas de
    larguras diferentes na mesma página.

    ── O documento que exigiu isto ───────────────────────────────────────────

    Página 4 do ``PA-SMUL-250314-22``, quatro tabelas de sete colunas::

        y  28,5– 80,7  Inclusão     …  299.7  379.5  429.3  462.9  515.1
        y  80,7–201,3  Inclusão     …  299.7  378.9  428.7  462.3  515.1
        y 258,3–363,9  Redução      …  299.7  343.5  378.9  428.7  516.9
        y 418,5–561,3  Aumento      …  299.7  343.5  378.9  431.7  515.1

    As candidatas verticais da página são a **união** das quatro, e nela toda
    coluna de toda geometria tem correspondência exata — ``montar_grade`` casa
    para as quatro na folha inteira, e ``TOLERANCIA`` nem chega a ser exercida.
    A grade da ``Inclusão`` então lê a linha da ``Redução`` sem o corte em
    ``343,5`` (preço e quantidade saem fundidos) e com um corte em ``462,9`` que
    cai dentro da coluna de total, 0,7 pt à direita do sinal.

    ── A regra, em quatro degraus ─────────────────────────────────────────────

    1. a faixa de oito desenhada que cobre a linha (``R-FXA-01``, ``R-FXA-02``);
    2. não havendo, as da linha anterior — **se os traços desta linha forem
       subconjunto delas** (``R-FXA-03``);
    3. não havendo, e a linha **tem** traços próprios que não pertencem a
       nenhuma geometria de item admitida no documento: a linha não é lida —
       zero células, não uma linha malformada (``R-FXA-09``, ESPEC 041);
    4. senão, as da página: o comportamento de sempre (``R-FXA-04``/``R-FXA-10``).

    ── T-2629 / ESPEC 041 ``R-FXA-09`` — o degrau 3 é novo ───────────────────

    O ``PC-CGM-240603-82`` tem, na mesma página, uma tabela de **escopo** — só
    código, descrição, unidade e quantidade — e, mais abaixo, a tabela de
    preços. Uma linha de escopo não tem faixa própria de oito nem herda de
    nenhuma; até aqui caía no degrau 4 e era lida com as colunas da tabela de
    preços — e falhava exigindo ``preço unitário``/``valor total`` que aquela
    linha nunca teve.

    O degrau novo pergunta, antes do 4: os traços **próprios** da linha — se
    ela tiver algum — pertencem à união das geometrias que ``_geometrias_de_itens``
    admitiu para este documento? Não pertencendo, a linha é de outra tabela, e
    não produz coluna nenhuma. **A comparação é contra a união, e não contra
    uma única geometria** (``D-01``): medido no ``aditivo_pgm.pdf``, duas
    linhas têm traços que não batem com a geometria escolhida como gabarito,
    mas pertencem a uma **segunda** geometria legitimamente admitida na mesma
    página — comparar só contra uma delas as rejeitaria.

    **Sem ``geometrias``, o degrau novo não se aplica** — mesmo padrão de
    ``por_faixa=False`` em :func:`ler_celulas`: o parâmetro tem valor-padrão
    vazio, e o comportamento de quem chama sem conhecê-lo não muda.

    **O degrau 2 existe pela linha ``TOTAL:``**, que é desenhada com células
    mescladas e traz dois traços, não oito. Sem ele, o ``Redução TOTAL:`` sairia
    lido pela grade da página como ``['…', 'Redução TOTAL:', '-986.810,00',
    'BRL']`` — o valor à esquerda da moeda, porque quebra para a segunda linha
    visual —, ``_total_declarado`` devolveria ``None``, o bloco não fecharia e o
    seu item migraria para o bloco seguinte sob o rótulo errado.

    **E a herança é por subconjunto, e não por proximidade.** *"Vale a última
    linha que teve divisórias"* atravessaria a fronteira entre duas tabelas
    empilhadas. O teste é fato do desenho: os traços do ``Redução TOTAL:`` são
    ``{428,7 · 516,9}``, e ``516,9`` **não existe** no conjunto da ``Inclusão``,
    que é a tabela imediatamente acima na folha.

    ── O que esta função não decide ──────────────────────────────────────────

    **Quais páginas entram** continua sendo de ``montar_grade`` / ``R-GRD-03``, e
    **quais geometrias entram** continua sendo do crivo de ``R-ADT-08``
    (``R-FXA-06``). O conjunto de linhas lidas é exatamente o de antes; muda só
    como cada uma é fatiada em células — e é isso que torna a não-regressão
    verificável por igualdade em vez de por argumento.
    """
    faixas = {chave: sorted(x) for chave, x in _faixas_verticais(pagina).items()}
    de_oito = {
        chave: divisorias
        for chave, divisorias in faixas.items()
        if len(divisorias) == DIVISORIAS_DA_TABELA
    }
    # `R-FXA-09` — a união de toda coluna de toda geometria que o documento usa
    # para item. Vazia quando `geometrias` não é passado, e é o que faz o
    # degrau novo não se aplicar (comparação contra conjunto vazio nunca é
    # `True` para `tracos` não vazio — por isso a guarda `geometrias and` abaixo,
    # explícita, em vez de depender desse acaso aritmético).
    uniao_das_geometrias = {x for geometria in geometrias for x in geometria}

    por_linha: list[list[float] | None] = []
    anterior: list[float] | None = None

    for indice in range(len(grade.horizontais) - 1):
        topo, base = grade.horizontais[indice], grade.horizontais[indice + 1]

        propria = _faixa_mais_estreita(de_oito, topo, base)
        if propria is not None:
            anterior = propria
            por_linha.append(propria)
            continue

        # Os traços que a **própria** linha desenha: é sobre eles que a
        # pertinência de `R-FXA-03` é decidida. Linha sem traço nenhum — o branco
        # entre dois blocos — não herda: não há o que conferir.
        tracos = {
            x
            for (inicio, fim), divisorias in faixas.items()
            if inicio <= topo + ESPESSURA_MAXIMA_DO_TRACO
            and fim >= base - ESPESSURA_MAXIMA_DO_TRACO
            for x in divisorias
        }
        if anterior is not None and tracos and tracos <= set(anterior):
            por_linha.append(anterior)
        elif geometrias and tracos and not (tracos <= uniao_das_geometrias):
            # `R-FXA-09` — traços de uma tabela que não é de item. `R-FXA-10`:
            # linha sem traço nenhum não cai aqui, e segue para o degrau de
            # sempre.
            por_linha.append(None)
        else:
            por_linha.append(grade.verticais)

    return por_linha


def _indice(valor: float, fronteiras: list[float]) -> int | None:
    for i in range(len(fronteiras) - 1):
        if fronteiras[i] <= valor < fronteiras[i + 1]:
            return i
    return None


def palavras_fora_da_grade(pagina: Any, grade: Grade) -> int:
    """T-2260 / ESPEC 035 ``R-GRD-10`` — o que a grade viu e não guardou.

    ``ler_celulas`` descarta em silêncio a palavra cujo centro cai fora de
    ``[horizontais[0], horizontais[-1]]``: ``_indice`` devolve ``None`` e o laço
    segue. É um dos dois caminhos por onde uma linha de item some sem erro e sem
    registro — e era o único **sem nenhum rastro** (ESPEC 035 §2.2).

    Esta função conta esse descarte. Não o corrige e não o julga: quem separa
    cauda de prosa de linha de item é ``cauda_da_pagina`` e ``R-GRD-11``, cada um
    com o seu crivo. Aqui só se responde *"quantas palavras a grade viu passar?"*.

    **Função irmã, e não um segundo retorno de ``ler_celulas``** (``R-FXA-06``).
    ``ler_celulas`` é chamada também por ``_linhas``, que serve o crivo de
    admissão de geometrias — e o crivo **não quer a contagem**. Mudar a
    assinatura para carregá-la alcançaria a decisão de quais geometrias entram,
    que esta espec não toca.

    ── O que entra na conta ──────────────────────────────────────────────────

    O vão é o da **tabela** — de ``verticais[0]`` a ``verticais[-1]``, medido em
    ``x0``, como em ``cauda_da_pagina`` —, e o teste é o de **linha**, medido no
    centro, como em ``ler_celulas``. As duas metades são emprestadas de quem já
    decide cada uma; nenhuma é inventada aqui.

    **Palavra que acha linha e não acha coluna fica de fora da conta.** Só
    ocorreria com palavra mais larga que a última coluna, e misturá-la aqui faria
    o número deixar de ter uma leitura só. É limite declarado, não descuido.
    """
    esquerda, direita = grade.verticais[0], grade.verticais[-1]
    return sum(
        1
        for palavra in pagina.extract_words()
        if esquerda <= palavra["x0"] < direita
        and _indice((palavra["top"] + palavra["bottom"]) / 2, grade.horizontais) is None
    )


def ler_celulas(
    pagina: Any,
    grade: Grade,
    por_faixa: bool = False,
    geometrias: Sequence[tuple[float, ...]] = (),
) -> list[list[str]]:
    """Distribui as palavras da página nas células da grade.

    Cada palavra é atribuída pela posição do seu centro, e não pela borda: uma
    palavra que encoste na divisória cairia na coluna errada se comparada por
    ``x0``.

    ``por_faixa`` (T-2208 / ESPEC 033 ``R-FXA-01``) manda usar, em cada linha, as
    divisórias desenhadas naquela faixa — ``verticais_por_linha``. **O padrão é o
    comportamento de sempre**, e é deliberado: o crivo de admissão de geometrias
    (``_linhas`` → ``_e_item_completo``) tem de continuar respondendo a pergunta
    de hoje, do jeito de hoje.

    Não é preferência de estilo. Medido: com divisórias por linha, o crivo
    aprovaria **todas** as candidatas — 2 de 2 no piloto, 2 de 2 no PGM, 4 de 4
    no aditivo do PGM, 5 de 5 no SMUL —, inclusive a geometria do cronograma
    físico-financeiro que a ESPEC 019 §2.5 barrou por medição (``R-FXA-06``).

    ``geometrias`` (T-2630 / ESPEC 041 ``R-FXA-09``) só tem efeito com
    ``por_faixa=True``: é a união repassada a ``verticais_por_linha``. Uma
    linha que ela devolva como pertencente a outra tabela (``None``) não
    produz célula — a palavra é ignorada, no mesmo caminho que já ignora
    palavra fora da grade.
    """
    celulas: defaultdict[int, defaultdict[int, list[Any]]] = defaultdict(
        lambda: defaultdict(list)
    )
    divisorias = verticais_por_linha(pagina, grade, geometrias) if por_faixa else None

    for palavra in pagina.extract_words():
        centro_x = (palavra["x0"] + palavra["x1"]) / 2
        centro_y = (palavra["top"] + palavra["bottom"]) / 2
        linha = _indice(centro_y, grade.horizontais)
        if linha is None:
            continue
        verticais = grade.verticais if divisorias is None else divisorias[linha]
        if verticais is None:
            continue
        coluna = _indice(centro_x, verticais)
        if coluna is not None:
            celulas[linha][coluna].append(palavra)

    linhas: list[list[str]] = []
    for indice in sorted(celulas):
        linhas.append(
            [
                " ".join(
                    p["text"]
                    for p in sorted(
                        celulas[indice].get(coluna, []),
                        key=lambda p: (round(p["top"], 1), p["x0"]),
                    )
                )
                for coluna in range(grade.total_colunas)
            ]
        )
    return linhas


def classificar_rotulo_de_coluna(texto: str) -> str | None:
    """T-2678 / ESPEC 045 `R-COL-02` — o papel que um rótulo de cabeçalho declara.

    Devolve ``"preco"``, ``"quantidade"`` ou ``"meses"`` quando o texto casa o
    vocabulário fechado; ``None`` quando não casa nenhum, ou quando casa mais
    de um — um rótulo ambíguo não decide sozinho, e é `resolver_papel_das_colunas`
    quem sabe pedir três colunas distintas.

    Função pura, sobre texto já extraído — nada de coordenada nem de PDF. É a
    mesma classe de `_escolher_gabarito` (ESPEC 017): entrada de dados simples,
    provável sem abrir arquivo nenhum.
    """
    achados = {
        papel
        for papel, padrao in (
            ("preco", _ROTULO_PRECO),
            ("quantidade", _ROTULO_QUANTIDADE),
            ("meses", _ROTULO_PERIODO),
        )
        if padrao.search(texto)
    }
    return achados.pop() if len(achados) == 1 else None


def resolver_papel_das_colunas(pendentes: dict[int, list[str]]) -> dict[str, int] | None:
    """T-2678 / ESPEC 045 `R-COL-04` — o papel das colunas 3, 4 e 5, a partir do
    que se acumulou desde a última linha de item.

    Cada chave de ``pendentes`` é o índice de uma coluna (3, 4 ou 5); o valor é
    a lista de fragmentos de texto que caíram nela desde a linha de item
    anterior — um cabeçalho pode vir numa linha só (``"PREÇO UNITÁRIO (R$)"``)
    ou quebrado em duas (``"Quantidade"`` numa, ``"Contratado"`` na seguinte).

    Devolve o mapeamento ``{"preco": ..., "quantidade": ..., "meses": ...}``
    só quando as três colunas classificam, cada uma, a um papel **distinto**
    (`classificar_rotulo_de_coluna`); em qualquer outro caso — coluna sem
    rótulo reconhecido, dois papéis iguais, papel repetido — devolve ``None``,
    e quem chama mantém o papel que já estava ativo (`R-COL-04`, `D-04`).
    """
    papeis: dict[str, int] = {}
    for coluna, fragmentos in pendentes.items():
        papel = classificar_rotulo_de_coluna(" ".join(fragmentos))
        if papel is None:
            continue
        if papel in papeis:
            return None
        papeis[papel] = coluna

    if len(papeis) != 3:
        return None
    return papeis
