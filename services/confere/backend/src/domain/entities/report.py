"""T-11 — Agregado do relatório de comprovação."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from domain.entities.annex import Anexo
from domain.value_objects.classification import Classificacao
from domain.value_objects.quantity import Quantity
from domain.value_objects.service_code import ServiceCode

# `R-CAP-05` — a forma do título da aba `Levantamento`, medida nos dois pares.
_SUBTITULO = re.compile(
    r"^LEVANTAMENTO - COMPROVA[ÇC][ÃA]O\s+(.+?)\s+- CAT[ÁA]LOGO DE SERVI[ÇC]OS DIT$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ReportLine:
    codigo: ServiceCode
    descricao: str
    unidade: str
    contratada: Quantity
    medida: Quantity
    # Itens de perfil ou pacote entram como 1/1 (R-REC-04) e por isso nunca
    # divergem. A marca existe para que a tela possa avisar: o banco de dados
    # contratado no perfil D e medido no perfil C aparece como se não houvesse
    # diferença (ESPEC 001 §9.3).
    perfil_ou_pacote: bool = False
    # T-1272 — **célula vazia não é zero.** A aba do PGM traz o
    # `14.046.00003.00` com a quantidade contratada em branco: é ausência de
    # afirmação, não afirmação de que nada foi contratado. Tratar as duas como
    # iguais poria "contratada 0" num documento de cobrança e classificaria o
    # item como *medido acima do contratado* na análise.
    contratada_declarada: bool = True

    @property
    def tem_divergencia(self) -> bool:
        """ESPEC 002 R-DIV-01 — compara os valores, não os textos formatados.

        Comparar o texto faria `117,29` e `117,2889…` parecerem iguais, porque
        a formatação arredonda para duas casas.
        """
        return self.contratada.valor != self.medida.valor

    @property
    def saldo(self) -> Quantity:
        """ESPEC 002 R-DIV-08 — contratada menos medida, na formatação do item.

        Negativo quando o medido supera o contratado (`R-DIV-09`): é consumo
        acima do contratado, e o sinal precisa sobreviver até a tela.
        """
        return Quantity(
            self.contratada.valor - self.medida.valor,
            self.contratada.formato,
        )

    @property
    def sem_cobertura_contratual(self) -> bool:
        """Medido sem que a fonte afirme quantidade contratada.

        Era atributo de **onde a linha estava** no relatório — o
        `sem_previsao_contratual`, que a `R-DIV-05` mantinha fora do documento.
        Com a ESPEC 018 nada é omitido (`D-04`), e a condição passa a ser lida
        da própria linha.

        Exige `contratada_declarada`: onde a aba nada afirma, não há como
        afirmar que faltou cobertura.
        """
        return self.contratada_declarada and self.contratada.valor == 0 and self.medida.valor > 0

    @property
    def sem_quantidade_alguma(self) -> bool:
        """ESPEC 028 `R-ZER-01` — a aba afirma zero contratado **e** zero medido.

        A linha que nada contratou e nada mediu não prova nem cobre coisa
        alguma: é o item que existe na aba porque o catálogo o prevê, não
        porque algo aconteceu com ele no período.

        **Exige `contratada_declarada`** (`R-ZER-03`). Célula vazia não é zero
        (T-1272): onde a aba nada afirma sobre o contratado, não há dois zeros —
        há um zero e um silêncio, e silêncio não autoriza sumir com a linha.

        É afirmação sobre a linha, não decisão sobre o documento: **quem** a
        omite, e **onde**, é escolha do renderizador (`D-02`).
        """
        return self.contratada_declarada and self.contratada.valor == 0 and self.medida.valor == 0

    @property
    def classificacao(self) -> Classificacao:
        """ESPEC 009 `R-ANA-01` a `R-ANA-04` — a situação desta linha.

        Convive com `tem_divergencia` em vez de substituí-la: a ESPEC 002 pergunta
        *bate ou não bate* e continua perguntando isso. As três primeiras situações
        daqui são a decomposição do `True` daquela.

        **Compara `valor`, nunca `formatar()`** (`R-ANA-06`), pela mesma razão de
        `tem_divergencia`: a formatação arredonda para duas casas, e `117,2889…`
        sairia igual a `117,29` — um item divergente classificado como conforme.
        """
        contratada, medida = self.contratada.valor, self.medida.valor
        if contratada < medida:
            return Classificacao.CRITICO
        if contratada > medida:
            if medida == 0:
                return Classificacao.MAIOR_RELEVANCIA
            return Classificacao.DIVERGENTE
        return Classificacao.SEM_DIVERGENCIA


@dataclass(frozen=True)
class LinhaDerivada:
    """T-1508 / ESPEC 021 — uma linha que saiu `1 / 1` por derivação.

    A `R-REL-08` trata medida não numérica como perfil ou pacote e emite 1 e 1.
    É inferência, não leitura: a célula pode dizer `PACOTE` — e a regra acerta —
    ou dizer `N/A` por engano, e aí a linha sai errada em silêncio.

    Este registro é o que torna a inferência visível. Guarda **o que a planilha
    trazia** ao lado de **o que o sistema emitiu**, para que quem confere julgue
    as duas coisas juntas. Substitui a `V-REC-02`, que dizia o mesmo numa frase
    e perdia a quantidade contratada, o número da linha e a descrição da aba.

    Mora aqui, ao lado de `ReportLine`, e **fora do agregado `Report`**: o
    `Report` é o documento que vai ao órgão, e isto é auxílio de conferência. O
    portador é o `ReportResult`.
    """

    # `R-PER-04` / `D-04` — o número **real** da linha no Excel: a aba é lida
    # inteira e enumerada a partir de 1, sem salto. É o endereço da célula, e
    # sem ele conferir vira busca por código.
    linha_na_aba: int
    codigo: str
    # `R-PER-03` / `D-01` — a descrição **da aba**, e não a contratual que o
    # documento usa (`R-REL-07`). As duas divergem, e aqui vale a da planilha:
    # a descrição contratual do `14.048.00008.00` termina na palavra `PERFIL`,
    # cortada antes da letra — justamente no item cujo perfil contratado difere
    # do medido (ESPEC 021 §2.4).
    descricao: str
    # `R-PER-02` / `D-03` — o texto **como o leitor o entrega**. Sem conversão a
    # número, sem vazio virando zero: mostrar o `-` do `14.046.00003.00` como
    # `0` repetiria na tela o apagamento que este registro existe para desfazer.
    contratada_texto: str
    medida_texto: str
    # `D-06` — o `1 / 1` sai daqui, e não de um literal na apresentação.
    # `R-REL-08` é regra de domínio; repeti-la na tela faria a tela mentir no dia
    # em que a regra mudasse, sem que nada acusasse.
    emitida: ReportLine


@dataclass(frozen=True)
class LinhaZerada:
    """T-2150 / ESPEC 031 `R-APU-08` — uma linha que saiu `0` por ausência.

    A `R-APU-03` lê a ausência de um código na apuração descontada como *"mediu
    zero"*. É inferência sobre um **silêncio**: quem monta a planilha expressa o
    zero apagando a linha, e o apagamento é indistinguível de um esquecimento.

    Este registro é o que torna a inferência visível — a mesma decisão que a
    ESPEC 021 tomou com `LinhaDerivada` para o `1 / 1` da `R-REL-08`. Guarda **o
    que a planilha trazia** ao lado de **o que o sistema emitiu**, e nomeia os
    dois blocos, para que quem confere julgue as duas coisas juntas.

    A §11 da ESPEC 031 é o argumento de por que ele não é opcional: sem registro,
    a ESPEC 028 apoiou o exemplo central do seu §1 num `0 / 2` que o próprio
    sistema fabricava, e foram precisos dois incrementos e uma conferência manual
    para alguém perceber.

    Mora ao lado de `LinhaDerivada` e **fora do agregado `Report`**, pelo mesmo
    motivo: o `Report` é o documento que vai ao órgão, e isto é auxílio de
    conferência. O portador é o `ReportResult`.
    """

    #: O número **real** da linha no Excel, para quem for conferir na planilha.
    linha_na_aba: int
    codigo: str
    #: A descrição **da aba** — `R-PER-03` de novo: esta tabela existe para levar
    #: alguém até uma célula, e não para confrontar o contrato.
    descricao: str
    #: Onde a linha está.
    bloco_bruto: str
    #: Onde ela **não** está, e é o que autoriza o zero.
    bloco_descontado: str
    #: O texto da célula, **como o leitor o entrega**. Mostrar aqui o `0` emitido
    #: repetiria na tela o apagamento que este registro existe para desfazer — e
    #: é a promessa da `R-PER-02`, emendada na ESPEC 021 sobre exatamente isto.
    medida_texto: str
    #: `D-06` — o `0` sai daqui, e não de um literal na apresentação.
    emitida: ReportLine


@dataclass(frozen=True)
class DivergenciaDeFonte:
    """T-1712 / ESPEC 023 — o contratado do contrato diverge do da planilha.

    Substitui a frase da ``V-REC-01``, que dizia o mesmo em prosa e obrigava
    quem lê a fazer a subtração de cabeça, uma linha por vez.

    **Carrega os dois estados que a ESPEC 022 tornou distinguíveis.** Antes dela
    o lado do contrato era a proposta sozinha, e a divergência era ambígua por
    construção — podia ser peça faltante, podia ser dado errado, e o sistema não
    tinha como saber. Com os aditivos somados, ``no_aditivo`` responde: onde ele
    existe, a soma já foi feita e a divergência que sobra é de outra natureza.

    Mora ao lado de ``LinhaDerivada`` e **fora do agregado ``Report``**, pelo
    mesmo motivo: o ``Report`` é o documento que vai ao órgão, e isto é auxílio
    de conferência. O portador é o ``ReportResult``.
    """

    codigo: str
    # `R-REL-07` — a designação **contratual**, como o documento usa. Difere da
    # `LinhaDerivada`, que usa a da aba (`R-PER-03`): lá a tabela existe para
    # levar alguém até uma célula da planilha, e aqui para confrontar o contrato.
    descricao: str
    unidade: str
    # O contratado que o consolidado conhece. Com aditivo aplicado já é a soma.
    no_contrato: Decimal
    na_planilha: Decimal
    # `R-FON-04` — o delta que o aditivo trouxe para este código, quando houve.
    # `None` significa *nenhum aditivo tocou este código*, e é o que separa os
    # dois estados (`R-FON-02`).
    no_aditivo: Decimal | None = None

    @property
    def tem_aditivo_aplicado(self) -> bool:
        return self.no_aditivo is not None

    @property
    def na_proposta(self) -> Decimal | None:
        """O contratado **antes** do aditivo. ``None`` quando não houve nenhum.

        Derivado, e não um terceiro campo: guardar os três seria manter a mesma
        aritmética em dois lugares, para divergirem depois. É o que a tela usa
        para escrever `proposta 200,00 + aditivo 1.100,00` — a decomposição que
        prova ao leitor que a soma foi feita, e que ele pode conferir contra o
        PDF (`R-FON-04`).
        """
        if self.no_aditivo is None:
            return None
        return self.no_contrato - self.no_aditivo

    @property
    def diferenca(self) -> Decimal:
        """Quanto falta no contrato para chegar ao que a planilha declara.

        No PGM sem aditivo, esta é **exatamente** a quantidade dos blocos
        ``Aumento`` e ``Redução`` da peça não submetida (ESPEC 023 §2.2) — quem
        abrir o PDF vai encontrar `554,01` lá. É o que transforma o aviso de
        *"algo está diferente"* em *"procure por 554,01 no aditivo"*, e é a razão
        de a tabela existir (`D-03`).
        """
        return self.na_planilha - self.no_contrato

    @property
    def variacao(self) -> Decimal | None:
        """A diferença em proporção do contratado. ``None`` quando ele é zero.

        Existe porque `200 → 1.300` e `42.260 → 42.814` são visualmente
        idênticos na frase de hoje, e um é seis vezes e o outro é 1%.

        Contratado zero não é divisível e **não é erro**: o código existe no
        contrato com quantidade nula. A tela mostra um traço, e a ordenação o
        trata como a maior magnitude possível — proporcionalmente, é.
        """
        if self.no_contrato == 0:
            return None
        return self.diferenca / self.no_contrato * 100

    @property
    def magnitude(self) -> Decimal:
        """Chave de ordenação de ``R-FON-06`` — maior primeiro, sinal ignorado."""
        variacao = self.variacao
        return Decimal("Infinity") if variacao is None else abs(variacao)

    @property
    def severidade(self) -> Classificacao:
        """`R-FON-02` — o eixo da ESPEC 009, sem cor nem enum novo.

        Sem aditivo aplicado, o diagnóstico provável é *falta uma peça*, e a
        ação é anexá-la: `MAIOR_RELEVANCIA`.

        Com aditivo aplicado, os números não fecham **nem com a peça** — falta
        outra, ou um dos dois documentos está errado. É o mais próximo de *dado
        errado* que o sistema detecta: `CRITICO`.
        """
        return (
            Classificacao.CRITICO
            if self.tem_aditivo_aplicado
            else Classificacao.MAIOR_RELEVANCIA
        )


@dataclass
class Report:
    """As páginas 2 em diante do relatório, em memória.

    **Sem agrupamento** (ESPEC 018 `R-REL-05`). O documento é uma tabela
    contínua: as linhas que o contrato ordena, e depois `demais_itens`, com o
    que só a aba `Levantamento` conhece.
    """

    titulo: str
    data_levantamento: date | None
    contrato_referencia: str
    proposta_origem: str
    # ESPEC 019 `R-ADT-11` — as peças do quantitativo, para o rodapé concordar em
    # número. `proposta_origem` já vem com elas nomeadas em português; esta é a
    # contagem, e existe porque *"a proposta X"* e *"as propostas X e Y"* não se
    # distinguem olhando a cadeia pronta.
    propostas: tuple[str, ...] = ()
    # ESPEC 020 `R-CAP-04` — o nome do órgão, derivado da primeira página da
    # proposta. Por último e com padrão, como `blocos` e `propostas`: `Report` é
    # construído com argumentos parciais em vários testes.
    cliente: str = ""
    # `R-REL-03` — os códigos que o contrato traz, na ordem de aparição dele.
    linhas: list[ReportLine] = field(default_factory=list)
    # `D-06` — o que a aba traz e o contrato não. Sai ao final, sob o título
    # `DEMAIS ITENS DO LEVANTAMENTO`, na ordem da aba. Substitui o
    # `sem_previsao_contratual` da `R-DIV-05`, que **omitia** essas linhas do
    # documento: nada mais é omitido (`D-04`).
    demais_itens: list[ReportLine] = field(default_factory=list)
    # ESPEC 004 — as abas de detalhamento, que viram páginas **depois** da
    # tabela de comprovação (`R-ANX-01`).
    anexos: list[Anexo] = field(default_factory=list)

    # ── ESPEC 020 · os campos da capa ─────────────────────────────────────────
    #
    # Vivem aqui, e não no renderizador, porque são **derivação de dado**, não de
    # apresentação: o renderizador só escolhe onde escrever. É o que permite
    # testá-las sem gerar DOCX.

    @property
    def subtitulo_da_capa(self) -> str:
        """`R-CAP-05` — o miolo do título da aba `Levantamento`.

        `LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT`
        rende `SMIT SUSTENTAÇÃO` — que é, caractere por caractere, o que a capa do
        modelo já trazia gravado. O que parecia dado editorial é derivável.

        Título fora do padrão cai para o contrato (`R-CAP-10`): nenhum campo da
        capa sai vazio.
        """
        achado = _SUBTITULO.match(self.titulo or "")
        return achado.group(1) if achado else self.contrato_referencia

    @property
    def cliente_da_capa(self) -> str:
        """`R-CAP-04` / `R-CAP-10` — o órgão, ou o degrau seguinte da cascata.

        Quando a proposta não permite derivar o nome, a capa **não fica com o nome
        de ninguém**: cai para o subtítulo, que vem da aba e sempre existe.
        `PGM TC 015` é menos formal que `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO
        PAULO`, e nunca é o cliente errado.
        """
        return self.cliente or self.subtitulo_da_capa

    @property
    def propostas_da_capa(self) -> str:
        """`R-CAP-07` — as peças submetidas, unidas por ` / `.

        Não a pilha histórica: ela é irrecuperável de forma uniforme — o PGM
        declara a sua em prosa, o SMIT não declara nada (`D-04`).
        """
        return " / ".join(self.propostas) or self.proposta_origem

    @property
    def todas_as_linhas(self) -> list[ReportLine]:
        return [*self.linhas, *self.demais_itens]

    @property
    def total_linhas(self) -> int:
        return len(self.todas_as_linhas)

    @property
    def sem_previsao_contratual(self) -> list[ReportLine]:
        """As linhas medidas sem cobertura contratual, onde quer que estejam.

        Deixou de ser uma lista à parte e virou leitura: com o universo vindo da
        aba, a condição é atributo da linha (`sem_cobertura_contratual`), não do
        lugar dela no agregado.
        """
        return [linha for linha in self.todas_as_linhas if linha.sem_cobertura_contratual]

    def apenas_divergencias(self) -> list[ReportLine]:
        """ESPEC 002 `R-DIV-03` — as linhas do relatório que divergem.

        Devolvia seções; devolve lista, pela mesma razão de o documento ter
        deixado de tê-las. A ordem é a do relatório, para que cada linha do grid
        seja reconhecível ao lado da mesma linha no documento.
        """
        return [linha for linha in self.todas_as_linhas if linha.tem_divergencia]

    @property
    def total_divergencias(self) -> int:
        return len(self.apenas_divergencias())

    def universo_da_analise(self) -> list[tuple[ReportLine, bool]]:
        """ESPEC 009 `R-ANA-07` / `D-01` — o que a análise classifica.

        Todas as linhas do documento, cada uma com a marca que diz se houve
        consumo sem cobertura contratual.

        O universo cresceu com a ESPEC 018 — antes eram as linhas do relatório
        mais os itens que a `R-DIV-05` mantinha fora dele; agora o documento já
        os contém. A marca sobrevive porque é ela que faz o item cair em
        *crítico* na análise, e essa leitura não mudou.
        """
        return [(linha, linha.sem_cobertura_contratual) for linha in self.todas_as_linhas]
