"""T-13 — Achado de validação.

As validações da ESPEC 001 §6 seguem o padrão de guardrails do TRIADE: cada uma
é uma unidade nomeada, com arquivo e teste próprios, e o resultado é apresentado
ao usuário antes do download.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Severity(StrEnum):
    BLOQUEIA = "BLOQUEIA"
    AVISA = "AVISA"
    # T-2093 / ESPEC 029 `R-IDT-10` — **o portão que pergunta.**
    #
    # Terceiro valor, e o primeiro que não é sobre gravidade: `BLOQUEIA` e
    # `AVISA` dizem *quão grave é*; este diz *de quem é a decisão*. O sistema
    # não sabe qual dos dois arquivos está errado — só sabe que não combinam —,
    # e trancar seria decidir com informação parcial o que quem confere decide
    # com informação inteira (`D-02`).
    #
    # Impede a emissão como `BLOQUEIA`, e sai dela por uma resposta: com
    # `identidade_confirmada`, a validação registra `AVISA` no lugar deste
    # (`R-IDT-11`).
    #
    # **Nenhuma das onze validações anteriores o registra**, e a `T-2094` é
    # quem guarda isso: acrescentar um valor ao `enum` é uma linha, e não
    # perceber que uma validação antiga passou a cair nele seria um bloqueio
    # permanente e falso.
    PERGUNTA = "PERGUNTA"


@dataclass(frozen=True)
class ValidationFinding:
    validacao: str  # identificador da ESPEC 001 — ex.: "V-CTR-03"
    severidade: Severity
    mensagem: str
    codigo: str | None = None

    # ── T-1928 / ESPEC 025 `R-DOC-05` — o achado em quatro partes ────────────
    #
    # `mensagem` **continua sendo o campo**, e não uma derivação: onze validações
    # a preenchem direto, o `.docx` a consome e onze asserções da suíte a leem.
    # Trocá-la por propriedade obrigaria a reescrever tudo isso para ganhar nada.
    #
    # Quem tem as quatro partes as recebe por `registrar_em_partes`, que compõe a
    # `mensagem` a partir delas — assim as duas visões nunca divergem.
    #: O que houve, no vocabulário de quem confere.
    titulo: str = ""
    #: Como o sistema concluiu isso. Existe para o leitor poder **discordar**.
    causa: str = ""
    #: O que fazer agora, em um passo.
    acao: str = ""
    #: Os números da extração. Vai recolhido, para o suporte.
    detalhe: str = ""


@dataclass
class ValidationReport:
    achados: list[ValidationFinding] = field(default_factory=list)

    def registrar(
        self,
        validacao: str,
        severidade: Severity,
        mensagem: str,
        codigo: str | None = None,
    ) -> None:
        self.achados.append(ValidationFinding(validacao, severidade, mensagem, codigo))

    def registrar_em_partes(
        self,
        validacao: str,
        severidade: Severity,
        *,
        titulo: str,
        causa: str,
        acao: str,
        detalhe: str = "",
        codigo: str | None = None,
    ) -> None:
        """ESPEC 025 `R-DOC-05` — o achado que a tela sabe empilhar.

        `mensagem` sai da concatenação das três primeiras partes, e **não** do
        `detalhe`: o texto técnico é o que a ESPEC 025 §1 tirou do meio da frase,
        e recolocá-lo aqui desfaria a entrega para quem consome só `mensagem`.
        """
        self.achados.append(
            ValidationFinding(
                validacao,
                severidade,
                " ".join(parte for parte in (titulo, causa, acao) if parte),
                codigo,
                titulo=titulo,
                causa=causa,
                acao=acao,
                detalhe=detalhe,
            )
        )

    @property
    def bloqueado(self) -> bool:
        """Havendo qualquer achado bloqueante, nenhum PDF é emitido.

        Gerar um relatório com número possivelmente errado é pior que não gerar:
        ele instrui faturamento.

        `PERGUNTA` entra aqui (ESPEC 029 `R-IDT-10`), e o significado deste
        campo **não muda**: continua sendo *não sai documento*. O que muda é a
        saída — `BLOQUEIA` exige outro arquivo, `PERGUNTA` aceita uma resposta.
        """
        return any(
            a.severidade in (Severity.BLOQUEIA, Severity.PERGUNTA) for a in self.achados
        )

    @property
    def bloqueantes(self) -> list[ValidationFinding]:
        return [a for a in self.achados if a.severidade is Severity.BLOQUEIA]

    @property
    def avisos(self) -> list[ValidationFinding]:
        return [a for a in self.achados if a.severidade is Severity.AVISA]

    @property
    def confirmaveis(self) -> list[ValidationFinding]:
        """ESPEC 029 `R-IDT-10` — os achados que uma resposta destrava.

        Lista própria, ao lado de `bloqueantes` e `avisos`, porque a tela faz
        com eles uma coisa que não faz com nenhum dos outros dois: oferece um
        botão que segue assim mesmo.
        """
        return [a for a in self.achados if a.severidade is Severity.PERGUNTA]
