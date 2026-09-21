"""T-2082 / T-2083 — ESPEC 029 `R-IDT-01`: de que contrato este documento é.

A pergunta que o Confere nunca fez. Cada arquivo submetido declara, em algum
canto, o instrumento a que responde — o PDF na prosa da primeira página, a
planilha na linha ``conforme contrato :`` — e até a ESPEC 029 ninguém comparava
os dois.

Vive no domínio, e não na infraestrutura: não conhece PDF nem planilha, e é o
que permite exercitar os degraus **sem abrir arquivo**. Mesmo lugar e mesmo
espírito de ``causa_provavel`` e ``causa_da_leitura_vazia``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ── Os dois padrões ───────────────────────────────────────────────────────────
#
# O número, o órgão e o ano, com tolerância a espaço em volta das barras — as
# três peças reais grafam `52/SMIT/2024` colado, e uma quarta não precisa.
#
# O sufixo é opcional e sai da resposta do negócio ao `I-03`: *"sim, pode ganhar
# sufixo"*. `52-A/SMIT/2024` é o mesmo contrato de `52/SMIT/2024`, aditivado.
_NUMERO = r"(\d{1,4})(?:\s*-\s*([A-Za-z0-9]{1,3}))?\s*/\s*([A-Za-zÀ-Úà-ú]{2,12})\s*/\s*(\d{4})"

# `de_texto` **exige a palavra `Contrato` antes**, e `de_referencia_da_aba` não.
#
# Não é simetria perdida: são duas fontes com garantias diferentes. A primeira
# página de uma proposta é prosa livre, onde `1040/GRC/2024` poderia ser
# qualquer coisa; a linha da aba **é** o campo do contrato de referência, e o que
# estiver ali já se declarou como tal.
#
# `Nº`, `N°`, `No`, `N.` ou nada — e em qualquer caixa: o piloto grafa `Nº`, e
# uma peça futura pode grafar `nº`. O que **não** é opcional é a palavra
# `Contrato`, pela razão do comentário acima.
_NO_PDF = re.compile(rf"[Cc]ontrato\s*(?:[Nn][º°o]?\.?)?\s*{_NUMERO}")
_NA_ABA = re.compile(_NUMERO)


@dataclass(frozen=True)
class IdentidadeContratual:
    """`R-IDT-01` — número, órgão e ano, comparáveis.

    **`numero` e `sufixo` ficam fora da comparação**, e cada um por sua razão:

    * `numero` é o que o documento escreveu — `015` numa fonte, `15` na outra,
      para o mesmo contrato do PGM. Quem compara é `base`, o valor. Ele fica
      guardado porque a mensagem cita o que a pessoa vai procurar no arquivo
      (`R-DOC-06`), e `015` é o que ela vai ler lá.
    * `sufixo` é a marca do aditivamento (`I-03`). Compará-lo faria todo contrato
      renumerado perguntar à toa — e é justamente o contrato aditivado que mais
      passa por aqui.

    Guardar as partes separadas, e não uma string normalizada, é o que torna
    isso possível: `"52/SMIT/2024"` como texto funcionaria em tudo o que foi
    medido e falharia no primeiro sufixo.
    """

    base: int
    orgao: str
    ano: str
    numero: str = field(default="", compare=False)
    sufixo: str = field(default="", compare=False)

    def __post_init__(self) -> None:
        if not self.numero:
            object.__setattr__(self, "numero", str(self.base))

    @classmethod
    def de_texto(cls, texto: str) -> IdentidadeContratual | None:
        """`R-IDT-02` — a identidade declarada na primeira página de uma peça.

        Vale a **primeira** ocorrência: as três peças reais repetem o mesmo
        número adiante, e a introdução é onde ele é afirmado.
        """
        return cls._de(_NO_PDF, texto)

    @classmethod
    def de_referencia_da_aba(cls, texto: str) -> IdentidadeContratual | None:
        """`R-IDT-03` — a identidade declarada pela aba `Levantamento`.

        Aceita a célula inteira (`*Valores conforme contrato : TC 52/SMIT/2024`)
        e o campo já extraído pelo leitor (`TC 52/SMIT/2024`): o prefixo `TC`,
        `CT` ou `Contrato` não é lido, é ignorado por não casar.

        **Vale a primeira identidade de contrato, e citações de peça não contam**
        (`I-02`): a planilha pode abranger um contrato *e um aditivo dele*, que é
        **um** instrumento. `PA-SMIT-260319-739` não tem barra entre número e
        órgão, e por isso não casa aqui — sozinha, uma peça não rende identidade.
        """
        return cls._de(_NA_ABA, texto)

    @classmethod
    def _de(cls, padrao: re.Pattern[str], texto: str) -> IdentidadeContratual | None:
        if not texto:
            return None
        achado = padrao.search(re.sub(r"\s+", " ", texto))
        if not achado:
            return None

        numero, sufixo, orgao, ano = achado.groups()
        return cls(
            base=int(numero),
            orgao=orgao.upper(),
            ano=ano,
            numero=numero,
            sufixo=(sufixo or "").upper(),
        )

    def __str__(self) -> str:
        """O que o documento escreveu, e não a forma normalizada.

        `015/PGM/2024`, e não `15/PGM/2024`: a mensagem manda a pessoa conferir
        um arquivo, e o que ela vai encontrar lá é o que estava escrito.
        """
        numero = f"{self.numero}-{self.sufixo}" if self.sufixo else self.numero
        return f"{numero}/{self.orgao}/{self.ano}"
