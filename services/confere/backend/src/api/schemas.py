"""Contratos da API (Pydantic v2)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Achado(BaseModel):
    validacao: str = Field(description="Identificador da validação — ex.: V-CTR-03")
    severidade: str = Field(description="BLOQUEIA, AVISA ou PERGUNTA (ESPEC 029)")
    mensagem: str
    codigo: str | None = None

    # ESPEC 025 `R-DOC-05` — as quatro partes, **opcionais**.
    #
    # Achado antigo continua chegando só com `mensagem`, e a tela o renderiza
    # como sempre (`T-1932`). É o que torna esta entrega compatível nos dois
    # sentidos e reversível sem tocar em cliente nenhum.
    titulo: str = ""
    causa: str = ""
    acao: str = ""
    detalhe: str = ""


class DivergenciaDeFonte(BaseModel):
    """ESPEC 023 `R-FON-01` — o contratado do contrato diverge do da planilha.

    Substitui a frase da `V-REC-01`. As quantidades vêm **formatadas**, como em
    `LinhaDoGrid` e pelo mesmo motivo: a regra de formatação é de domínio, e
    duplicá-la em TypeScript a poria em duas linguagens.
    """

    codigo: str
    descricao: str
    unidade: str
    no_contrato: str
    na_planilha: str
    no_aditivo: str | None = Field(
        default=None,
        description="O delta que o aditivo trouxe. Ausente quando nenhum tocou o código",
    )
    na_proposta: str | None = Field(
        default=None,
        description="O contratado antes do aditivo. Com `no_aditivo`, forma a decomposição",
    )
    diferenca: str
    variacao_pct: float | None = Field(
        default=None, description="Nulo quando o contratado é zero e a proporção não existe"
    )
    tem_aditivo_aplicado: bool = Field(
        description="Separa os dois estados de `R-FON-02`: falta peça × não fecha nem com ela"
    )
    severidade: str = Field(description="CRITICO ou MAIOR_RELEVANCIA (ESPEC 009)")


class RespostaBloqueada(BaseModel):
    """Devolvida quando há achado bloqueante — nunca acompanha PDF.

    Emitir um relatório com número possivelmente errado é pior que não emitir:
    ele instrui faturamento.
    """

    detalhe: str = "processamento bloqueado por validação"
    bloqueantes: list[Achado]
    avisos: list[Achado]
    # T-2095 / ESPEC 029 `R-IDT-10` — os achados que **uma resposta destrava**.
    #
    # Lista própria, e não misturada com `bloqueantes`, porque a tela faz com
    # eles uma coisa que não faz com os outros: oferece um botão que segue assim
    # mesmo. Padrão vazio para não quebrar cliente que já lê este corpo.
    confirmaveis: list[Achado] = []
    pode_prosseguir: bool = Field(
        default=False,
        description=(
            "Verdadeiro quando **só** há confirmáveis: reenviar com "
            "`identidade_confirmada` produz o relatório"
        ),
    )


class RespostaDaConferencia(BaseModel):
    """ESPEC 029 `R-IDT-10` — a resposta do portão, em menos de um segundo.

    Devolvida por `POST /reports/conferencia-previa`, que lê **só** a primeira
    página de cada peça e o cabeçalho da aba. `combinam=True` inclui o caso em
    que algum lado não declara identidade: ausência de sinal é ausência de
    evidência, nunca acusação (`R-IDT-06`).
    """

    combinam: bool
    contrato: str | None = Field(default=None, description="O contrato que a peça declara")
    levantamento: str | None = Field(
        default=None, description="O contrato que a aba declara"
    )
    achados: list[Achado] = []


class LinhaDoGrid(BaseModel):
    """As cinco colunas do relatório (ESPEC 002 R-DIV-02).

    As quantidades vêm **formatadas**, e não como número: têm de sair idênticas
    às do PDF, inclusive na escolha entre `MILHAR` e `SIMPLES` por item. Deixar
    a formatação para o frontend duplicaria a regra em duas linguagens.
    """

    codigo: str
    descricao: str
    unidade: str
    contratada: str
    medida: str
    saldo: str = Field(description="Contratada menos medida; negativo indica consumo acima")
    perfil_ou_pacote: bool = False
    # ESPEC 009 `R-API-02` — campo **aditivo**, com padrão. A mesma linha serve ao
    # grid de divergências e às quatro situações da análise; uma segunda classe
    # quase igual seria duas definições da mesma coisa para manter em sincronia.
    sem_previsao_contratual: bool = Field(
        default=False,
        description="Item medido sem contrapartida no contrato (ESPEC 002 R-DIV-05)",
    )




class LinhaDerivada(BaseModel):
    """T-1511 / ESPEC 021 — uma linha que saiu `1 / 1` por derivação.

    Substitui a `V-REC-02`, que dizia o mesmo numa frase e perdia a quantidade
    contratada, o número da linha e a descrição da aba. O que a `Achado` não
    conseguia carregar em quatro campos de texto viaja aqui em seis.
    """

    linha: int = Field(description="Número da linha na aba `Levantamento` — o endereço da célula")
    codigo: str
    descricao: str = Field(description="A descrição **da aba**, não a contratual (`D-01`)")
    contratada: str = Field(
        description="Texto da célula, como o leitor o entrega — não normalizado (`R-PER-02`)"
    )
    medida: str = Field(
        description="Texto da célula, como o leitor o entrega — não normalizado (`R-PER-02`)"
    )
    # Uma cadeia só, e não dois campos: a junção ` / ` é decisão sobre um fato de
    # domínio (`R-REL-08`), e reparti-la entre backend e componente a colocaria
    # em duas linguagens — o mesmo motivo pelo qual `LinhaDoGrid` já traz as
    # quantidades formatadas daqui.
    saiu: str = Field(description="O que o documento recebeu — `1 / 1` (`D-06`)")


class LinhaZerada(BaseModel):
    """T-2160 / ESPEC 031 `R-APU-08` — uma linha que saiu `0` por ausência.

    Irmã da `LinhaDerivada`, e pelo mesmo motivo: um número que o sistema
    **inferiu** precisa chegar a quem confere com o que a planilha trazia ao
    lado, ou vira premissa de argumento alheio (ESPEC 031 §11).

    A inferência aqui é sobre um **silêncio** — a linha que a apuração descontada
    não repete —, e silêncio é indistinguível de esquecimento. Por isso os dois
    blocos são nomeados: quem confere vai à planilha e olha.
    """

    linha: int = Field(description="Número da linha na aba `Levantamento`")
    codigo: str
    descricao: str = Field(description="A descrição **da aba**, não a contratual")
    bloco_bruto: str = Field(description="Onde a linha está")
    bloco_descontado: str = Field(description="Onde ela **não** está — o que autoriza o zero")
    medida: str = Field(
        description="Texto da célula no bloco bruto, intacto — o que o zero substituiu"
    )
    saiu: str = Field(description="O que o documento recebeu — `contratada / 0`")


class SituacaoDaAnalise(BaseModel):
    """Uma das quatro situações da ESPEC 009 §5, com os itens que caíram nela."""

    classificacao: str = Field(
        description="CRITICO, MAIOR_RELEVANCIA, DIVERGENTE ou SEM_DIVERGENCIA"
    )
    rotulo: str
    glosa: str = Field(description="O critério em palavras — a informação não é só a cor")
    quantidade: int
    perfis_ou_pacotes: int = Field(
        description="Itens que entram como 1/1 por R-REC-04 e nunca poderiam divergir"
    )
    linhas: list[LinhaDoGrid]


class Analise(BaseModel):
    """ESPEC 009 — a leitura por gravidade, ao lado da leitura por seção.

    `situacoes` traz **sempre as quatro**, inclusive vazias: quem exibe não
    decide quais existem, e "nenhum item crítico" é resultado (`R-API-01`).
    """

    contrato_referencia: str
    proposta_origem: str
    competencia: str = Field(description="Mês por extenso — ex.: julho/2026")
    total_itens: int = Field(description="Soma das quatro situações (R-ANA-05)")
    situacoes: list[SituacaoDaAnalise]


class RespostaRelatorio(BaseModel):
    """Resposta de sucesso: o grid de divergências mais o documento.

    O documento vai embutido em base64 porque a aplicação é sem estado — não há
    onde guardá-lo entre duas chamadas. Processar duas vezes custaria o dobro
    pelo mesmo resultado, e um cache com identificador traria estado de volta.
    """

    titulo: str
    data_levantamento: str | None
    contrato_referencia: str
    total_linhas: int = Field(description="Linhas do documento")
    total_divergencias: int = Field(description="Linhas exibidas no grid")
    # ESPEC 018 `R-REL-05` — era `secoes: list[SecaoDoGrid]`. O documento perdeu
    # o agrupamento, e o grid o acompanha: lista única, na ordem do relatório.
    divergencias: list[LinhaDoGrid]
    # `D-06` — o que a aba `Levantamento` traz e o contrato não conhece. Deixou
    # de ser o `sem_previsao_contratual` da `R-DIV-05`, que **omitia** essas
    # linhas do documento: agora elas estão nele, no bloco final.
    demais_itens: list[LinhaDoGrid]
    analise: Analise
    # ESPEC 021 — as linhas `1 / 1` por derivação, na ordem da aba. Ausente da
    # `RespostaBloqueada` de propósito: o laço que as acumula roda **depois** do
    # `if achados.bloqueado`, então o caminho bloqueado não tem nenhuma.
    linhas_derivadas: list[LinhaDerivada]
    # `R-APU-08` — aditivo, com padrão: resposta sem zeradas é a esmagadora
    # maioria, e um campo obrigatório quebraria todo cliente que já existe.
    linhas_zeradas: list[LinhaZerada] = []
    avisos: list[Achado]
    # ESPEC 023 — as divergências de contratado, na ordem de `R-FON-06`.
    # Ausente da `RespostaBloqueada` pelo mesmo motivo das derivadas: o
    # caminho bloqueado retorna antes de qualquer comparação.
    divergencias_de_fonte: list[DivergenciaDeFonte] = []
    docx_base64: str
    # O XLSX viaja embutido pelo mesmo motivo do documento, e custa muito menos:
    # ~20 KB contra as ~41 páginas do `.docx`.
    analise_xlsx_base64: str


class RespostaErro(BaseModel):
    detalhe: str


class Saude(BaseModel):
    status: str = "ok"
