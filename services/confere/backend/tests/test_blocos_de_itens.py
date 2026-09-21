"""T-1310 a T-1312 — O bloco da tabela de itens e o seu rótulo (ESPEC 019, fase B).

Testes do vocabulário e do agregado, sem abrir PDF. A leitura do rótulo no
documento real está em `test_extractor_aditivo`.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from domain.entities.contract import BlocoDeItens, Contract
from domain.entities.contract_item import ContractItem
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.service_code import ServiceCode


def _item(codigo: str, quantidade: str = "1") -> ContractItem:
    return ContractItem(
        codigo=ServiceCode(codigo),
        descricao="X",
        unidade="UN",
        quantidade=Decimal(quantidade),
        preco_unitario=Decimal("1"),
        meses=12,
        total_declarado=Decimal(quantidade),
        pagina=1,
    )


# ── T-1310 · O rótulo ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("Aumento", RotuloDeBloco.AUMENTO),
        ("Redução", RotuloDeBloco.REDUCAO),
        ("Inclusão", RotuloDeBloco.INCLUSAO),
        ("Exclusão", RotuloDeBloco.EXCLUSAO),
        # Como o documento pode grafar, e como a grade pode entregar.
        ("Reducao", RotuloDeBloco.REDUCAO),
        ("EXCLUSAO", RotuloDeBloco.EXCLUSAO),
        ("exclusão de recursos no Anexo “DATA CENTER”", RotuloDeBloco.EXCLUSAO),
        ("   Inclusão   ", RotuloDeBloco.INCLUSAO),
    ],
)
def test_t1310_o_rotulo_e_lido_sem_acento_e_sem_caixa(
    texto: str, esperado: RotuloDeBloco
) -> None:
    """`R-ADT-14` — a grafia é de quem digitou o documento, não regra de negócio.

    A tolerância a acento é a mitigação barata do único ponto da espec que não foi
    medido: nenhum **aditivo** do repositório traz bloco `Exclusão` (§2.10). Se
    vier `Exclusao`, é o mesmo bloco.
    """
    assert RotuloDeBloco.de_texto(texto) == esperado


def test_t1310_bloco_sem_rotulo_e_resposta_legitima() -> None:
    """O bloco único do piloto não tem rótulo, e vale inteiro (`R-ADT-02`)."""
    assert RotuloDeBloco.de_texto("") is None
    assert RotuloDeBloco.de_texto("   ") is None


def test_t1310_rotulo_desconhecido_nao_vira_aumento() -> None:
    """`[risco]` — a decisão que impede um bloco novo de ser descartado calado.

    `None` e `AUMENTO` levam ao mesmo lugar numa proposta, e a lugares **opostos**
    num aditivo: `R-ADT-02` toma todos os blocos da proposta, e `R-ADT-03` descarta
    o `Aumento` do aditivo. Mapear desconhecido para `AUMENTO` faria um bloco de
    rótulo novo desaparecer sem aviso; devolvendo `None`, ele não altera o conjunto
    e `V-ADT-02` avisa que o aditivo não teve efeito.
    """
    assert RotuloDeBloco.de_texto("Prorrogação") is None
    assert RotuloDeBloco.de_texto("Repactuação de preços") is None


@pytest.mark.parametrize(
    ("rotulo", "altera"),
    [
        (RotuloDeBloco.INCLUSAO, True),
        (RotuloDeBloco.EXCLUSAO, True),
        (RotuloDeBloco.AUMENTO, False),
        (RotuloDeBloco.REDUCAO, False),
    ],
)
def test_t1310_so_inclusao_e_exclusao_alteram_o_conjunto(
    rotulo: RotuloDeBloco, altera: bool
) -> None:
    """`R-ADT-03` — a distinção que define a ESPEC 019.

    O relatório usa o contrato para ordem, descrição e unidade, e as três dependem
    só de **quais códigos existem** (ESPEC 018 `D-05`). É isso que o predicado
    mede, e é por isso que `Aumento` e `Redução` devolvem `False`.

    T-1624 / ESPEC 022 — **o predicado está certo e o docstring dizia demais.**
    Ele concluía *"Quantidade não entra"*, citando `R-ADT-06`. A quantidade passou
    a entrar (`R-QTD-01`): os deltas são somados ao consolidado e alimentam a
    comparação da `V-REC-01`. O que continua não entrando é no **conjunto de
    códigos** — que é o único escopo deste predicado, e a razão de `D-06` da ESPEC
    022 tê-lo deixado intacto.
    """
    assert rotulo.altera_o_conjunto is altera


# ── T-1311 · O bloco ──────────────────────────────────────────────────────────


def test_t1311_o_bloco_expoe_os_seus_codigos() -> None:
    bloco = BlocoDeItens(
        rotulo=RotuloDeBloco.INCLUSAO,
        itens=(_item("14.071.00006.00"), _item("14.071.00007.00")),
    )
    assert bloco.codigos == {"14.071.00006.00", "14.071.00007.00"}
    assert bloco.altera_o_conjunto


def test_t1311_bloco_sem_rotulo_nao_altera_o_conjunto() -> None:
    """Num aditivo, bloco sem rótulo não tem efeito — não é um `Aumento` implícito."""
    bloco = BlocoDeItens(rotulo=None, itens=(_item("10.050.00001.00"),))
    assert not bloco.altera_o_conjunto


# ── T-1312 · A coerência entre `blocos` e `itens` ─────────────────────────────


def test_t1312_blocos_e_itens_precisam_concordar() -> None:
    """A invariante que paga a redundância dos dois campos.

    `itens` continua sendo o campo que trinta pontos do código leem, e `blocos` é
    a mesma tabela vista de outro jeito. Duas visões da mesma coisa sem guarda é
    uma deriva à espera de acontecer.
    """
    itens = [_item("10.050.00001.00"), _item("11.051.00012.00")]
    bloco = BlocoDeItens(rotulo=RotuloDeBloco.AUMENTO, itens=tuple(itens))

    Contract(proposta="X", itens=itens, blocos=(bloco,))  # coerente: não levanta

    with pytest.raises(ValueError, match="blocos e itens divergem"):
        Contract(proposta="X", itens=itens[:1], blocos=(bloco,))


def test_t1312_contrato_sem_blocos_continua_valido() -> None:
    """ESPEC 019 §9.1 — as construções que a suíte já fazia não podem quebrar.

    `test_extractor_contract` monta `Contract` com `itens` e sem `blocos`, e é um
    arquivo que esta espec se proibiu de tocar.
    """
    contrato = Contract(proposta="X", itens=[_item("10.050.00001.00")])
    assert contrato.blocos == ()
    assert len(contrato.itens) == 1


def test_t1312_os_codigos_por_rotulo() -> None:
    """O insumo de `R-ADT-04`, `R-ADT-05` e `D-08`."""
    aumento = BlocoDeItens(rotulo=RotuloDeBloco.AUMENTO, itens=(_item("14.024.00006.00"),))
    inclusao = BlocoDeItens(rotulo=RotuloDeBloco.INCLUSAO, itens=(_item("14.071.00006.00"),))
    contrato = Contract(
        proposta="X",
        itens=[*aumento.itens, *inclusao.itens],
        blocos=(aumento, inclusao),
    )

    assert contrato.codigos_de(RotuloDeBloco.AUMENTO) == {"14.024.00006.00"}
    assert contrato.codigos_de(RotuloDeBloco.INCLUSAO) == {"14.071.00006.00"}
    assert contrato.codigos_de(RotuloDeBloco.EXCLUSAO) == set()
