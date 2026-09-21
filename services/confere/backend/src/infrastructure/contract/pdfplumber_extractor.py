"""T-14 / T-16 / T-18 — Extração da tabela de itens do contrato.

Implementa ``IContractExtractor``. A tabela é localizada por âncora de
conteúdo — padrão do código e linha ``TOTAL:`` — e nunca por número de página
fixo: um aditivo com uma página a mais deslocaria tudo.
"""

from __future__ import annotations

import re
from dataclasses import replace
from decimal import Decimal
from pathlib import Path
from typing import Any

from domain.entities.contract import BlocoDeItens, Contract
from domain.entities.contract_item import ContractItem
from domain.errors import ExtractionError
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.identidade_contratual import IdentidadeContratual
from domain.value_objects.quantity import para_decimal
from domain.value_objects.service_code import ServiceCode
from infrastructure.contract.grid import (
    analisar_geometria,
    cauda_da_pagina,
    ler_celulas,
    montar_grade,
    palavras_fora_da_grade,
    resolver_papel_das_colunas,
)
from infrastructure.shared.arquivos import abrir_pdf

# Colunas da tabela, na ordem do documento.
COL_CODIGO = 0
COL_DESCRICAO = 1
COL_UNIDADE = 2
COL_PRECO = 3
COL_QUANTIDADE = 4
COL_MESES = 5
COL_TOTAL = 6

# T-2679 / ESPEC 045 `R-COL-05` — o papel de hoje, e o valor inicial de toda
# geometria antes de qualquer cabeçalho resolver algo diferente. É o fallback:
# sem sinal em contrário, a leitura é bit a bit a de sempre.
PAPEL_CANONICO: dict[str, int] = {
    "preco": COL_PRECO,
    "quantidade": COL_QUANTIDADE,
    "meses": COL_MESES,
}

# `R-COL-07` — nomes legíveis do papel, para a mensagem de `V-CTR-08`. Na
# ordem em que as colunas aparecem no documento (preço, quantidade, período),
# não na ordem alfabética das chaves do dicionário.
_NOME_DO_PAPEL = {"preco": "preço unitário", "quantidade": "quantidade", "meses": "período"}


def _descrever_papel(papel: dict[str, int]) -> str:
    ordem = sorted(papel, key=lambda chave: papel[chave])
    return ", ".join(_NOME_DO_PAPEL[chave] for chave in ordem)


_CODIGO_EXATO = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")

# T-2235 / ESPEC 034 `R-DOC-11` — o código que a peça **declara**.
#
# Aceita as duas declarações porque há dois tipos de peça, e a ESPEC 025 já
# dissera isto por extenso ao criar `_DECLARA_PROPOSTA`: *"uma proposta comercial
# inicial não traz `Proposta de Aditivo:` em lugar nenhum"*. Aquela espec alargou
# o **detector** e deixou o **extrator** como estava — e o preço apareceu na
# mensagem de `V-CAP-01`, que saía com um buraco no meio: *"não foi derivado da
# proposta  —"*.
#
# **Os dois-pontos são obrigatórios, e é o que segura o alargamento** (`D-05`).
# A mesma primeira página traz, no cabeçalho, `Proposta Comercial PRODAM/DRM/
# GRC-3/NRC3 Nº 668`: sem eles, o número do expediente entraria como
# identificador da peça.
_PROPOSTA = re.compile(r"Proposta (?:Comercial|de Aditivo):\s*([A-Z]{2}-[A-Z]+-[\d-]+)")

# T-1916 / ESPEC 025 `R-DOC-02` — a página 1 se declara proposta.
#
# **Mais largo que `_PROPOSTA` de propósito.** Aquele extrai o identificador de
# um aditivo; este só pergunta *"isto é uma proposta?"*, e uma proposta comercial
# inicial não traz `Proposta de Aditivo:` em lugar nenhum. Usar `_PROPOSTA` como
# o sinal deixaria a primeira proposta de um contrato novo dependendo apenas dos
# códigos nas candidatas.
_DECLARA_PROPOSTA = re.compile(r"Proposta (?:Comercial|de Aditivo)", re.I)

# T-1917 / `R-DOC-03` degrau 4 — as propostas que o documento cita.
#
# Sobre a **mesma string** que `_proposta()` e `_cliente()` já percorrem: é a
# `R-DOC-01`, e é o que mantém o diagnóstico em custo zero. No `modelo.pdf` a
# linha `Proposta :` nomeia as três peças do contrato, e a do meio é o arquivo
# que deveria ter sido enviado.
_REFERENCIA = re.compile(r"\b(?:PC|PA)-[A-Z]+-[\d-]+")
# T-2086 / ESPEC 029 `R-IDT-05` — o processo administrativo da peça.
#
# Sobre a **mesma string** dos quatro padrões acima, e pelo mesmo motivo: é a
# `R-DOC-01`, e é o que mantém a derivação em custo zero. Vale entre peças, onde
# §2.5 o mede estável nas três reais, e não contra a planilha, que não o traz.
_PROCESSO = re.compile(r"PROCESSO\s+([\d./-]+)")
_MARCA_TOTAL = "TOTAL:"

# T-2643 / ESPEC 042 `R-TOT-01` — o total, quando o documento não tem `TOTAL:`.
#
# A família de propostas CGM não desenha essa linha em nenhuma página; declara
# o total duas vezes, para leitores diferentes — em prosa, e de novo na tabela
# do cronograma físico-financeiro (`_LINHA_TOTAL_DO_CRONOGRAMA`, abaixo). Nem
# uma nem outra é a marca que `_total_declarado` já sabia ler.
#
# `re.S` porque a frase quebra de linha antes do parêntese explicativo — "R$
# 5.532.203,96 (cinco milhões..." —, e o valor em si nunca atravessa a quebra.
_FRASE_TOTAL_EM_PROSA = re.compile(
    r"Valor total dos Servi[çc]os.*?estimado em R\$\s*([\d.,]+)", re.S
)

# `R-TOT-02` — dentro da seção "CRONOGRAMA FÍSICO-FINANCEIRO", a linha cujo
# primeiro token é `TOTAL` (sem os dois-pontos de `_MARCA_TOTAL` — é uma marca
# diferente, de uma tabela diferente). `(?m)` para casar por linha dentro do
# texto normalizado; o valor é sempre o **último** número da linha,
# independente de quantas colunas de categoria vierem antes dele.
_LINHA_TOTAL_DO_CRONOGRAMA = re.compile(r"(?m)^TOTAL\b.*$")
_VALOR_MONETARIO = re.compile(r"[\d.]+,\d{2}")

# T-2239 / ESPEC 034 `R-CAP-11` — o vocabulário que abre o sintagma do órgão.
#
# **Lista fechada, e é decisão** (`D-04`). Só `Secretaria` e `Procuradoria` têm
# documento real; as demais entram por antecipação. Um órgão fora da lista
# **degrada para o comportamento de hoje** — `V-CAP-01` avisa e a capa cai para o
# subtítulo da aba. O custo de uma lista incompleta é o custo de hoje; o de uma
# lista aberta seria nome errado na capa de um documento que vai ao órgão.
_VOCABULARIO_DE_ORGAO = (
    r"(?:Secretaria|Procuradoria|Coordenadoria|Subprefeitura|Autarquia"
    r"|Funda[çc][ãa]o|Ag[êe]ncia|Instituto|Companhia)"
)

# T-2265 / ESPEC 035 `R-CAP-16` — o traço que separa o nome do órgão da sigla.
#
# Hífen, hifens tipográficos, travessões e o sinal de menos. Até a ESPEC 034 era
# o hífen ASCII literal, e funcionava por circunstância: as seis peças que
# calibraram a regra o usam. O `PA-FTM-251001-143` escreve
# `Fundação Theatro Municipal – FTMSP` com **en dash** (U+2013) — e o padrão não
# casava, `V-CAP-01` avisava, e a capa caía para o subtítulo (ESPEC 035 §2.5).
#
# **Classe, e não normalização do texto** (`D-06`). Trocar todo travessão por
# hífen antes de casar alcançaria `_PROPOSTA`, `_PROCESSO`, `_REFERENCIA` e as
# descrições de item — quatro coisas que funcionam, para corrigir uma.
#
# O `\s*` dos dois lados vem junto porque o separador é o conjunto *espaço +
# traço + espaço*: o piloto grafa `Tecnologia- SMIT` sem o primeiro, e o PGM
# `Paulo - PGM` com os dois.
_TRACO = r"\s*[-‐-―−]\s*"

# ESPEC 034 `R-CAP-11` / `R-CAP-12` — o órgão é o **sintagma institucional**, e o
# que o fecha é a **sigla**, não o ponto.
#
# A `R-CAP-04` procurava `prestação de serviços para <órgão>` e capturava até o
# ponto. Funcionava por circunstância: as duas peças que a calibraram são
# aditivos (ESPEC 034 §2.3), e no aditivo o órgão fecha a frase. As sete peças
# reais escrevem a mesma informação de quatro maneiras::
#
#     para a <órgão>.                            contrato.pdf · contrato_pgm.pdf
#     de <objeto> para a <órgão>                 aditivo_pgm_2.pdf
#     entre a <órgão> e a <contratada> para a…   contrato_smul.pdf
#     à <órgão>.                                 aditivo_smul.pdf
#
# Enumerar preposições é perseguir uma lista que não fecha. O sintagma é o mesmo
# nas quatro — e **capturar até o ponto na terceira poria a PRODAM dentro do nome
# do cliente** (§2.4).
#
# `[^.;]{0,90}?` é preguiçoso e não atravessa pontuação de frase: para no
# primeiro `- SIGLA`, que é onde o nome do órgão termina.
_CLIENTE = re.compile(
    _VOCABULARIO_DE_ORGAO + r"[^.;]{0,90}?" + _TRACO + r"[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}\b"
)

# ESPEC 020 `R-CAP-04` — a sigla que segue o nome. O separador **varia**:
# `Tecnologia- SMIT` no piloto, `Paulo - PGM` no PGM (§2.5). Daí o `\s*` dos dois
# lados do traço, e não um separador literal.
#
# T-2265 / ESPEC 035 `R-CAP-16` — e **a mesma classe do `_CLIENTE`**. Não é
# simetria de estilo: é metade da correção. Com a classe só lá, o FTM derivaria e
# a capa sairia `FUNDAÇÃO THEATRO MUNICIPAL – FTMSP`, com a sigla colada — pior
# que o aviso de hoje, porque **parece** certo.
_SIGLA = re.compile(_TRACO + r"[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}\s*$")


def _limpar(texto: str) -> str:
    return re.sub(r"\s+", " ", texto or "").strip()


class PdfPlumberContractExtractor:
    """Extrator baseado na grade de bordas desenhada no PDF."""

    def extrair(self, caminho: Path) -> Contract:
        with abrir_pdf(caminho, "contrato") as pdf:
            # T-2014 / ESPEC 026 — a página 1 é lida **uma vez**. Os três
            # consumidores abaixo chamavam `extract_text()` cada um: os objetos
            # da página são cacheados pelo `pdfplumber`, mas o texto é remontado
            # a cada chamada. O docstring de `_identificar` já afirmava que
            # "nenhuma página é aberta de novo" — verdade sobre a página, e não
            # sobre o texto. Agora é verdade sobre os dois.
            texto_da_capa = pdf.pages[0].extract_text() or ""
            proposta = self._proposta(texto_da_capa)
            cliente = self._cliente(texto_da_capa)
            # T-2086 / ESPEC 029 `R-IDT-02` — de que contrato esta peça é.
            identidade = IdentidadeContratual.de_texto(texto_da_capa)
            processo = self._processo(texto_da_capa)
            itens: list[ContractItem] = []
            total_declarado: Decimal | None = None

            # T-1111 — a geometria é descoberta no documento antes de qualquer
            # leitura de célula (ESPEC 017 `R-GRD-02`). Sem gabarito não há
            # tabela: o contrato sai vazio e `V-CTR-01` bloqueia, como sempre —
            # agora levando junto o diagnóstico do que foi observado.
            geometria = analisar_geometria(pdf)
            diagnostico = self._identificar(texto_da_capa, geometria.diagnostico)
            if geometria.gabarito is None:
                return Contract(
                    proposta=proposta,
                    cliente=cliente,
                    diagnostico=diagnostico,
                    # **Aqui também, e não só no retorno de baixo** (ESPEC 029
                    # §2.8). Este é o caminho da peça que já falhou na extração,
                    # e é sobre ela que a tela vai ter de dizer alguma coisa.
                    identidade=identidade,
                    processo=processo,
                )

            # T-1303 / `R-ADT-08` — **uma tabela de itens deixou de ser uma só.**
            geometrias = self._geometrias_de_itens(pdf, geometria)

            # `R-ADT-12` — a mesma linha física pode ser alcançada por duas
            # geometrias, e é **uma** linha. Itens por conteúdo; totais por valor,
            # que sobrevive à palavra `Aumento` cair numa célula ou em duas.
            linhas_vistas: set[tuple[int, tuple[str, ...]]] = set()
            totais_vistos: set[tuple[int, Decimal]] = set()

            # T-2679 / ESPEC 045 `R-COL-01` a `R-COL-05` — a ordem de preço,
            # quantidade e período é **por geometria**, e muda ao longo da
            # leitura conforme o cabeçalho de cada seção aparece: a mesma
            # geometria pode hospedar uma seção na ordem canônica e outra
            # invertida (`D-01`). `papel_ativo` começa no canônico — o
            # fallback, e o comportamento de sempre — e só muda quando
            # `resolver_papel_das_colunas` fecha um mapeamento completo.
            papel_ativo: dict[tuple[float, ...], dict[str, int]] = {
                divisorias: dict(PAPEL_CANONICO) for divisorias in geometrias
            }
            # O que se acumulou nas colunas 3/4/5 desde a última linha de
            # item, por geometria — limpo a cada linha de item, resolvendo ou
            # não (`D-03`), para que um fragmento de cabeçalho distante nunca
            # sobreviva até um item que não é dele.
            pendentes_de_papel: dict[tuple[float, ...], dict[int, list[str]]] = {
                divisorias: {COL_PRECO: [], COL_QUANTIDADE: [], COL_MESES: []}
                for divisorias in geometrias
            }
            # `R-COL-07` — cada troca de papel observada, para `V-CTR-08`.
            trocas_de_papel: list[tuple[int, str]] = []

            # `R-ADT-01` — os itens vão saindo para `pendentes`, e cada linha
            # `TOTAL:` fecha um bloco com o rótulo que ela carrega.
            blocos: list[BlocoDeItens] = []
            pendentes: list[ContractItem] = []
            # `R-CON-05` — cauda sem linha anterior a que se anexar. Anomalia:
            # não ocorre em nenhum dos três documentos, e `V-CTR-06` a acusa.
            caudas_orfas: list[tuple[int, str]] = []

            # Páginas por fora e geometrias por dentro: é o que preserva a **ordem
            # do documento**, e a ordem é o que o contrato fornece ao relatório
            # (`R-REL-03`). Iterar por geometria embaralharia as páginas.
            # ESPEC 032 `R-CON-03` — as páginas cuja cauda já foi costurada. Uma
            # página pode casar mais de uma geometria, e sem isto a cauda entraria
            # duas vezes na mesma descrição.
            caudas_costuradas: set[int] = set()
            # T-2262 / ESPEC 035 `R-GRD-10` — a contagem é **por página**, e não
            # por par página×geometria. Uma página casada por duas geometrias
            # seria contada duas vezes, e o número que existe para dizer o
            # tamanho do problema mentiria sobre ele. É a mesma razão da
            # `caudas_costuradas` acima, e por isso o guarda mora ao lado dela.
            paginas_contadas: set[int] = set()
            descartadas: list[tuple[int, int]] = []

            for numero, pagina in enumerate(pdf.pages, start=1):
                for divisorias in geometrias:
                    grade = montar_grade(pagina, divisorias)
                    if grade is None:
                        continue

                    # `R-CON-03` — a cauda **desta** página pertence à última
                    # linha da **anterior**: a linha atravessou a quebra, e o
                    # resto da descrição foi impresso aqui em cima.
                    #
                    # Costura só em `pendentes`, e é decisão. Fechado o bloco, o
                    # item passa a viver em `itens` **e** dentro do
                    # `BlocoDeItens`, e `Contract.__post_init__` exige que os dois
                    # concordem — emendar um só quebraria o invariante. Nos três
                    # documentos a linha anterior está sempre pendente; não
                    # estando, é a `R-CON-05`, e `V-CTR-06` a registra.
                    if numero not in caudas_costuradas:
                        cauda = cauda_da_pagina(pagina, grade, COL_DESCRICAO)
                        if cauda:
                            caudas_costuradas.add(numero)
                            if pendentes:
                                anterior = pendentes[-1]
                                pendentes[-1] = replace(
                                    anterior, descricao=f"{anterior.descricao} {cauda}"
                                )
                            else:
                                caudas_orfas.append((numero, cauda))

                        # T-2262 / `R-GRD-10` — o que a grade viu e não guardou.
                        #
                        # **Aqui dentro, e não num laço à parte**: a conta precisa
                        # da `cauda` que acabou de ser decidida, porque o que ela
                        # resgatou não foi perdido. Um laço próprio recalcularia a
                        # mesma decisão, e o dia em que os dois discordassem seria
                        # um dia perdido.
                        if numero not in paginas_contadas:
                            paginas_contadas.add(numero)
                            fora = palavras_fora_da_grade(pagina, grade)
                            fora -= len(cauda.split())
                            if fora > 0:
                                descartadas.append((numero, fora))

                    # T-2210 / ESPEC 033 `R-FXA-01` — **por faixa**, e não pela
                    # geometria da página. Uma folha pode ter mais de uma tabela
                    # de itens, com larguras diferentes: a página 4 do
                    # `PA-SMUL-250314-22` tem três, e a grade da `Inclusão`
                    # fatiava as linhas das outras duas com as colunas erradas.
                    #
                    # Efeito colateral, e bem-vindo: as quatro geometrias
                    # admitidas daquele documento passam a produzir células
                    # **idênticas** para a mesma linha física, e a `linhas_vistas`
                    # abaixo as reduz a uma. Antes produziam quatro fatiamentos
                    # diferentes, e nenhum deduplicava.
                    #
                    # `_linhas`, que serve o crivo de admissão, **não** passa a
                    # bandeira (`R-FXA-06`).
                    # T-2631 / ESPEC 041 `R-FXA-09` — a união das geometrias já
                    # admitidas (`geometrias`, de `_geometrias_de_itens`, linha
                    # 188) é o universo contra o qual uma linha sem faixa
                    # própria de oito é conferida antes de cair na grade da
                    # página. Sem isto, uma linha de tabela de escopo com
                    # código de serviço na primeira coluna é lida pelas colunas
                    # de uma tabela de preços vizinha, e falha exigindo campos
                    # que nunca teve.
                    for celulas in ler_celulas(
                        pagina, grade, por_faixa=True, geometrias=geometrias
                    ):
                        chave = (numero, tuple(_limpar(c) for c in celulas))
                        if chave in linhas_vistas:
                            continue
                        linhas_vistas.add(chave)

                        if _MARCA_TOTAL in " ".join(celulas):
                            # `R-ADT-07` / ESPEC 019 `D-05` — os totais são
                            # **somados**, não sobrescritos: o aditivo do PGM tem
                            # três blocos, e guardar só o último daria `12.831,84`
                            # onde a peça movimenta `-0,12`.
                            valor = self._total_declarado(celulas)
                            if valor is not None and (numero, valor) not in totais_vistos:
                                totais_vistos.add((numero, valor))
                                total_declarado = (total_declarado or Decimal(0)) + valor
                                if pendentes:
                                    blocos.append(
                                        BlocoDeItens(
                                            rotulo=self._rotulo(celulas),
                                            itens=tuple(pendentes),
                                            total_declarado=valor,
                                        )
                                    )
                                    itens.extend(pendentes)
                                    pendentes = []

                        codigo = _limpar(celulas[COL_CODIGO])
                        if not _CODIGO_EXATO.match(codigo):
                            # T-2679 / `R-COL-03` — linha que não é item: o
                            # texto das três colunas numéricas centrais entra
                            # no buffer da geometria, candidato a cabeçalho da
                            # próxima seção.
                            pendentes_de_papel_da_geometria = pendentes_de_papel[
                                divisorias
                            ]
                            for coluna in (COL_PRECO, COL_QUANTIDADE, COL_MESES):
                                texto = _limpar(celulas[coluna])
                                if texto:
                                    pendentes_de_papel_da_geometria[coluna].append(texto)
                            continue

                        # `R-COL-04` — linha de item: resolve o que o buffer
                        # acumulou. Resolvendo em três papéis distintos, o
                        # papel ativo da geometria muda; senão, continua o que
                        # já valia (`D-04`). O buffer é limpo aqui, resolvendo
                        # ou não.
                        novo_papel = resolver_papel_das_colunas(pendentes_de_papel[divisorias])
                        if novo_papel is not None:
                            if novo_papel != papel_ativo[divisorias]:
                                trocas_de_papel.append((numero, _descrever_papel(novo_papel)))
                            papel_ativo[divisorias] = novo_papel
                        pendentes_de_papel[divisorias] = {
                            COL_PRECO: [],
                            COL_QUANTIDADE: [],
                            COL_MESES: [],
                        }

                        pendentes.append(
                            self._montar_item(celulas, codigo, numero, papel_ativo[divisorias])
                        )

            # Itens sem `TOTAL:` que os feche. Vale a tabela que a peça mostra: o
            # bloco sai sem rótulo, e `V-CTR-03` já bloqueia se faltou total.
            if pendentes:
                blocos.append(BlocoDeItens(rotulo=None, itens=tuple(pendentes)))
                itens.extend(pendentes)

        # `R-CON-05` — o que o crivo aceitou e não teve onde encaixar viaja no
        # diagnóstico, que é por onde `V-CTR-01` e as suas irmãs já falam.
        if caudas_orfas:
            diagnostico = replace(diagnostico, caudas_orfas=tuple(caudas_orfas))

        # T-2262 / `R-GRD-10` — o descarte viaja pelo diagnóstico, que é por onde
        # `V-CTR-01` e as suas irmãs já falam. Ordenado por página para que a
        # mensagem de `V-CTR-03` seja determinística.
        if descartadas:
            diagnostico = replace(
                diagnostico, palavras_descartadas=tuple(sorted(descartadas))
            )

        # T-2679 / ESPEC 045 `R-COL-07` — as trocas de papel viajam no
        # diagnóstico, que é por onde `V-CTR-08` fala.
        if trocas_de_papel:
            diagnostico = replace(
                diagnostico, ordem_de_colunas_alternativa=tuple(trocas_de_papel)
            )

        # T-2644 / ESPEC 042 `D-04` — só quando a busca normal (`TOTAL:` +
        # `BRL`) já percorreu o documento inteiro e não achou nada. Os
        # documentos que já têm `total_declarado` não pagam esta leitura
        # extra de página — ela só acontece no caminho que hoje bloqueia.
        if total_declarado is None:
            texto_do_documento = "\n".join(
                pagina.extract_text() or "" for pagina in pdf.pages
            )
            total_declarado = self._total_por_convergencia(texto_do_documento)

        return Contract(
            proposta=proposta,
            cliente=cliente,
            total_declarado=total_declarado,
            itens=itens,
            diagnostico=diagnostico,
            blocos=tuple(blocos),
            identidade=identidade,
            processo=processo,
        )

    def identificar(self, caminho: Path) -> Contract:
        """T-2096 / ESPEC 029 `D-10` — de que contrato esta peça é, em 0,31 s.

        Abre o PDF, lê **a página 1** e devolve um `Contract` com o cabeçalho
        preenchido e **sem itens**: identidade, processo, proposta e cliente.

        É o que torna o portão de `R-IDT-10` possível. Perguntar depois do
        processamento custaria ~30 s para fazer a pergunta e mais ~30 s para
        refazer o trabalho ao ouvir *sim*; perguntar antes, sobre a primeira
        página, custa menos de um segundo — e quem responder *trocar arquivo*
        nunca pagou os 30 s.

        **`extrair` fica intocada, e não chama esta.** É método a mais no
        *port*, aditivo: o fluxo de geração não passa por aqui, e a validação
        de dentro dele continua sendo a garantia (`R-IDT-12`). Um `Contract`
        sem itens vindo daqui **não serve para gerar nada** — `V-CTR-01` o
        recusaria, e é justamente o que se espera dele.
        """
        with abrir_pdf(caminho, "contrato") as pdf:
            texto_da_capa = pdf.pages[0].extract_text() or ""

        return Contract(
            proposta=self._proposta(texto_da_capa),
            cliente=self._cliente(texto_da_capa),
            identidade=IdentidadeContratual.de_texto(texto_da_capa),
            processo=self._processo(texto_da_capa),
        )

    # ── Auxiliares ────────────────────────────────────────────────────────────

    def _geometrias_de_itens(
        self, pdf: Any, geometria: Any
    ) -> list[tuple[float, ...]]:
        """T-1304 / ESPEC 019 `D-05` — as geometrias que rendem linha de item.

        O crivo de ``R-GRD-02`` — *onde estão os códigos de serviço* — **deixa de
        eleger** uma geometria e passa a **filtrar** as que servem.

        Aceitar todas seria inaceitável: a geometria do cronograma
        físico-financeiro, aplicada às páginas da tabela de itens, rende linhas
        malformadas — 5 no ``PA-PGM-251015-159`` e 6 no piloto, com quantidade e
        período colados numa célula (ESPEC 019 §2.5).

        E o critério é *render item completo*, não *ter código na página*: as duas
        geometrias da página 7 do aditivo veem os mesmos dois códigos, e só uma
        delas é tabela de itens.

        O teste é feito nas páginas onde as faixas daquela geometria estão — não no
        documento inteiro —, e por isso custa uma leitura curta por candidata.
        """
        escolhidas: list[tuple[float, ...]] = []
        for candidato in geometria.candidatos:
            if any(
                self._e_item_completo(celulas)
                for numero in candidato.paginas
                for celulas in self._linhas(pdf.pages[numero - 1], candidato.divisorias)
            ):
                escolhidas.append(candidato.divisorias)
        return escolhidas

    @staticmethod
    def _linhas(pagina: Any, divisorias: tuple[float, ...]) -> list[list[str]]:
        grade = montar_grade(pagina, divisorias)
        return ler_celulas(pagina, grade) if grade is not None else []

    @staticmethod
    def _e_item_completo(celulas: list[str]) -> bool:
        """Código na primeira célula e as quatro numéricas legíveis.

        Não usa ``_montar_item``: aqui a linha incompleta é **resposta**, e lá é
        ``ExtractionError``. Depois da admissão a exceção volta a valer, e é ela
        que segue denunciando tabela genuinamente truncada (ESPEC 001 §9.4).
        """
        if not _CODIGO_EXATO.match(_limpar(celulas[COL_CODIGO])):
            return False
        return all(
            para_decimal(celulas[coluna]) is not None
            for coluna in (COL_PRECO, COL_QUANTIDADE, COL_MESES, COL_TOTAL)
        )

    def _identificar(self, texto_da_capa: str, diagnostico: Any) -> Any:
        """T-1916 / T-1917 — os dois sinais de identidade, da página 1.

        `analisar_geometria` devolve o que a **geometria** apurou; falta o que a
        prosa da primeira página diz, e é o extrator quem a lê. Nenhuma página é
        aberta de novo, e desde a `T-2014` o **texto** também não é remontado:
        os três consumidores recebem a mesma string, extraída uma vez em
        `extrair`.

        `R-DOC-02` — basta **um** dos dois sinais. Exigir os dois recusaria uma
        proposta cujo cabeçalho mudasse de forma; exigir nenhum é o que a tela
        fazia até aqui.
        """
        texto = re.sub(r"\s+", " ", texto_da_capa)
        return replace(
            diagnostico,
            parece_proposta=bool(_DECLARA_PROPOSTA.search(texto))
            or any(diagnostico.codigos_nas_candidatas),
            referencias=tuple(sorted(set(_REFERENCIA.findall(texto)))),
        )

    def _proposta(self, texto_da_capa: str) -> str:
        """Identificação da proposta, exigida no rodapé do relatório (R-CTR-05)."""
        achado = _PROPOSTA.search(texto_da_capa)
        return achado.group(1) if achado else ""

    def _processo(self, texto_da_capa: str) -> str:
        """`R-IDT-05` — o processo administrativo, segundo eixo da `V-IDT-03`.

        É o que pega o caso que o número do contrato não pegaria: dois
        instrumentos do mesmo órgão e do mesmo ano com numeração parecida.
        """
        achado = _PROCESSO.search(re.sub(r"\s+", " ", texto_da_capa))
        return achado.group(1) if achado else ""

    def _cliente(self, texto_da_capa: str) -> str:
        """T-1417 / `R-CAP-04` — o nome do órgão, para a capa (ESPEC 020).

        **A única derivação por prosa do projeto inteiro.** Tudo o mais sai de
        estrutura: grade desenhada, célula de planilha, rótulo de bloco. Prosa é a
        fonte que mais muda sem avisar, e isso está dito e não escondido (`D-05`).

        Três coisas limitam o dano, e as três são medidas:

        1. o padrão casa nas **duas** propostas reais, e o resultado do piloto é
           **idêntico** ao que a capa do modelo já traz — a regra reproduz a capa
           cuja correção se conhece;
        2. a sigla é removida por padrão, e não por separador fixo: o SMIT grafa
           `Tecnologia- SMIT` e o PGM `Paulo - PGM`. Um `rsplit(" - ")` passaria no
           segundo e **falharia no primeiro**, deixando `TECNOLOGIA- SMIT` na capa
           do par cuja capa correta já se conhece;
        3. não derivando, a capa cai para o subtítulo (`R-CAP-10`) e `V-CAP-01`
           avisa — **nunca fica com o nome de outro cliente**.

        ── T-2239 / ESPEC 034 `R-CAP-13` — a ambiguidade não escolhe ──────────

        A busca é por **todas** as ocorrências, e o que decide é o número de
        nomes **distintos**:

        - um só nome, ainda que citado várias vezes, deriva. É o caso do piloto,
          que nomeia o órgão duas vezes na mesma página;
        - dois nomes distintos **não derivam nenhum**. Uma página que fale de
          dois órgãos não diz qual é o cliente, e escolher o primeiro seria
          decidir por ordem de impressão.

        Sem esta regra, a capa do `PC-SMUL` — que nomeia o órgão **e** a
        contratada — passaria a depender de qual dos dois o padrão encontrasse
        primeiro. A saída de `R-CAP-10` sabe menos e erra menos.
        """
        texto = re.sub(r"\s+", " ", texto_da_capa.replace("\n", " "))
        nomes = {
            _SIGLA.sub("", achado.group(0)).upper()
            for achado in _CLIENTE.finditer(texto)
        }
        return nomes.pop() if len(nomes) == 1 else ""

    def _total_declarado(self, celulas: list[str]) -> Decimal | None:
        monetarias = [c for c in celulas if "BRL" in c]
        return para_decimal(monetarias[-1]) if monetarias else None

    def _total_por_convergencia(self, texto: str) -> Decimal | None:
        """T-2643 / ESPEC 042 `R-TOT-01` a `R-TOT-03` — o total sem `TOTAL:`.

        Só devolve valor quando **as duas** fontes existem e concordam: a
        frase de prosa (`_FRASE_TOTAL_EM_PROSA`) e a linha `TOTAL` do
        cronograma físico-financeiro (`_LINHA_TOTAL_DO_CRONOGRAMA`).

        **Uma fonte só não basta, e é medido, não presumido** (`D-01`): o
        `TOTAL` do cronograma de um aditivo de ajuste quantitativo é o total
        absoluto do contrato *depois* do aditivo — não o delta que aquela
        peça declara. Sem a frase de prosa para confirmar, o valor do
        cronograma sozinho mentiria sobre o total desta peça.
        """
        prosa = _FRASE_TOTAL_EM_PROSA.search(re.sub(r"\s+", " ", texto))
        if prosa is None:
            return None
        valor_prosa = para_decimal(prosa.group(1))

        linha = _LINHA_TOTAL_DO_CRONOGRAMA.search(texto)
        if linha is None:
            return None
        valores = _VALOR_MONETARIO.findall(linha.group(0))
        if not valores:
            return None
        valor_cronograma = para_decimal(valores[-1])

        if valor_prosa is None or valor_cronograma is None:
            return None
        # A mesma tolerância de `V-CTR-03` (`TOLERANCIA_CHECKSUM`): duas fontes
        # que declaram o mesmo total por vias diferentes — frase corrida,
        # tabela — podem divergir por arredondamento de centavo.
        if abs(valor_prosa - valor_cronograma) > Decimal("0.01"):
            return None
        return valor_prosa

    @staticmethod
    def _rotulo(celulas: list[str]) -> RotuloDeBloco | None:
        """`R-ADT-01` — o rótulo do bloco, colhido na sua linha `TOTAL:`.

        Procura **antes** da marca, e na linha inteira. As duas precauções são
        medidas, não defensivas:

        - *antes da marca*, porque depois dela vem só o valor, e uma descrição que
          contivesse `inclusão` num bloco vizinho não pode contaminar;
        - *na linha inteira*, porque a palavra cai numa célula ou em duas conforme
          a geometria que leu a linha. A mesma linha da página 25 da proposta do
          PGM sai como `[…, 'Aumento', 'TOTAL:', …]` por um gabarito e como
          `[…, '', 'Aumento TOTAL:', …]` por outro.
        """
        antes, _, _ = " ".join(celulas).partition(_MARCA_TOTAL)
        return RotuloDeBloco.de_texto(antes)

    def _montar_item(
        self,
        celulas: list[str],
        codigo: str,
        pagina: int,
        papel: dict[str, int] | None = None,
    ) -> ContractItem:
        # T-2680 / ESPEC 045 `R-COL-06` — `quantidade`, `preço unitário` e
        # `meses` saem da posição que o papel da geometria resolveu, não mais
        # das constantes de módulo direto. Sem `papel` (chamada direta, como
        # os testes da ESPEC 040 já fazem), o padrão é o canônico — bit a bit
        # o comportamento de sempre (`R-COL-05`).
        papel = papel or PAPEL_CANONICO
        quantidade = para_decimal(celulas[papel["quantidade"]])
        preco = para_decimal(celulas[papel["preco"]])
        meses = para_decimal(celulas[papel["meses"]])
        total = para_decimal(celulas[COL_TOTAL])

        # T-2612 / ESPEC 040 `R-MES-01` — `meses` saiu daqui. Ele não sustenta o
        # checksum de `V-CTR-03` (que soma `total_declarado`, não `preço ×
        # quantidade × meses` — `Contract.soma_dos_totais`) nem é lido em lugar
        # nenhum do backend. Bloquear a extração inteira por um campo nunca
        # consultado era desproporcional; a ausência dele vira aviso em
        # `V-CTR-07`, não `ExtractionError`.
        faltando = [
            nome
            for nome, valor in (
                ("quantidade", quantidade),
                ("preço unitário", preco),
                ("valor total", total),
            )
            if valor is None
        ]
        if faltando:
            # Falhar alto: um item com quantidade zerada por erro de leitura
            # produziria um relatório errado sem nenhum sinal (ESPEC 001 §9.4).
            raise ExtractionError(
                f"item {codigo} (página {pagina}) sem {', '.join(faltando)} — "
                "extração incompleta da tabela do contrato"
            )

        assert quantidade is not None and preco is not None
        assert total is not None

        return ContractItem(
            codigo=ServiceCode(codigo),
            descricao=_limpar(celulas[COL_DESCRICAO]),
            unidade=_limpar(celulas[COL_UNIDADE]),
            quantidade=quantidade,
            preco_unitario=preco,
            meses=int(meses) if meses is not None else None,
            # `_limpar` devolve `''` para célula em branco, e `'' or None` evita
            # que o aviso de `V-CTR-07` saia com "texto extraído: ''" — célula
            # vazia não é prosa, é ausência, e não há o que mostrar de volta.
            meses_bruto=None if meses is not None else (_limpar(celulas[papel["meses"]]) or None),
            total_declarado=total,
            pagina=pagina,
        )
