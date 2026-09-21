"""T-1225 — Validação de reconciliação (ESPEC 001 §6, revista pela ESPEC 018).

Apenas avisa: o relatório sai, com a ressalva registrada. É o mecanismo que
torna visível o que uma conferência manual deixaria passar.
"""

from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal

from domain.entities.contract import Contract
from domain.entities.measurement import Measurement
from domain.entities.report import DivergenciaDeFonte
from domain.entities.validation_finding import ValidationReport


def v_rec_01_divergencia_de_quantidade_contratada(
    contrato: Contract,
    medicao: Measurement,
    achados: ValidationReport,
    deltas: Mapping[str, Decimal] | None = None,
) -> list[DivergenciaDeFonte]:
    """Quantidade contratada divergente entre o contrato e a aba `Levantamento`.

    **O relatório usa a da aba** (ESPEC 018 `R-REL-04` / `D-05`). A `R-CTR-01`,
    que mandava usar a do contrato, fica revogada: ela foi calibrada no piloto,
    onde a planilha é que estava defasada, e no PGM a assimetria é a inversa —
    o PDF é uma proposta de aditivo de 11/11/2025 que declara depender de outras
    quatro, e a aba é de 23/07/2026.

    Esta validação existe para que a diferença **apareça** em vez de ser
    silenciosamente resolvida.

    Avalia **todo código do contrato**, inclusive os que `R-REL-06` mantém fora
    do documento: achado é para quem opera, documento é para quem recebe.

    **O lado do contrato é o consolidado — proposta mais aditivos** (T-1614 /
    ESPEC 022 `R-QTD-06`). Antes disso ele era a proposta sozinha, sem os blocos
    `Aumento` e `Redução`, e a validação recebia um conjunto `explicados` com os
    códigos que esses blocos tocavam, para calar sobre eles. O silêncio era
    correto no efeito e cego na consequência: **naqueles códigos nada era
    conferido**, e uma planilha errada ali passava sem que ninguém visse.

    Medido no PGM (ESPEC 022 §2.4): com a aba declarando 1.400 onde o contratado
    consolidado é 1.300, a versão com supressão acusava **zero**. A soma dos
    deltas devolve a acusação — e mantém o silêncio no caso em que as fontes de
    fato concordam, que é o caso real dos cinco códigos.

    O silêncio passou a ser **aritmético**: some porque os números batem, e volta
    no instante em que deixam de bater. Sem aditivo submetido, os cinco avisos do
    PGM reaparecem, significando o que sempre significaram — *falta uma peça ou
    uma fonte está errada*.

    **Devolve as divergências** (T-1711 / ESPEC 023 `I-29`). A alternativa era
    mover a acumulação para o caso de uso, como a `R-PER-08` fez com a
    `V-REC-02`; lá a derivação já acontecia no caso de uso — era o mesmo `if`.
    Aqui a comparação **é** a validação, e movê-la a dissolveria como unidade
    nomeada com arquivo e teste próprios, que é o padrão de guardrails do TRIADE.

    **`deltas` não decide nada.** É `Mapping` de código para o quantitativo que
    os aditivos trouxeram, e serve só para *descrever* a divergência encontrada —
    `R-FON-04`, a decomposição que prova ao leitor que a soma foi feita. A
    comparação sai idêntica com ele e sem ele, e há teste que o afirma.

    Isto o distingue do antigo `explicados`, que tinha forma parecida e papel
    oposto: aquele **suprimia** comparações; este só enriquece o relato.

    **Não registra achado** (T-1725 / ESPEC 023 `R-FON-09`). Eram cinco frases
    quase idênticas, com os números presos dentro de orações e a mesma sentença
    final repetida ao fim de cada uma — a patologia que a `R-REL-13` eliminou da
    `V-CTR-04`. A informação não foi descartada: foi **promovida** de uma frase
    para um registro com nove campos, incluindo a diferença que endereça o
    aditivo faltante e a severidade que separa os dois diagnósticos.

    Mesmo precedente da `R-PER-08`, que fez isto com a `V-REC-02`. `achados`
    continua no parâmetro porque a assinatura das validações é uniforme e porque
    a próxima regra desta família pode voltar a registrar — mas hoje ela não
    escreve nada ali, e é deliberado.
    """
    aplicados = deltas or {}
    divergencias: list[DivergenciaDeFonte] = []

    for codigo in sorted(contrato.codigos):
        do_contrato = contrato.quantidade_para(codigo)
        item = medicao.item_para(codigo)
        if do_contrato is None or item is None:
            continue

        da_aba = item.contratada
        if da_aba is None or da_aba == do_contrato:
            continue

        itens = contrato.itens_de(codigo)
        divergencias.append(
            DivergenciaDeFonte(
                codigo=codigo,
                descricao=contrato.descricao_para(codigo) or item.descricao,
                unidade=itens[0].unidade if itens else "",
                no_contrato=do_contrato,
                na_planilha=da_aba,
                no_aditivo=aplicados.get(codigo),
            )
        )

    # `R-FON-06` — magnitude relativa decrescente. A ordem do contrato serve a
    # quem percorre o documento; esta serve a quem tria, que é o que se faz aqui.
    return sorted(divergencias, key=lambda d: d.magnitude, reverse=True)
