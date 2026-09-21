"""T-2089 a T-2091 — ESPEC 029: os arquivos submetidos são do mesmo contrato?

Três validações no padrão de guardrails do TRIADE — cada uma é uma unidade
nomeada pelo identificador da espec, com arquivo e teste próprios.

**Nenhuma delas bloqueia em definitivo** (`D-02`). O sistema não sabe qual dos
dois arquivos está errado: só sabe que não combinam. Quem decide é quem confere,
e a decisão dele chega por `identidade_confirmada`.

O que não se abre mão, e é o que separa *perguntar* de *só avisar*: sem resposta,
não sai documento. O aviso passivo é o que a ESPEC 029 §1 já mostrou não
funcionar — dezenove avisos não impediram nada.
"""

from __future__ import annotations

from domain.entities.contract import Contract
from domain.entities.measurement import Measurement
from domain.entities.validation_finding import Severity, ValidationReport
from domain.value_objects.identidade_contratual import IdentidadeContratual

# ── A severidade da divergência, num lugar só ────────────────────────────────
#
# T-2104 / PLANO 029 §1 — **subiu de `AVISA` para `PERGUNTA`**, e é a linha que
# fecha a entrega.
#
# Nasceu `AVISA` na `T-2090` e ficou assim enquanto a tela não sabia perguntar:
# naquele degrau a detecção já entregava a metade que importa — a divergência
# aparecendo, nomeada, no lugar dos dezenove sintomas — sem travar ninguém.
# Subir antes de o ciclo do portão existir publicaria a tranca que o dono do
# negócio recusou em `I-04`: emissão impedida por uma pergunta sem botão de
# resposta.
#
# O que a troca faz: `bloqueado` passa a incluir estes achados, o documento não
# sai, e a saída é `identidade_confirmada` — pela caixa do formulário, ou pelo
# campo do `POST /reports` para quem chama a API direto.
#
# Constante e **não** bandeira de configuração (PLANO 029 §7): o projeto não tem
# nenhuma, e a pergunta *"o portão está ligado?"* precisa ter resposta no código.
SEVERIDADE_DA_DIVERGENCIA = Severity.PERGUNTA


def _severidade(identidade_confirmada: bool) -> Severity:
    """`R-IDT-11` — confirmado, o achado **desce a aviso e permanece**.

    Um portão que some ao ser atravessado não deixa rastro de que existiu: quem
    conferir o resultado depois precisa ver que o par divergente foi confirmado
    no envio.
    """
    return Severity.AVISA if identidade_confirmada else SEVERIDADE_DA_DIVERGENCIA


def _do_levantamento(medicao: Measurement) -> IdentidadeContratual | None:
    """A identidade que a aba declara.

    Sai de `contrato_referencia`, que o leitor preenche desde a ESPEC 001 e que
    até aqui servia só ao cabeçalho do relatório. **O `Measurement` não muda por
    causa desta espec**: o dado já estava em memória, faltava compará-lo.
    """
    return IdentidadeContratual.de_referencia_da_aba(medicao.contrato_referencia)


def _nomear(peca: Contract, nome_do_arquivo: str = "") -> str:
    """`R-DOC-06` — como a peça aparece na tela.

    A identificação interna vem primeiro: `PA-SMIT-260319-739` é o número que a
    proposta carrega e o que quem confere reconhece.
    """
    return peca.proposta or nome_do_arquivo or "(sem identificação)"


# ── `V-IDT-01` — o levantamento é de outro órgão ─────────────────────────────


def v_idt_01_levantamento_de_outro_orgao(
    contrato: Contract,
    medicao: Measurement,
    achados: ValidationReport,
    nome_do_levantamento: str = "",
    identidade_confirmada: bool = False,
) -> None:
    """ESPEC 029 `V-IDT-01` — contrato de um órgão, levantamento de outro.

    O caso que originou a espec: `contrato.pdf` (SMIT) com `levantamento_pgm.xlsx`
    (PGM) produzia hoje um `.docx` com a capa de um órgão, o cabeçalho de outro e
    o rodapé do primeiro — e **dezenove** cartões `V-CTR-05` que são fragmentos
    de uma frase que ninguém escreveu.

    `R-IDT-07` — o órgão é o eixo forte: órgãos diferentes não têm leitura
    legítima. É por isso que este é o achado que o portão pergunta, e `V-IDT-02`
    o que ele apenas pondera.

    **Sem identidade dos dois lados, silêncio** (`R-IDT-06`). Ausência de sinal é
    ausência de evidência, não evidência do contrário — a mesma leitura
    conservadora do `parece_proposta` (`R-DOC-02`).
    """
    do_contrato = contrato.identidade
    da_aba = _do_levantamento(medicao)
    if do_contrato is None or da_aba is None or do_contrato.orgao == da_aba.orgao:
        return

    onde = f" `{nome_do_levantamento}`" if nome_do_levantamento else ""

    if identidade_confirmada:
        achados.registrar_em_partes(
            "V-IDT-01",
            Severity.AVISA,
            titulo="Par confirmado no envio: o levantamento declara outro contrato.",
            causa=(
                f"O contrato é o {do_contrato} e o levantamento declara "
                f"{da_aba}. O documento foi emitido com esta divergência."
            ),
            acao="",
            detalhe=_detalhe("V-IDT-01", contrato, medicao),
        )
        return

    achados.registrar_em_partes(
        "V-IDT-01",
        _severidade(identidade_confirmada),
        titulo="Estes dois arquivos parecem ser de contratos diferentes.",
        causa=(
            f"O contrato enviado é o {do_contrato} (proposta "
            f"{_nomear(contrato)}), e o levantamento{onde} declara {da_aba}. "
            "Se seguir assim mesmo, o relatório sairá com o órgão do contrato na "
            "capa e o número do levantamento no cabeçalho."
        ),
        # A ação nomeia **as duas** saídas porque o sistema não sabe qual dos
        # dois arquivos está errado — só sabe que não combinam (`D-02`).
        acao=(
            f"Envie o levantamento do contrato {do_contrato}, ou o contrato "
            f"correspondente ao levantamento de {da_aba.orgao} — ou gere assim "
            "mesmo, se a divergência for conhecida."
        ),
        detalhe=_detalhe("V-IDT-01", contrato, medicao),
    )


# ── `V-IDT-02` — mesmo órgão, contrato diferente ─────────────────────────────


def v_idt_02_numero_de_contrato_divergente(
    contrato: Contract,
    medicao: Measurement,
    achados: ValidationReport,
    identidade_confirmada: bool = False,
) -> None:
    """ESPEC 029 `V-IDT-02` — mesmo órgão, número ou ano divergentes.

    Eixo fraco (`R-IDT-07`): aqui existe leitura legítima rara — contrato
    sucessor, competência de virada.

    **Diferença só de sufixo não chega aqui** (`R-IDT-04` / `I-03`): o negócio
    respondeu que o número pode ganhar sufixo ao ser aditivado, e `52-A/SMIT/2024`
    é o mesmo contrato de `52/SMIT/2024`. Quem garante isso é a igualdade do
    objeto de valor, que compara `(base, órgão, ano)` — não este `if`.
    """
    do_contrato = contrato.identidade
    da_aba = _do_levantamento(medicao)
    if do_contrato is None or da_aba is None:
        return
    # Órgão diferente é da `V-IDT-01`, e as duas nunca falam do mesmo par:
    # duas mensagens para o mesmo fato treinam o olho a pular o bloco
    # (`R-REL-13`).
    if do_contrato.orgao != da_aba.orgao or do_contrato == da_aba:
        return

    achados.registrar_em_partes(
        "V-IDT-02",
        _severidade(identidade_confirmada),
        titulo=(
            "O número do contrato não confere entre os dois arquivos."
            if not identidade_confirmada
            else "Par confirmado no envio: o número do contrato não confere."
        ),
        causa=(
            f"O contrato enviado é o {do_contrato} e o levantamento declara "
            f"{da_aba}. Os dois são de {do_contrato.orgao}."
        ),
        acao=(
            ""
            if identidade_confirmada
            else (
                "Confirme qual dos dois instrumentos é a competência que está "
                "sendo faturada. O documento sai com o número do levantamento no "
                "cabeçalho e a proposta no rodapé."
            )
        ),
        detalhe=_detalhe("V-IDT-02", contrato, medicao),
    )


# ── `V-IDT-03` — a peça é de outro contrato ──────────────────────────────────


def v_idt_03_peca_de_outro_contrato(
    proposta: Contract,
    peca: Contract,
    papel: str,
    achados: ValidationReport,
    nome_do_arquivo: str = "",
    identidade_confirmada: bool = False,
) -> None:
    """ESPEC 029 `V-IDT-03` — aditivo que responde a outro instrumento.

    `V-ADT-03` já barra as duas formas de submeter peças erradas — a repetida e a
    proposta no campo de aditivo. Ela pergunta *que forma tem esta peça*; esta
    pergunta *de que contrato ela é*, e o par `contrato.pdf` + `aditivo_pgm.pdf`
    passa pela primeira sem arranhão: hoje ele rende **um** `V-ADT-04` e um
    documento de 58 linhas.

    Dois eixos (`R-IDT-05`): o contrato declarado e o processo administrativo.
    O segundo pega o que o primeiro não pegaria — dois instrumentos do mesmo
    órgão e ano com numeração parecida.

    **Contra a proposta, nunca peça contra peça** (`D-08`): com quatro peças, a
    comparação cruzada produziria seis achados para um arquivo errado.

    Chamada **antes** de `Contract.aplicar` (`R-IDT-08`): depois dela os itens já
    estão somados e a peça de origem não é mais distinguível.
    """
    divergem = _eixos_divergentes(proposta, peca)
    if not divergem:
        return

    identificacao = _nomear(peca, nome_do_arquivo)
    de_quem = f"do contrato {peca.identidade}" if peca.identidade else "de outro contrato"

    if identidade_confirmada:
        achados.registrar_em_partes(
            "V-IDT-03",
            Severity.AVISA,
            titulo=f"Par confirmado no envio: o {papel} é de outro contrato.",
            causa=(
                f"A proposta é do contrato {proposta.identidade}; o arquivo "
                f"{identificacao} é {de_quem}. Os itens dele entraram no escopo."
            ),
            acao="",
            detalhe=f"V-IDT-03 · divergem: {' e '.join(divergem)}",
        )
        return

    achados.registrar_em_partes(
        "V-IDT-03",
        _severidade(identidade_confirmada),
        titulo=f"O {papel} parece ser de outro contrato.",
        causa=(
            f"A proposta é do contrato {proposta.identidade}, processo "
            f"{proposta.processo or '(não declarado)'}; o arquivo {identificacao} "
            f"é {de_quem}, processo {peca.processo or '(não declarado)'}. "
            f"Se seguir assim mesmo, os itens deste {papel} entrarão no escopo do "
            f"contrato {proposta.identidade} — o contratado consolidado muda, e "
            "com ele a conferência."
        ),
        acao=(
            f"Remova este arquivo do campo {papel}, ou envie a proposta do "
            f"contrato {peca.identidade} — ou gere assim mesmo, se a divergência "
            "for conhecida."
        ),
        detalhe=f"V-IDT-03 · divergem: {' e '.join(divergem)}",
    )


def _eixos_divergentes(proposta: Contract, peca: Contract) -> list[str]:
    """Quais dos dois eixos discordam — e `R-IDT-06` em cada um deles.

    Eixo que uma das peças não declara **não diverge**: ausência de sinal é
    ausência de evidência. O `aditivo_pgm.pdf` declara os dois; o dia em que uma
    peça não declarar nenhum, esta função devolve lista vazia e a validação cala.
    """
    divergem = []
    if (
        proposta.identidade is not None
        and peca.identidade is not None
        and proposta.identidade != peca.identidade
    ):
        divergem.append("contrato")
    if proposta.processo and peca.processo and proposta.processo != peca.processo:
        divergem.append("processo")
    return divergem


def _detalhe(validacao: str, contrato: Contract, medicao: Measurement) -> str:
    """Os números da derivação, recolhidos para o suporte (ESPEC 025 `R-DOC-05`).

    Cada lado com **a origem da afirmação**, que é o que permite a quem dá
    suporte conferir sem abrir os dois arquivos.
    """
    return (
        f"{validacao} · contrato: {contrato.identidade} (página 1) · "
        f"planilha: {medicao.contrato_referencia!r} (cabeçalho da aba Levantamento)"
    )
