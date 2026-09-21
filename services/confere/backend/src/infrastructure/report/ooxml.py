"""Formatação de tabela por propriedades diretas.

O modelo institucional traz apenas o estilo ``Normal Table`` — ``Table Grid``
não existe, e referenciá-lo levanta erro. Então bordas, sombreamento e larguras
são aplicados elemento a elemento, no XML (ESPEC 003 `R-DOC-09`).

É a parte da renderização que **os testes não protegem**: uma tabela pode sair
com as 55 linhas certas e as bordas erradas, passando em tudo. Por isso as
funções aqui são pequenas e nomeadas pelo que produzem — o que dá para fazer
para que uma leitura do código revele o erro que o teste não revela.
"""

from __future__ import annotations

import re
from typing import Any

from docx.oxml.ns import qn
from docx.oxml.simpletypes import ST_Merge
from docx.shared import Pt
from docx.table import Table, _Cell
from lxml.etree import SubElement

from infrastructure.report import layout

# T-2004 / ESPEC 026 — os nomes qualificados que `escrever` usa, resolvidos uma
# vez. `qn()` é uma função com `split` e concatenação, e aparecia com 2,07
# milhões de chamadas no perfil da renderização: resolvê-la dentro do laço
# devolveria parte do ganho da própria T-2004.
#
# Só os de `escrever` — as demais funções deste módulo são chamadas por tabela,
# não por célula, e lá `qn()` no lugar do uso lê melhor do que uma constante.
_P = qn("w:p")
_PPR = qn("w:pPr")
_SPACING = qn("w:spacing")
_BEFORE = qn("w:before")
_AFTER = qn("w:after")
_JC = qn("w:jc")
_R = qn("w:r")
_RPR = qn("w:rPr")
_RFONTS = qn("w:rFonts")
_ASCII = qn("w:ascii")
_HANSI = qn("w:hAnsi")
_CS = qn("w:cs")
_B = qn("w:b")
_COLOR = qn("w:color")
_SZ = qn("w:sz")
_T = qn("w:t")
_VAL = qn("w:val")
_ESPACO = qn("xml:space")
_TR = qn("w:tr")

# English Metric Unit por ponto tipográfico. É o fator que `Pt()` aplica, e
# reproduzi-lo aqui é o que mantém o `w:sz` idêntico ao da API pública.
EMU_POR_PONTO = 12700

# Tabulação e quebra de linha, que o `w:t` não representa — viram `w:tab` e
# `w:br`. O grupo de captura mantém os separadores no resultado do `split`.
_QUEBRAS = re.compile("(\t|\r\n|\n|\r)")


def _sem_cerquilha(cor: str) -> str:
    return cor.lstrip("#").upper()


def _elemento(tag: str) -> Any:
    from docx.oxml import OxmlElement

    return OxmlElement(tag)


def sombrear(celula: _Cell, cor: str) -> None:
    """Preenchimento sólido da célula."""
    shd = _elemento("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), _sem_cerquilha(cor))
    celula._tc.get_or_add_tcPr().append(shd)


def contornar(tabela: Table, cor: str, espessura_oitavos: int = 2) -> None:
    """Grade completa na tabela, com a mesma espessura em todas as bordas.

    ``espessura_oitavos`` é a unidade do OOXML: oitavos de ponto. 2 equivale a
    0,25 pt, a espessura da grade medida no relatório modelo.
    """
    bordas = _elemento("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "single")
        elemento.set(qn("w:sz"), str(espessura_oitavos))
        elemento.set(qn("w:space"), "0")
        elemento.set(qn("w:color"), _sem_cerquilha(cor))
        bordas.append(elemento)
    tabela._tbl.tblPr.append(bordas)


def sem_bordas(tabela: Table) -> None:
    """Usado no bloco de título, que é uma faixa sólida sem grade."""
    bordas = _elemento("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "none")
        elemento.set(qn("w:sz"), "0")
        bordas.append(elemento)
    tabela._tbl.tblPr.append(bordas)


# Margem interna das células, em twips. O padrão do Word é 108 por lado — em
# cinco colunas isso soma 1,9 cm e empurra a última para fora da área útil, que
# foi como a coluna "Quantidade Medida" apareceu cortada. 28 twips equivalem a
# 1,4 pt, próximo do espaçamento de 2 pt usado no relatório modelo.
MARGEM_CELULA = 28


def margens_apertadas(tabela: Table) -> None:
    """Reduz a margem interna das células ao mínimo legível."""
    margens = _elemento("w:tblCellMar")
    lados = (("top", 0), ("left", MARGEM_CELULA), ("bottom", 0), ("right", MARGEM_CELULA))
    for lado, valor in lados:
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:w"), str(valor))
        elemento.set(qn("w:type"), "dxa")
        margens.append(elemento)
    tabela._tbl.tblPr.append(margens)


def sem_bordas_na_celula(celula: _Cell) -> None:
    """Anula a grade da tabela nesta célula.

    Usado nos anexos: a grade é declarada uma vez na tabela inteira, e as
    células que a aba não emoldura a removem. É o caminho barato — as linhas em
    branco que separam blocos são poucas, e declarar borda célula a célula
    custaria quatro elementos vezes 25 mil.

    A declaração sai **completa** — ``nil``, espessura, espaço e cor (ESPEC 014
    `R-BRD-07`). Antes saíam só os dois primeiros, e uma declaração parcial é
    candidata a explicar por que a grade aparecia mesmo assim nas colunas
    vazias (`I-12`). Não é a correção principal daquele defeito: essa é não
    criar a coluna.
    """
    propriedades = celula._tc.get_or_add_tcPr()
    bordas = propriedades.find(qn("w:tcBorders"))
    if bordas is None:
        bordas = _elemento("w:tcBorders")
        propriedades.append(bordas)

    for lado in ("top", "left", "bottom", "right"):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "nil")
        elemento.set(qn("w:sz"), "0")
        elemento.set(qn("w:space"), "0")
        elemento.set(qn("w:color"), "auto")
        bordas.append(elemento)


def repetir_cabecalho(fileira: Any) -> None:
    """Marca a fileira como cabeçalho a repetir no topo de cada página.

    **Só vale nas primeiras fileiras de uma tabela.** O Word ignora a marca no
    meio, e é por isso que um anexo cujo cabeçalho não é a primeira linha da aba
    é renderizado em mais de uma tabela (ESPEC 004 `R-ANX-11`, `Anexo.cortes`).
    """
    trPr = fileira._tr.get_or_add_trPr()
    trPr.append(_elemento("w:tblHeader"))


def bordas_da_celula(
    celula: _Cell,
    lados: tuple[str, ...],
    cor: str = layout.PRETO,
    espessura_oitavos: int = 4,
) -> None:
    """Aplica borda apenas nos lados indicados de uma célula.

    Existe porque o bloco de título do relatório modelo não tem grade completa:
    o contorno envolve as duas linhas de rótulo, e o divisor entre elas vai só
    até a coluna de unidade — as duas de quantidade ficam sem separação, unidas
    pelo preenchimento navy. Aplicar a grade inteira produziria linhas que o
    modelo não tem.

    ``espessura_oitavos`` em 4 equivale a 0,5 pt, a espessura medida no modelo.
    """
    propriedades = celula._tc.get_or_add_tcPr()
    bordas = propriedades.find(qn("w:tcBorders"))
    if bordas is None:
        bordas = _elemento("w:tcBorders")
        propriedades.append(bordas)

    for lado in lados:
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "single")
        elemento.set(qn("w:sz"), str(espessura_oitavos))
        elemento.set(qn("w:space"), "0")
        elemento.set(qn("w:color"), _sem_cerquilha(cor))
        bordas.append(elemento)


def fixar_larguras(
    tabela: Table, larguras_pt: tuple[float, ...], grade_de_celulas: list[_Cell] | None = None
) -> None:
    """Larguras exatas, sem ajuste automático.

    Sem ``fixed``, o Word redistribui as colunas pelo conteúdo e as medidas
    tiradas do relatório modelo deixam de valer.

    A grade da tabela (``w:gridCol``) precisa receber as mesmas larguras das
    células: com disposição fixa é ela que o Word usa para montar as colunas, e
    definir só o ``w:tcW`` deixava a grade com colunas uniformes.

    ``grade_de_celulas`` — T-2013 / ESPEC 026 — evita resolver ``tabela._cells``
    duas vezes na mesma tabela. Quem chama daqui a pouco vai precisar dela de
    novo, e resolvê-la percorre toda a tabela decidindo ``gridSpan`` e
    ``vMerge`` célula a célula. Opcional porque o bloco de título e o de linhas
    não têm a lista em mãos, e ali a tabela é pequena.
    """
    # `autofit = False` já emite o `w:tblLayout` fixo. Acrescentar outro à mão
    # deixava dois elementos iguais no `tblPr` — inválido no esquema OOXML, e o
    # Word pode ignorar os dois.
    tabela.autofit = False
    margens_apertadas(tabela)

    grade = tabela._tbl.find(qn("w:tblGrid"))
    if grade is not None:
        for coluna, largura in zip(grade.findall(qn("w:gridCol")), larguras_pt, strict=False):
            coluna.set(qn("w:w"), str(int(round(largura * 20))))  # pt -> twips

    # `tabela.rows[i].cells` **remonta a grade inteira** a cada acesso — é como
    # o python-docx resolve mesclagens. Numa tabela de mil linhas isso vira
    # quadrático e passa a dominar o tempo de geração: com os anexos da ESPEC
    # 004, `Usuários` sozinho não terminava. A grade é montada uma vez.
    colunas = len(larguras_pt)
    if not colunas:
        return
    celulas = tabela._cells if grade_de_celulas is None else grade_de_celulas
    for indice, celula in enumerate(celulas):
        celula.width = Pt(larguras_pt[indice % colunas])


def altura_fixa(tabela: Table, altura_pt: float) -> None:
    for fileira in tabela.rows:
        trPr = fileira._tr.get_or_add_trPr()
        altura = _elemento("w:trHeight")
        altura.set(qn("w:val"), str(int(altura_pt * 20)))  # twips
        altura.set(qn("w:hRule"), "atLeast")
        trPr.append(altura)


def escrever(
    celula: _Cell,
    texto: str,
    *,
    negrito: bool = False,
    cor: str = layout.PRETO,
    alinhamento: str = "left",
    corpo: float | None = None,
) -> None:
    """Escreve o texto da célula com a tipografia do relatório modelo.

    ``corpo`` sobrescreve o corpo de fonte padrão. Existe para os anexos, cujo
    corpo é medido por anexo no GRC e vai de 3,5 a 11 pt (ESPEC 004 `R-ANX-04`).

    **T-2004 / ESPEC 026 — o XML é montado, não pedido.** Esta função é chamada
    15.955 vezes no piloto e 31.048 no PGM, e respondia por 22 dos 34 s de
    perfil da renderização. O custo não eram as células: eram as **sete
    atribuições de propriedade** do ``python-docx`` que ela fazia, cada uma
    resolvendo um XPath sobre a lista de sucessores para descobrir em que
    posição do esquema OOXML o elemento entra — 114.112 avaliações por
    documento.

    Aqui não há o que procurar. O ``w:p`` da célula nasce com zero filhos, e a
    ordem canônica do ``w:rPr`` é fixa e conhecida: ``rFonts``, ``b``,
    ``color``, ``sz``. Construir com ``SubElement`` é a operação que a situação
    pede — é o que o próprio ``python-docx`` faria se soubesse o que sabemos.

    **O acordo com a biblioteca é testado, não presumido.** Quatro detalhes
    abaixo não são escolhas nossas: são o que ``add_run``, ``font.size`` e
    ``CT_R.add_t`` fazem, e mudá-los muda o documento. Quem os guarda é
    ``test_desempenho.py::test_escrever_reproduz_a_api_publica`` (`R-DES-06`),
    que compara este XML com o da API pública sobre a matriz inteira de corpos
    de ``anexos.json``.
    """
    # O primeiro `w:p` da célula. `celula.paragraphs[0]` daria o mesmo, com uma
    # travessia a mais por chamada.
    paragrafo = celula._tc.find(_P)

    propriedades = SubElement(paragrafo, _PPR)
    espaco = SubElement(propriedades, _SPACING)
    espaco.set(_BEFORE, "0")
    espaco.set(_AFTER, "0")
    if alinhamento != "left":
        SubElement(propriedades, _JC).set(_VAL, alinhamento)

    # ESPEC 053 `R-CEL-04` — a marca do parágrafo (`w:pPr/w:rPr`), não a
    # execução (`w:r/w:rPr`, montada abaixo). Sem ela, um parágrafo cuja
    # execução não tem glifo (texto vazio) usa o tamanho herdado do documento
    # (12pt) para calcular a altura da linha — é a marca, não a execução, que
    # o Word consulta quando não há o que medir.
    marca = SubElement(propriedades, _RPR)
    fontes_marca = SubElement(marca, _RFONTS)
    fontes_marca.set(_ASCII, layout.FONTE_REGULAR)
    fontes_marca.set(_HANSI, layout.FONTE_REGULAR)
    fontes_marca.set(_CS, layout.FONTE_REGULAR)
    SubElement(marca, _SZ).set(_VAL, _meio_ponto(corpo))

    execucao = SubElement(paragrafo, _R)
    formato = SubElement(execucao, _RPR)

    # `font.name` sozinho não cobre os conjuntos de caracteres complexos; o Word
    # usa `eastAsia` e `cs` para decidir a fonte de parte do texto.
    fontes = SubElement(formato, _RFONTS)
    fontes.set(_ASCII, layout.FONTE_REGULAR)
    fontes.set(_HANSI, layout.FONTE_REGULAR)
    fontes.set(_CS, layout.FONTE_REGULAR)

    # Não negrito emite `<w:b w:val="0"/>`, e não a ausência do elemento: é o
    # que `run.bold = False` produz, e omiti-lo mudaria o documento.
    negrita = SubElement(formato, _B)
    if not negrito:
        negrita.set(_VAL, "0")

    SubElement(formato, _COLOR).set(_VAL, _sem_cerquilha(cor))
    SubElement(formato, _SZ).set(_VAL, _meio_ponto(corpo))

    # Texto vazio **não** emite `<w:t>`: `add_run("")` não emite, e uma célula
    # com `<w:t></w:t>` a mais é um documento diferente.
    if texto:
        _escrever_texto(execucao, texto)


def _meio_ponto(corpo: float | None) -> str:
    """O ``w:sz``, na unidade e no arredondamento do OOXML.

    Meio-ponto, e **truncado** — é o que ``ST_HpsMeasure.convert_to_xml`` faz:
    ``int(Emu(Pt(x)).pt * 2)``. Arredondar dá o mesmo resultado em oito dos
    catorze corpos de ``anexos.json`` e um a mais nos outros seis: `Servidores`
    (4,3), `ServidoresSemDesenv` (4,4), `Detalhes` (4,8), `WIFI` (5,8), `NAS`
    (6,4) e `ServicosVcloud` (8,9) sairiam com o corpo errado — e nenhum teste
    de conteúdo veria.
    """
    pontos = corpo if corpo is not None else layout.CORPO_FONTE
    return str(int(int(pontos * EMU_POR_PONTO) / EMU_POR_PONTO * 2))


def _escrever_texto(execucao: Any, texto: str) -> None:
    """O conteúdo do ``run``, como ``CT_R.add_t`` o produz.

    Tabulação e quebra de linha viram elementos próprios — o ``w:t`` não as
    representa —, e um texto com espaço nas pontas exige ``xml:space``, sem o
    que o Word os descarta. As abas de anexo têm as duas coisas: `Detalhes`
    traz ``DATA DE ATIVACAO\\t:\\t26/06/2023``.
    """
    for parte in _QUEBRAS.split(texto):
        if not parte:
            continue
        if parte == "\t":
            execucao.append(_elemento("w:tab"))
            continue
        if parte in ("\n", "\r", "\r\n"):
            execucao.append(_elemento("w:br"))
            continue
        no = SubElement(execucao, _T)
        no.text = parte
        if len(parte.strip()) < len(parte):
            no.set(_ESPACO, "preserve")


def mesclar(primeira: _Cell, ultima: _Cell) -> _Cell:
    """Funde uma região retangular, descartando os parágrafos que sobram.

    A fusão do python-docx concatena os parágrafos das células fundidas. Como
    todas nascem vazias, a célula resultante fica com um parágrafo vazio por
    célula absorvida — e cada um deles ocupa uma linha de altura. Numa aba com
    mesclagens de 15 colunas isso engorda a página visivelmente.

    Recebe as duas células, e não a tabela com as coordenadas, porque
    ``Table.cell`` remonta a grade a cada chamada. ``Office365`` tem **698
    mesclagens** — uma por linha de dados —, e resolvê-las pela tabela custava
    698 remontagens de 5.808 células: sozinho, respondia pela maior parte dos
    cinco minutos que a primeira versão levava.

    **T-2009 / ESPEC 026 — qual das duas usar.** `mesclar_regiao` quando o
    chamador já conhece o retângulo; esta quando ele só tem as células. Hoje
    resta um usuário: `mesclar_linha`, no bloco de título, sobre tabelas de três
    e cinco colunas. Otimizar o que custa três mesclagens seria gerar risco sem
    contrapartida (`R-DES-09`).

    Ela também é o **oráculo** de `test_mesclar_regiao_reproduz_a_api_publica`:
    é o único ponto do repositório que ainda funde por ``_Cell.merge``, e é o
    que acusa uma atualização do ``python-docx`` que mude o XML da fusão.
    """
    if primeira._tc is ultima._tc:
        return primeira

    celula: _Cell = primeira.merge(ultima)
    _descartar_paragrafos_absorvidos(celula)
    return celula


def fileiras_de(tabela: Table) -> list[Any]:
    """As fileiras da tabela, resolvidas **uma vez** — companheira de `mesclar_regiao`.

    Existe para que o chamador resolva a lista fora do laço. É a metade barata
    da correção da `T-2007`: cada `w:tr` é encontrado por `findall`, não por
    `tr_lst.index()` repetido.
    """
    return list(tabela._tbl.findall(_TR))


def mesclar_regiao(
    fileiras: list[Any], topo: int, esquerda: int, altura: int, largura: int
) -> _Cell | None:
    """T-2007 / ESPEC 026 — a mesclagem com o retângulo **já conhecido**.

    O `mesclar` acima resolveu metade do problema em 2026: passar as células
    prontas evitou que `Table.cell` remontasse a grade a cada chamada. A metade
    que sobrou estava **dentro** da biblioteca, e por isso não foi vista.

    `CT_Tc.merge` chama `_span_dimensions`, que descobre `(topo, esquerda,
    altura, largura)` a partir de duas células diagonais — e descobre via
    `_tr_idx`, que é `self._tbl.tr_lst.index(self._tr)`: **reconstrói a lista de
    todas as fileiras da tabela a cada mesclagem**. Numa aba com uma mesclagem
    por linha de dados isso é quadrático, e no par do PGM respondia por 72 dos
    82 s de perfil da renderização, em 3.157 mesclagens.

    Mas `_mesclar_anexo` **calcula esse retângulo** duas linhas antes de o
    destruir em duas células. Recebê-lo pronto elimina a busca inteira.

    Apoia-se em duas invariantes, e as duas são declaradas e não presumidas:

    1. as regiões mescladas do Excel **nunca se sobrepõem** — é propriedade do
       formato, e já estava escrita em `_mesclar_anexo`;
    2. mesclar remove ``w:tc``, **nunca ``w:tr``** — verificado no código da
       biblioteca, e é o que permite resolver `fileiras` uma vez por tabela.

    Quem guarda a segunda é `test_desempenho.py::test_a_mesclagem_nao_varre_as_fileiras`:
    no dia em que deixar de valer, a contagem deixa de ser zero.

    Devolve `None` para região de uma célula só — não há o que fundir, e é o
    mesmo caminho do `primeira._tc is ultima._tc` de `mesclar`.
    """
    if altura == 1 and largura == 1:
        return None

    topo_tc = fileiras[topo].tc_at_grid_offset(esquerda)
    _crescer(fileiras, topo, topo_tc, largura, altura, topo_tc)

    celula = _Cell(topo_tc, _pai_da_tabela(fileiras[topo]))
    _descartar_paragrafos_absorvidos(celula)
    return celula


def _crescer(
    fileiras: list[Any], linha: int, tc: Any, largura: int, altura: int, topo_tc: Any
) -> None:
    """A expansão, com a descida vertical por índice em vez de por varredura.

    Reproduz `CT_Tc._grow_to`, trocando **só** o que é O(fileiras): o
    `_tc_below` da biblioteca faz `tr_lst.index(self._tr)` a cada linha do vão,
    e aqui a linha corrente já é conhecida.

    `_span_to_width`, `_swallow_next_tc` e `_move_content_to` são reaproveitados
    como estão: são locais aos irmãos, são baratos, e são onde nasceria um
    defeito de fidelidade (ESPEC 026 `D-04`).
    """
    vmerge = (
        ST_Merge.CONTINUE
        if topo_tc is not tc
        else None
        if altura == 1
        else ST_Merge.RESTART
    )
    # Lido **antes** de `_span_to_width`: depois dela o `w:tc` engoliu os
    # vizinhos à direita. Continuaria correto, mas por acidente — e a biblioteca
    # lê na mesma ordem.
    deslocamento = tc.grid_offset
    tc._span_to_width(largura, topo_tc, vmerge)

    if altura > 1:
        abaixo = fileiras[linha + 1].tc_at_grid_offset(deslocamento)
        _crescer(fileiras, linha + 1, abaixo, largura, altura - 1, topo_tc)


def _descartar_paragrafos_absorvidos(celula: _Cell) -> None:
    """A fusão concatena os parágrafos das células fundidas.

    Como todas nascem vazias, a célula resultante fica com um parágrafo vazio
    por célula absorvida — e cada um ocupa uma linha de altura. Numa aba com
    mesclagens de 15 colunas isso engorda a página visivelmente.
    """
    for paragrafo in celula.paragraphs[1:]:
        paragrafo._element.getparent().remove(paragrafo._element)


def _pai_da_tabela(fileira: Any) -> Any:
    """O objeto que o `_Cell` guarda como pai.

    O `python-docx` só o usa para resolver a *part* do documento — de onde saem
    imagens e relações. A `w:tbl` responde a isso, e é o que `Table._cells` já
    passa para as células que devolve.
    """
    return fileira.getparent()


def mesclar_linha(tabela: Table, indice: int) -> _Cell:
    """Funde a fileira inteira numa célula só — usado nas faixas de seção."""
    fileira = tabela.rows[indice]
    celula = fileira.cells[0]
    for outra in fileira.cells[1:]:
        celula = celula.merge(outra)
    return celula
