"""T-1310 — O rótulo de um bloco da tabela de itens (ESPEC 019 `R-ADT-01`).

Uma proposta comercial e um aditivo têm a **mesma** tabela de sete colunas, e o
que os separa é isto: o aditivo a parte em blocos rotulados, cada um com o seu
`TOTAL:`.

O rótulo é o dado operativo desta espec. O relatório não usa quantitativo do
contrato desde a ESPEC 018 `D-05` — usa ordem, descrição e unidade, e as três
dependem só de **quais códigos existem**. Logo `Inclusão` e `Exclusão` importam,
e `Aumento` e `Redução` não (`R-ADT-03`, `R-ADT-06`).

**O rótulo não diz se a tabela é escopo inteiro ou delta.** O bloco único da
proposta do PGM é rotulado `Aumento` e vale o contrato inteiro, `24.551.037,72`.
Quem decide isso é o papel da peça, e o papel vem do campo em que ela foi
submetida (ESPEC 019 `D-03`) — nunca daqui.
"""

from __future__ import annotations

import unicodedata
from enum import StrEnum


class RotuloDeBloco(StrEnum):
    """As quatro movimentações que um bloco pode declarar.

    ``StrEnum`` no padrão de ``Classificacao``: serializa sozinho, e o valor é
    legível em mensagem de validação sem conversão na fronteira.

    Os nomes são gravados **sem acento** de propósito: são identificadores, e o
    texto do documento — ``Redução``, ``Inclusão`` — chega por ``de_texto``.
    """

    AUMENTO = "AUMENTO"
    REDUCAO = "REDUCAO"
    INCLUSAO = "INCLUSAO"
    EXCLUSAO = "EXCLUSAO"

    @property
    def altera_o_conjunto(self) -> bool:
        """``R-ADT-03`` — este bloco muda **quais códigos** o contrato tem?

        A pergunta que decide se o bloco de um aditivo é aplicado ou descartado.
        Vive aqui, e não em quem aplica, porque é uma afirmação sobre o rótulo:
        um segundo lugar decidindo o mesmo seria um lugar para discordar.
        """
        return self in (RotuloDeBloco.INCLUSAO, RotuloDeBloco.EXCLUSAO)

    @classmethod
    def de_texto(cls, texto: str) -> RotuloDeBloco | None:
        """O rótulo que este texto carrega, ou ``None`` se não carregar nenhum.

        Reconhece por **prefixo e sem acento**: ``Redução`` e ``Reducao`` são o
        mesmo rótulo, e a diferença é de quem digitou o documento. É a mitigação
        barata do único ponto da ESPEC 019 que não foi medido — nenhum aditivo do
        repositório traz bloco ``Exclusão`` (§2.10).

        ``None`` é resposta legítima e comum: o bloco único do piloto **não tem
        rótulo**, e vale inteiro como escopo da proposta (`R-ADT-02`).

        Rótulo desconhecido também devolve ``None``, e é de propósito: um bloco
        que não se sabe ler **não** é tratado como ``Aumento``. Num aditivo ele
        deixa de ter efeito, e ``V-ADT-02`` avisa que o arquivo não surtiu efeito
        — que é exatamente o sintoma de rótulo novo.
        """
        procurado = _sem_acento(texto)
        for prefixo, rotulo in _PREFIXOS.items():
            if prefixo in procurado:
                return rotulo
        return None


def _sem_acento(texto: str) -> str:
    """Minúsculas e sem diacrítico, para comparar texto de documento.

    ``NFKD`` separa a letra do acento; descartar os combinantes deixa ``reduçao``
    e ``reducao`` idênticos sem tabela de substituição a manter.
    """
    decomposto = unicodedata.normalize("NFKD", texto.casefold())
    return "".join(c for c in decomposto if not unicodedata.combining(c))


# Prefixos, e não palavras inteiras: cobre `Redução` e `Reduções`, `Inclusão` e
# `Inclusao`, sem enumerar flexões. A ordem não importa — os quatro prefixos são
# mutuamente exclusivos.
_PREFIXOS = {
    "aument": RotuloDeBloco.AUMENTO,
    "reduc": RotuloDeBloco.REDUCAO,
    "inclus": RotuloDeBloco.INCLUSAO,
    "exclus": RotuloDeBloco.EXCLUSAO,
}
