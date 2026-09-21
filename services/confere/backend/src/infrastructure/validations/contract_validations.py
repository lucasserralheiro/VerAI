"""T-21 / T-22 — Validações do contrato (ESPEC 001 §6).

Cada validação é uma unidade nomeada pelo identificador da especificação, com
teste próprio. Todas são bloqueantes: sem contrato lido corretamente não há
relatório possível, e emitir um com número errado é pior que não emitir.
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal
from enum import StrEnum

from domain.entities.contract import Contract, DiagnosticoDaGrade
from domain.entities.measurement import Measurement
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.contract.grid import COLUNAS_DA_TABELA, TOLERANCIA

TOLERANCIA_CHECKSUM = Decimal("0.01")


def v_ctr_01_tabela_localizada(contrato: Contract, achados: ValidationReport) -> None:
    """A tabela de itens foi localizada e tem ao menos uma linha.

    ``R-GRD-07`` — a mensagem carrega o que a extração observou. Sem isso, quem
    dá suporte recebe *"não localizada"* e não tem por onde começar: PDF
    digitalizado, layout novo e arquivo errado produzem exatamente o mesmo
    texto.
    """
    if contrato.itens:
        return

    mensagem = (
        "tabela de itens não localizada no contrato — verifique se o PDF é a "
        "proposta comercial completa"
    )
    if contrato.diagnostico is not None:
        mensagem = f"{mensagem} [{contrato.diagnostico.resumir()}]"

    achados.registrar("V-CTR-01", Severity.BLOQUEIA, mensagem)


def v_ctr_05_codigo_contratado_ausente_da_aba(
    contrato: Contract, medicao: Measurement, achados: ValidationReport
) -> None:
    """T-1224 — código do contrato que a aba `Levantamento` não traz.

    Preserva a metade útil da ``V-CAT-03``, que morreu com o catálogo. Com o
    universo vindo da aba (`R-REL-01`), um código contratado que ela não traga
    **não vira linha** — e essa ausência precisa aparecer para quem confere.

    Avisa, não bloqueia: o documento sai, com a ressalva registrada. Não ocorre
    em nenhum dos dois pares reais — a aba contém o contrato inteiro nos dois
    (ESPEC 018 §2.2) —, e existe para o dia em que ocorrer.
    """
    for codigo in sorted(contrato.codigos - medicao.codigos):
        achados.registrar_em_partes(
            "V-CTR-05",
            Severity.AVISA,
            titulo=(
                f"O código {codigo} está no contrato, mas não tem registro de uso "
                "no levantamento."
            ),
            causa=(
                "Ele está na tabela de preços do contrato, mas não aparece na "
                "planilha de medição desta competência."
            ),
            acao=(
                "Este item não entrará no relatório — confira se ele deveria ter "
                "sido medido nesta competência."
            ),
            codigo=codigo,
        )


def _onde_a_grade_descartou(contrato: Contract) -> str:
    """T-2263 / ESPEC 035 ``R-GRD-10`` — a metade da mensagem que faltava.

    ``V-CTR-03`` sabia dizer *quanto* faltava e nunca soube dizer *onde*. No
    ``PA-FTM-251001-143`` o sintoma disponível foi *"faltam R$ 51.676,20"*, e a
    página só apareceu por subtração sobre o valor declarado (ESPEC 035 §2.6).

    **Sufixo condicional, e é o que o mantém sem risco:** não havendo descarte, a
    mensagem sai byte por byte igual à de sempre.

    **Nem todo descarte é perda**, e a frase evita prometer que é: prosa acima da
    tabela entra na conta e está certa — são 177 palavras na página 25 do piloto.
    O que a mensagem diz é *onde a grade viu palavra e não guardou*, que é uma
    pista, e não um veredito. Ela só aparece quando o checksum **já** não fechou.

    As três maiores primeiro, porque a página que perdeu a linha costuma ser a
    que mais descartou — e porque uma lista de dez páginas não é pista de nada.
    """
    diagnostico = contrato.diagnostico
    if diagnostico is None or not diagnostico.palavras_descartadas:
        return ""

    maiores = sorted(diagnostico.palavras_descartadas, key=lambda p: (-p[1], p[0]))[:3]
    total = sum(quantas for _, quantas in diagnostico.palavras_descartadas)

    # Com uma página só, a contagem por página **é** o total, e repeti-la entre
    # parênteses faz o leitor procurar a diferença entre dois números iguais.
    if len(maiores) == 1:
        onde = f"na página {maiores[0][0]}"
    else:
        lista = ", ".join(f"{pagina} ({quantas})" for pagina, quantas in maiores)
        onde = f"nas páginas {lista}"

    return (
        f" — e a grade descartou {total} palavras fora de qualquer linha "
        f"da tabela, {onde}"
    )


def v_ctr_03_checksum(contrato: Contract, achados: ValidationReport) -> None:
    """A soma dos totais das linhas bate com o ``TOTAL`` declarado no contrato.

    É a prova de ponta a ponta da extração (PLANO 001 D-03). Uma linha perdida
    por quebra de célula ou por cair fora da moldura altera a soma, e a
    validação acusa — em vez de o relatório sair silenciosamente com um item a
    menos.
    """
    if contrato.total_declarado is None:
        achados.registrar(
            "V-CTR-03",
            Severity.BLOQUEIA,
            "total do contrato não localizado — impossível conferir a extração",
        )
        return

    diferenca = abs(contrato.soma_dos_totais - contrato.total_declarado)
    if diferenca > TOLERANCIA_CHECKSUM:
        achados.registrar(
            "V-CTR-03",
            Severity.BLOQUEIA,
            f"extração incompleta: a soma dos itens ({contrato.soma_dos_totais}) "
            f"não bate com o total declarado ({contrato.total_declarado}) — "
            f"diferença de {diferenca}" + _onde_a_grade_descartou(contrato),
        )


class CausaProvavel(StrEnum):
    """T-1918 / ESPEC 025 `R-DOC-03` — por que este PDF não rendeu itens.

    Três valores, na ordem em que são perguntados, e a **ordem importa**: um PDF
    digitalizado também não tem tabela, e dizer *"não há tabela de preços"* a
    quem escaneou o documento manda a pessoa para o lado errado.
    """

    SEM_TEXTO = "SEM_TEXTO"
    SEM_TABELA = "SEM_TABELA"
    TABELA_SEM_CODIGOS = "TABELA_SEM_CODIGOS"


def causa_provavel(diagnostico: DiagnosticoDaGrade) -> CausaProvavel:
    """A causa, decidida **só** sobre o diagnóstico.

    Função pura, sem PDF e sem `Contract`, no lugar e no espírito de
    `_escolher_gabarito` (ESPEC 017): é o que permite exercitar os quatro
    degraus da `R-DOC-03` sem abrir arquivo — inclusive o degrau *sem camada de
    texto*, para o qual o repositório não tem fixture (`D-04`).
    """
    if diagnostico.paginas_com_texto == 0:
        return CausaProvavel.SEM_TEXTO
    if diagnostico.geometrias_candidatas == 0:
        return CausaProvavel.SEM_TABELA
    return CausaProvavel.TABELA_SEM_CODIGOS


def _frase_da_causa(diagnostico: DiagnosticoDaGrade) -> str:
    """ESPEC 025 §9.2 — a evidência, em vocabulário de quem confere.

    A frase existe para o leitor poder **discordar**: quem souber que aquele PDF
    é a proposta certa lê aqui exatamente o que contar ao suporte.
    """
    causa = causa_provavel(diagnostico)
    if causa is CausaProvavel.SEM_TEXTO:
        return (
            f"Este PDF é uma imagem digitalizada: não há texto em nenhuma das "
            f"{diagnostico.paginas} páginas."
        )
    if causa is CausaProvavel.SEM_TABELA:
        return (
            f"Não há tabela de preços neste PDF: nenhuma das "
            f"{diagnostico.paginas} páginas traz uma tabela de sete colunas."
        )
    quantas = diagnostico.geometrias_candidatas
    if quantas == 1:
        sujeito = "A única tabela de sete colunas deste PDF não traz"
    else:
        sujeito = f"As {quantas} tabelas de sete colunas deste PDF não trazem"
    return (
        f"{sujeito} códigos de serviço, e a primeira página não traz "
        '"Proposta Comercial" nem "Proposta de Aditivo:".'
    )


def _frase_da_acao(diagnostico: DiagnosticoDaGrade, papel: str) -> str:
    """ESPEC 025 §9.2 — o que fazer, em um passo.

    A primeira frase é fixa e **verdadeira para todo arquivo recusado** (`D-06`):
    o sistema não precisa saber o que o documento é, só o que o campo exige. A
    segunda só existe quando a página 1 cita propostas — é acréscimo, nunca
    fundação.
    """
    if causa_provavel(diagnostico) is CausaProvavel.SEM_TEXTO:
        return (
            "Envie o PDF original da proposta, gerado pelo sistema — não a "
            "versão escaneada."
        )

    acao = (
        f"Envie no campo {papel} o PDF da proposta comercial — o documento com "
        "a tabela de itens, com códigos de serviço e preços."
    )
    if diagnostico.referencias:
        citadas = ", ".join(diagnostico.referencias)
        acao = f"{acao} Este PDF cita as propostas {citadas}. Envie uma delas."
    return acao


def _detalhe(diagnostico: DiagnosticoDaGrade) -> str:
    """ESPEC 025 §9 — os números da extração, para o suporte.

    É o colchete que a §1 tirou do meio da frase. Ele **não se perde**: muda de
    altura, e passa a viver recolhido, onde quem dá suporte o encontra e quem
    confere não tropeça nele (`R-GRD-07` continua valendo, com outro destino).
    """
    partes = [diagnostico.resumir()]
    if diagnostico.geometrias_candidatas:
        partes.append(
            f"{diagnostico.geometrias_candidatas} geometrias de 7 colunas, "
            f"códigos em cada: {list(diagnostico.codigos_nas_candidatas)}"
        )
    return " · ".join(partes)


def v_doc_01_peca_nao_e_proposta(
    peca: Contract,
    papel: str,
    achados: ValidationReport,
    nome_do_arquivo: str = "",
) -> None:
    """T-1921 / ESPEC 025 `V-DOC-01` — o arquivo submetido não é uma proposta.

    Separa da `V-ADT-01` os dois casos que ela cobria com o mesmo texto e que
    têm **donos opostos**: *você enviou o arquivo errado* — conserto do usuário,
    dez segundos — e *este layout eu não sei ler* — conserto da engenharia, por
    suporte. Enquanto os dois produziam a mesma frase, nenhuma redação podia ser
    clara: a mensagem não pode distinguir o que o sistema não distinguiu.

    **Sem diagnóstico não registra** (`R-DOC-02`). A ausência do objeto é
    ausência de evidência, não evidência do contrário — e trinta e tantos pontos
    da suíte constroem `Contract` sem ele. A `T-1904` guarda esta linha.
    """
    if peca.itens or peca.diagnostico is None or peca.diagnostico.parece_proposta:
        return

    diagnostico = peca.diagnostico
    achados.registrar_em_partes(
        "V-DOC-01",
        Severity.BLOQUEIA,
        titulo=(
            f"O arquivo enviado no campo {papel} não é uma proposta comercial"
            f" ({_identificar(peca, nome_do_arquivo)})."
        ),
        causa=_frase_da_causa(diagnostico),
        acao=_frase_da_acao(diagnostico, papel),
        detalhe=_detalhe(diagnostico),
    )


def _identificar(peca: Contract, nome_do_arquivo: str) -> str:
    """T-1910 / ESPEC 025 `R-DOC-06` — como a peça aparece na tela.

    A identificação interna vem primeiro: `PA-SMIT-260319-739` é o número que a
    proposta carrega e o que quem confere reconhece. O nome do arquivo é a
    segunda escolha, e existe para o caso em que **não há** identificação
    interna — o relatório GRC não traz `Proposta de Aditivo:`, e a tela dizia
    *"contrato (sem identificação)"* a quem submeteu quatro arquivos.
    """
    return peca.proposta or nome_do_arquivo or "(sem identificação)"


def v_adt_01_peca_sem_itens(
    peca: Contract,
    papel: str,
    achados: ValidationReport,
    nome_do_arquivo: str = "",
) -> None:
    """T-1330 / ESPEC 019 `V-ADT-01` — peça submetida da qual nada foi extraído.

    É o defeito que estava no ar: o aditivo do PGM rendia **zero itens e nenhum
    erro**, porque `R-GRD-02` procurava oito divisórias por página e um aditivo é
    feito de blocos curtos que dividem folha.

    Bloqueia, e é indispensável desde que `D-07` tirou o checksum do consolidado:
    sem ela, um aditivo ilegível soma zero, o relatório sai como se ele não
    existisse, e nada acusa. `V-CTR-01` cobre a proposta; esta cobre cada peça
    pelo nome, que é o que quem submeteu precisa ler.
    """
    if peca.itens:
        return

    # T-1922 / ESPEC 025 `R-DOC-04` — **a peça que não é proposta não é desta
    # validação.** `V-DOC-01` a cobre, e com a ação certa: trocar o arquivo, e
    # não abrir chamado. Sem diagnóstico o caminho continua sendo este, pela
    # leitura conservadora da `R-DOC-02`.
    if peca.diagnostico is not None and not peca.diagnostico.parece_proposta:
        return

    # O papel fica no título: com aditivos anexados, saber **em qual campo** o
    # arquivo entrou é o que permite trocá-lo (`R-DOC-06`).
    causa = (
        "Este PDF é uma proposta — a primeira página a identifica —, mas a "
        "tabela de itens está num formato que o Confere ainda não lê."
        if peca.diagnostico is not None
        else ""
    )
    achados.registrar_em_partes(
        "V-ADT-01",
        Severity.BLOQUEIA,
        titulo=(
            "Não conseguimos ler a tabela de itens da proposta "
            f"{_identificar(peca, nome_do_arquivo)}, enviada no campo {papel}."
        ),
        causa=causa,
        # A frase é o conteúdo da tarefa, não enfeite: sem ela quem recebe a
        # mensagem tenta outros arquivos até desistir, que é o comportamento que
        # a espec existe para evitar.
        acao=(
            "Não é erro no seu envio. Encaminhe este arquivo ao suporte com os "
            "detalhes técnicos."
        ),
        detalhe=_detalhe(peca.diagnostico) if peca.diagnostico else "",
    )


def v_adt_02_aditivo_sem_efeito(aditivo: Contract, achados: ValidationReport) -> None:
    """ESPEC 019 `V-ADT-02` — aditivo lido, com blocos, e sem `Inclusão`/`Exclusão`.

    Quem submeteu o arquivo precisa saber o que ele fez — senão vai procurar, num
    documento idêntico ao anterior, a diferença que ele não produziu.

    T-1622 / ESPEC 022 `R-QTD-08` — **a mensagem passou a separar duas coisas que
    a ESPEC 019 podia tratar como uma só.** Naquela espec, aditivo só de
    quantitativo não tinha efeito nenhum: `R-ADT-06` descartava `Aumento` e
    `Redução`, e dizer *"o relatório sai igual"* descrevia o arquivo inteiro.

    Agora os deltas são somados (`R-QTD-01`), e o arquivo tem **um** efeito e não
    **nenhum**: o documento continua idêntico — `R-REL-04` faz as quantidades
    virem da aba —, mas o contratado consolidado muda, e com ele a comparação da
    `V-REC-01`. Manter a frase antiga faria a validação afirmar que o arquivo foi
    inócuo quando ele acabou de corrigir a conferência.

    O predicado **não muda** (`D-06`): `altera_o_conjunto` é sobre quais códigos
    existem, e continua sendo a pergunta certa para saber se o documento se move.

    É também a rede do único ponto não medido da ESPEC 019: um bloco `Exclusão`
    grafado de forma que `RotuloDeBloco` não reconheça cai aqui, em vez de sumir
    calado.
    """
    if any(bloco.altera_o_conjunto for bloco in aditivo.blocos):
        return

    rotulos = ", ".join(
        str(bloco.rotulo) if bloco.rotulo else "sem rótulo" for bloco in aditivo.blocos
    )
    achados.registrar_em_partes(
        "V-ADT-02",
        Severity.AVISA,
        titulo=f"O aditivo {aditivo.proposta} não altera o escopo do contrato.",
        causa=(
            f"Ele traz apenas {rotulos or 'nenhum bloco'}, que mudam quantidade — "
            "não inclui nem exclui itens."
        ),
        acao=(
            "Não é preciso fazer nada — o documento sai igual ao que sairia sem "
            "este aditivo; as quantidades entram na conferência do contratado."
        ),
    )


def v_adt_03_peca_repetida_ou_trocada(
    proposta: Contract, aditivos: Sequence[Contract], achados: ValidationReport
) -> None:
    """ESPEC 019 `V-ADT-03` — peça repetida.

    Submeter o mesmo aditivo duas vezes duplicaria as suas inclusões. Bloqueia
    pelo identificador `Proposta de Aditivo:`, que §2.1 mede presente e
    distinto nas três peças.

    ESPEC 046 — a segunda forma que esta validação tinha, **removida**. Um
    aditivo com bloco único e sem rótulo — a forma do piloto — bloqueava aqui,
    porque `Contract.aplicar()` o descartaria por completo, em silêncio. A
    ESPEC 046 removeu o bloqueio, por pedido explícito e com o risco
    registrado (ESPEC 046 §9): esse aditivo passa a ser tratado exatamente
    como uma proposta sempre foi — sem checagem nenhuma —, e continua sendo
    descartado por `Contract.aplicar()` do mesmo jeito. Só deixou de haver
    aviso disso.
    """
    vistas: dict[str, int] = {}
    for peca in (proposta, *aditivos):
        if not peca.proposta:
            continue
        vistas[peca.proposta] = vistas.get(peca.proposta, 0) + 1

    for identificacao, quantas in vistas.items():
        if quantas > 1:
            achados.registrar(
                "V-ADT-03",
                Severity.BLOQUEIA,
                f"a peça {identificacao} foi submetida {quantas} vezes — "
                "as suas inclusões entrariam em duplicata",
            )


def v_adt_04_movimento_de_codigo_ausente(
    consolidado: Contract, aditivos: Sequence[Contract], achados: ValidationReport
) -> None:
    """ESPEC 019 `V-ADT-04` / `R-ADT-06a` — aumentar o que não foi contratado.

    Não se aumenta nem se reduz código que a proposta consolidada não contém. Se
    aparecer, é uma de duas coisas, e as duas importam:

    - **falta uma peça intermediária** — o aditivo que incluiu aquele código não
      foi submetido;
    - o bloco está **rotulado errado** — era uma inclusão.

    Nos dois casos o código sai no bloco `DEMAIS ITENS` em vez do corpo ordenado,
    e sem este aviso isso aconteceria em silêncio. É, de quebra, o detector
    automático de peça faltante que o `I-03` pedia.

    Avisa e não bloqueia: o relatório continua utilizável, com o item visível no
    bloco final e os números que a aba declara.

    Não dispara no PGM — §2.8 mede que os cinco códigos de `Aumento` e `Redução`
    estão todos na proposta.
    """
    conhecidos = consolidado.codigos
    for aditivo in aditivos:
        for codigo in sorted(aditivo.codigos_ignorados() - conhecidos):
            achados.registrar_em_partes(
                "V-ADT-04",
                Severity.AVISA,
                titulo=f"O código {codigo} foi alterado por um aditivo, mas não está no contrato.",
                causa=(
                    f"O aditivo {aditivo.proposta} altera a quantidade desse código, "
                    "mas ele não consta da proposta original — falta uma peça anterior, "
                    "ou o bloco está rotulado como aumento em vez de inclusão."
                ),
                acao=(
                    "A linha sairá no bloco final do relatório — confira se falta "
                    "anexar algum aditivo."
                ),
                codigo=codigo,
            )


def v_cap_01_cliente_nao_derivado(
    proposta: Contract, achados: ValidationReport
) -> None:
    """T-1424 / ESPEC 020 `V-CAP-01` — o órgão não saiu da primeira página.

    A capa **não fica com o nome de ninguém**: cai para o subtítulo da aba
    (`R-CAP-10`), que sempre existe. `PGM TC 015` é menos formal que
    `PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO`, e nunca é o cliente errado.

    Avisa e não bloqueia: o caminho de falha tem saída segura e correta, e barrar
    a geração por causa de uma linha de capa seria pior que o problema. Quem
    confere precisa saber que a identificação é a curta.

    Não dispara em nenhum dos dois pares reais — `R-CAP-04` casa nas duas
    propostas (ESPEC 020 §2.4).
    """
    if proposta.cliente:
        return

    achados.registrar_em_partes(
        "V-CAP-01",
        Severity.AVISA,
        titulo="O nome do órgão não foi identificado automaticamente na proposta.",
        causa=(
            "O sistema não conseguiu localizar o nome do cliente na primeira "
            f"página da proposta {proposta.proposta}."
        ),
        acao=(
            "A capa do relatório usará o nome que está no título da planilha de "
            "levantamento."
        ),
    )


def v_ctr_04_geometria_nao_canonica(
    contrato: Contract, achados: ValidationReport
) -> None:
    """``R-GRD-08`` — o contrato foi lido por geometria diferente da conhecida.

    Avisa e não bloqueia, pelo princípio da ``V-CAT-03``: documento que sai com
    aviso é conferível. E há prova independente de que a leitura está certa — o
    checksum de ``V-CTR-03``, que bloqueia se a soma não fechar.

    Não dispara no piloto por construção: o gabarito derivado dele **é**
    ``COLUNAS_DA_TABELA``. Existe para o dia em que um contrato de layout novo
    entrar sem ninguém perceber que entrou.
    """
    diagnostico = contrato.diagnostico
    if diagnostico is None or diagnostico.gabarito is None:
        return

    gabarito = diagnostico.gabarito
    canonico = len(gabarito) == len(COLUNAS_DA_TABELA) and all(
        abs(derivada - referencia) <= TOLERANCIA
        for derivada, referencia in zip(gabarito, COLUNAS_DA_TABELA, strict=True)
    )
    if canonico:
        return

    achados.registrar_em_partes(
        "V-CTR-04",
        Severity.AVISA,
        titulo="A tabela de itens foi lida com um layout diferente do habitual.",
        causa="As colunas do contrato não batem com a geometria de referência do sistema.",
        acao="Não é preciso fazer nada — a extração foi conferida pela soma dos totais.",
        detalhe=(
            f"vão {gabarito[0]}–{gabarito[-1]} pt contra referência "
            f"{COLUNAS_DA_TABELA[0]}–{COLUNAS_DA_TABELA[-1]} pt"
        ),
    )


def v_ctr_06_cauda_sem_linha_anterior(contrato: Contract, achados: ValidationReport) -> None:
    """T-2182 / ESPEC 032 `R-CON-05` — cauda que não achou onde se anexar.

    A `R-CON-01` reconhece, no topo de uma página, o resto de uma linha de item
    que atravessou a quebra; a `R-CON-03` a anexa à última linha da página
    anterior. Não havendo linha anterior — a tabela começou nesta página —, não há
    onde encaixá-la, e o texto é ignorado.

    **Não ocorre em nenhum dos três documentos**, e é assim que tem de ser:
    guarda de anomalia, no precedente da `V-MED-04` da ESPEC 031. Se disparar, ou
    a geometria mudou de forma, ou o crivo passou a aceitar o que não devia — e
    nos dois casos alguém precisa olhar antes de o documento ir ao órgão.

    `AVISA` e não `BLOQUEIA`: o resto da tabela continua correto, e a decisão de
    emitir assim mesmo é de quem confere.
    """
    if contrato.diagnostico is None:
        return

    for pagina, cauda in contrato.diagnostico.caudas_orfas:
        achados.registrar_em_partes(
            "V-CTR-06",
            Severity.AVISA,
            titulo="Um trecho de descrição pode ter ficado de fora.",
            causa=(
                f"A página {pagina} começa com um texto que parece continuação da "
                "linha anterior, mas não havia onde encaixá-lo."
            ),
            acao="Confira a descrição do item — o trecho no detalhe técnico pode pertencer a ele.",
            detalhe=f"'{cauda[:60]}…' (ESPEC 032 R-CON-05)",
        )


def v_ctr_07_periodo_nao_numerico(contrato: Contract, achados: ValidationReport) -> None:
    """T-2615 / ESPEC 040 `R-MES-04` — período que não foi lido como número de meses.

    `meses` deixou de bloquear a extração (`R-MES-01`): célula como "2 meses e
    14 dias" — a cauda de um contrato que não fecha em mês cheio — produz um
    item com `meses=None` e `meses_bruto` guardando o texto original, em vez de
    `ExtractionError`.

    `AVISA` e não `BLOQUEIA`, porque `meses` não sustenta o checksum de
    `V-CTR-03` (soma `total_declarado`, não `preço × quantidade × meses`) nem é
    consultado em lugar nenhum do backend (ESPEC 040 §2.2) — bloquear o
    relatório inteiro por um campo nunca lido seria desproporcional. O texto
    bruto entra na mensagem para que quem confira não precise reabrir o PDF.
    """
    for item in contrato.itens:
        if item.meses is not None:
            continue

        achados.registrar_em_partes(
            "V-CTR-07",
            Severity.AVISA,
            titulo="O período de um item não foi lido como número de meses.",
            causa=(
                f"O item {item.codigo} (página {item.pagina}) tem o período escrito "
                f'como texto: "{item.meses_bruto}".'
            ),
            acao="Confira, no PDF do contrato, se o período dessa linha está correto no relatório.",
            codigo=item.codigo.valor,
        )


def v_ctr_08_ordem_alternativa_de_colunas(
    contrato: Contract, achados: ValidationReport
) -> None:
    """T-2683 / ESPEC 045 `R-COL-07` — a tabela foi lida com preço, quantidade
    e período em ordem diferente da habitual.

    A ordem dessas três colunas não é fixa por documento (`R-COL-01`): é
    declarada pelo cabeçalho de cada seção, e uma peça pode trazer mais de uma
    ordem — o `PA-CGM-250912-127 v4.0` declara a canônica em "5.2"/"5.3" e a
    invertida em "5.4 Data Center", na mesma geometria (ESPEC 045 §2.2).

    `AVISA` e não `BLOQUEIA`, no mesmo princípio de `v_ctr_04_geometria_nao_canonica`:
    há prova independente de que a leitura está certa — o checksum de
    `V-CTR-03`, que bloqueia se a soma não fechar. Ao contrário de `V-CTR-04`
    (ESPEC 017 `R-REL-13`, deliberadamente fora do `container.py` por disparar
    para quase todo documento), esta **é** registrada: medido em nove
    documentos do corpus, nenhum diverge da ordem canônica — é anomalia rara,
    e de alto risco semântico quando ocorre (`D-05`).
    """
    if contrato.diagnostico is None:
        return

    for pagina, ordem in contrato.diagnostico.ordem_de_colunas_alternativa:
        achados.registrar_em_partes(
            "V-CTR-08",
            Severity.AVISA,
            titulo="A tabela de itens foi lida com uma ordem de coluna diferente da habitual.",
            causa=(
                f"A partir da página {pagina}, a tabela declara preço, quantidade e "
                f"período nesta ordem: {ordem}."
            ),
            acao="Não é preciso fazer nada — a extração foi conferida pela soma dos totais.",
            detalhe=f"ordem lida: {ordem} (ESPEC 045 R-COL-07)",
        )
