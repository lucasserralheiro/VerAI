"""T-1320 a T-1340 — A proposta mais os seus aditivos (ESPEC 019, fases C a F).

O que esta espec entrega, num arquivo: `Contract.aplicar`, as quatro validações
novas, o silêncio fundamentado da `V-REC-01` e o âncora do par completo do PGM.

A fixture sintética de `Exclusão` existe porque nenhum **aditivo** do repositório
traz esse bloco (ESPEC 019 §2.10, `I-01`). O espelho real está no `ANEXO II` da
proposta do PGM, e é conferido em `test_t1334`.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import docx
import pytest

from domain.entities.contract import BlocoDeItens, Contract
from domain.entities.contract_item import ContractItem
from domain.entities.report import Report
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.service_code import ServiceCode
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.report.docx_renderer import DocxRenderer
from infrastructure.validations.contract_validations import (
    v_adt_01_peca_sem_itens,
    v_adt_02_aditivo_sem_efeito,
    v_adt_03_peca_repetida_ou_trocada,
    v_adt_04_movimento_de_codigo_ausente,
)

# Os cinco códigos que os blocos `Aumento` e `Redução` do aditivo do PGM tocam —
# e que a `V-REC-01` acusava, um a um, antes desta espec (§2.9).
EXPLICADOS_PELO_ADITIVO = {
    "10.050.00001.00",
    "12.030.00001.00",
    "14.024.00006.00",
    "14.031.00020.00",
    "14.048.00027.00",
}

# Os dois do bloco `Inclusão` — o *grupo C* da ESPEC 018 §2.3.
INCLUIDOS = ("14.071.00006.00", "14.071.00007.00")


def _item(codigo: str) -> ContractItem:
    return ContractItem(
        codigo=ServiceCode(codigo),
        descricao=f"SERVIÇO {codigo}",
        unidade="UN",
        quantidade=Decimal("1"),
        preco_unitario=Decimal("1"),
        meses=12,
        total_declarado=Decimal("1"),
        pagina=1,
    )


def _peca(proposta: str, *blocos: BlocoDeItens) -> Contract:
    itens = [item for bloco in blocos for item in bloco.itens]
    return Contract(proposta=proposta, itens=itens, blocos=blocos)


def _bloco(rotulo: RotuloDeBloco | None, *codigos: str) -> BlocoDeItens:
    return BlocoDeItens(rotulo=rotulo, itens=tuple(_item(c) for c in codigos))


# ── T-1320 · `Contract.aplicar` ───────────────────────────────────────────────


def test_t1320_inclusao_entra_ao_fim_da_ordem() -> None:
    """`R-ADT-04` — o código novo ganha posição **depois** dos da proposta.

    A posição é o que o contrato fornece ao relatório (`R-REL-03`), e por isso a
    ordem aqui não é detalhe: é o único efeito visível de uma inclusão.
    """
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00", "12.030.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"))

    consolidado = proposta.aplicar([aditivo])

    assert [i.codigo.valor for i in consolidado.itens] == [
        "10.050.00001.00",
        "12.030.00001.00",
        "14.071.00006.00",
    ]
    assert consolidado.posicao_de("14.071.00006.00") == 2


def test_t1320_exclusao_remove_todas_as_linhas_do_codigo() -> None:
    """`R-ADT-05` — e **todas**, não a primeira.

    A proposta desdobra o mesmo código em várias linhas — `10.050.00001.00` sai
    em duas no PGM e em três no piloto. Remover só a primeira deixaria o código
    no contrato, com posição, e a exclusão não teria acontecido.
    """
    proposta = _peca(
        "PA-BASE",
        _bloco(None, "10.050.00001.00", "10.050.00001.00", "12.030.00001.00"),
    )
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.EXCLUSAO, "10.050.00001.00"))

    consolidado = proposta.aplicar([aditivo])

    assert [i.codigo.valor for i in consolidado.itens] == ["12.030.00001.00"]
    assert consolidado.posicao_de("10.050.00001.00") is None


@pytest.mark.parametrize("rotulo", [RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO])
def test_t1320_aumento_e_reducao_nao_criam_codigo(rotulo: RotuloDeBloco) -> None:
    """T-1607 / ESPEC 022 `R-QTD-03` — **a metade que sobreviveu à revogação.**

    Até a ESPEC 022 este teste se chamava `..._nao_mudam_nada` e afirmava duas
    coisas: que o conjunto de códigos não se movia e que a lista de itens
    tampouco. A segunda caiu — `Aumento` e `Redução` passam a ser somados
    (`R-QTD-01`), e a asserção inversa vive em
    `test_quantitativo_consolidado.py::test_t1604_o_delta_entra_como_item_do_mesmo_codigo`.

    **Esta metade não caiu, e é a que protege o documento.** O delta só é
    aplicado a código que o consolidado já contém: um `Aumento` de código ausente
    criaria um item do nada, e aquele código ganharia posição no contrato —
    saindo do bloco final para o corpo ordenado do `.docx`. É o único caminho
    pelo qual a ESPEC 022 conseguiria mexer no entregável, e `D-03` é a decisão
    de fechá-lo.

    O nome antigo se anunciava como *"o coração da espec"* de uma regra que não
    vale mais; mantê-lo deixaria um marcador falso na suíte.
    """
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(rotulo, "10.050.00001.00", "99.999.00001.00"))

    consolidado = proposta.aplicar([aditivo])

    assert "99.999.00001.00" not in consolidado.codigos
    assert consolidado.codigos == {"10.050.00001.00"}
    assert consolidado.posicao_de("99.999.00001.00") is None


def test_t1320_os_aditivos_sao_aplicados_em_sequencia() -> None:
    """`R-ADT-07` — a ordem de submissão decide, e é por isso que ela é do usuário.

    Incluir e depois excluir deixa o código fora; excluir e depois incluir o
    deixa dentro. Nada no documento permite ordenar as peças sozinho (`D-11`).
    """
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    inclui = _peca("PA-1", _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"))
    exclui = _peca("PA-2", _bloco(RotuloDeBloco.EXCLUSAO, "14.071.00006.00"))

    assert "14.071.00006.00" not in proposta.aplicar([inclui, exclui]).codigos
    assert "14.071.00006.00" in proposta.aplicar([exclui, inclui]).codigos


def test_t1320_o_consolidado_nao_tem_total_declarado() -> None:
    """`R-ADT-09` / `D-07` — e é deliberado, não esquecimento.

    O consolidado mistura um escopo com deltas: a soma dos totais das suas linhas
    não corresponde a número de documento nenhum. Conferir o checksum ali daria
    bloqueio permanente e falso — por isso o container o roda **por peça**.
    """
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"))

    consolidado = proposta.aplicar([aditivo])

    assert consolidado.total_declarado is None
    assert consolidado.blocos == ()


@pytest.mark.parametrize(
    ("propostas", "esperado"),
    [
        (("PA-A",), "PA-A"),
        (("PA-A", "PA-B"), "PA-A e PA-B"),
        (("PA-A", "PA-B", "PA-C"), "PA-A, PA-B e PA-C"),
    ],
)
def test_t1321_a_identificacao_nomeia_todas_as_pecas(
    propostas: tuple[str, ...], esperado: str
) -> None:
    """`R-ADT-11` / `D-09` — nomear só a primeira afirmaria origem incompleta."""
    contrato = Contract(proposta=propostas[0], propostas=propostas)
    assert contrato.identificacao == esperado


# ── T-1330 · As validações novas ──────────────────────────────────────────────


def test_t1330_v_adt_01_bloqueia_peca_sem_item() -> None:
    """`V-ADT-01` — o defeito que estava no ar, agora com dono.

    Indispensável desde que `D-07` tirou o checksum do consolidado: sem ela, um
    aditivo ilegível soma zero e o relatório sai como se ele não existisse.
    """
    achados = ValidationReport()
    v_adt_01_peca_sem_itens(Contract(proposta="PA-VAZIO"), "aditivo", achados)

    assert achados.bloqueado
    assert "PA-VAZIO" in achados.bloqueantes[0].mensagem


def test_t1331_v_adt_02_avisa_aditivo_sem_efeito() -> None:
    """`V-ADT-02` — aditivo só de quantitativo não move o documento.

    É também a rede do único ponto não medido da espec: um bloco `Exclusão`
    grafado de forma que `RotuloDeBloco` não reconheça cai aqui, em vez de sumir.

    T-1623 / ESPEC 022 — **a âncora mudou de metade da frase.** Era
    `"não altera o conjunto"`, que a T-1622 reescreveu. A âncora nova é a parte
    que fala do **documento**, e não a que fala da conferência: a primeira é
    consequência de `R-REL-04` e só muda se o entregável mudar; a segunda é
    redação, e redação se ajusta.
    """
    achados = ValidationReport()
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.AUMENTO, "10.050.00001.00"))
    v_adt_02_aditivo_sem_efeito(aditivo, achados)

    assert not achados.bloqueado
    assert achados.avisos[0].validacao == "V-ADT-02"
    assert "documento sai igual" in achados.avisos[0].mensagem


def test_t1331_v_adt_02_nao_avisa_com_inclusao() -> None:
    achados = ValidationReport()
    aditivo = _peca(
        "PA-ADT",
        _bloco(RotuloDeBloco.AUMENTO, "10.050.00001.00"),
        _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"),
    )
    v_adt_02_aditivo_sem_efeito(aditivo, achados)

    assert achados.avisos == []


def test_t1332_v_adt_03_bloqueia_peca_repetida() -> None:
    """`V-ADT-03`, primeira metade — a duplicata que o checksum não pegaria.

    Submeter o mesmo aditivo duas vezes duplicaria as suas inclusões, e nenhuma
    outra validação notaria: cada peça, por si, está íntegra.
    """
    achados = ValidationReport()
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"))

    v_adt_03_peca_repetida_ou_trocada(proposta, [aditivo, aditivo], achados)

    assert achados.bloqueado
    assert "submetida 2 vezes" in achados.bloqueantes[0].mensagem


def test_t1332_v_adt_03_nao_bloqueia_mais_bloco_unico_sem_rotulo() -> None:
    """`V-ADT-03`, segunda forma — removida pela ESPEC 046.

    Até a ESPEC 046, um aditivo com bloco único e sem rótulo — a forma do
    piloto — bloqueava: `Contract.aplicar()` o descartaria por completo, e o
    relatório sairia com o escopo faltando, sem uma palavra. A ESPEC 046
    removeu esse bloqueio por pedido explícito, sabendo o risco: agora esse
    aditivo é tratado exatamente como uma proposta já era — sem checagem
    nenhuma —, e `Contract.aplicar()` continua descartando o bloco sem rótulo
    do mesmo jeito que sempre descartou. O que muda é só não haver mais aviso
    disso.
    """
    achados = ValidationReport()
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    outra = _peca("PA-OUTRA", _bloco(None, "12.030.00001.00"))

    v_adt_03_peca_repetida_ou_trocada(proposta, [outra], achados)

    assert achados.achados == []


def test_t1332_v_adt_03_aceita_o_par_legitimo() -> None:
    achados = ValidationReport()
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.INCLUSAO, "14.071.00006.00"))

    v_adt_03_peca_repetida_ou_trocada(proposta, [aditivo], achados)

    assert not achados.bloqueado


def test_t1333_v_adt_04_avisa_aumento_de_codigo_ausente() -> None:
    """`V-ADT-04` / `R-ADT-06a` — não se aumenta o que não foi contratado.

    O sintoma é preciso e não tem outra causa: ou falta a peça intermediária que
    incluiu o código, ou o bloco está rotulado como aumento em vez de inclusão.
    Nos dois casos o item cairia no bloco final, calado.

    É, de quebra, o detector automático de peça faltante que o `I-03` pedia.
    """
    achados = ValidationReport()
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.AUMENTO, "99.999.00001.00"))
    consolidado = proposta.aplicar([aditivo])

    v_adt_04_movimento_de_codigo_ausente(consolidado, [aditivo], achados)

    assert not achados.bloqueado
    (aviso,) = achados.avisos
    assert aviso.validacao == "V-ADT-04"
    assert aviso.codigo == "99.999.00001.00"
    assert "falta uma peça anterior" in aviso.mensagem

    # T-1608 / ESPEC 022 `R-QTD-03` — as duas asserções que faltavam.
    #
    # Antes da ESPEC 022 elas eram impossíveis de violar: nenhum bloco de delta
    # era aplicado, e o consolidado nunca podia crescer por este caminho. Depois
    # dela passam a ser a rede da guarda — sem elas, um `Aumento` órfão entraria
    # como item novo e este teste continuaria verde, porque `V-ADT-04` avisa
    # sobre o **aditivo**, não sobre o que a consolidação fez com ele.
    assert consolidado.quantidade_para("99.999.00001.00") is None
    assert consolidado.quantidade_para("10.050.00001.00") == proposta.quantidade_para(
        "10.050.00001.00"
    )


def test_t1333_v_adt_04_nao_avisa_quando_o_codigo_existe() -> None:
    achados = ValidationReport()
    proposta = _peca("PA-BASE", _bloco(None, "10.050.00001.00"))
    aditivo = _peca("PA-ADT", _bloco(RotuloDeBloco.AUMENTO, "10.050.00001.00"))

    v_adt_04_movimento_de_codigo_ausente(proposta.aplicar([aditivo]), [aditivo], achados)

    assert achados.avisos == []


# ── T-1334 · O espelho real da exclusão ───────────────────────────────────────


def test_t1334_o_anexo_ii_nao_e_lido_como_instrucao(caminho_contrato_pgm: Path) -> None:
    """`R-ADT-13` / `D-12` — o `ANEXO II` é registro, e registro não se executa.

    As páginas 30 a 32 da proposta do PGM listam sete exclusões, duas inclusões,
    dois aumentos e uma redução — **e a tabela de itens já reflete os doze**.
    Aplicá-lo poria `14.070.00001.00` e `14.070.00002.00` em duplicata.

    A garantia é estrutural e não disciplinar: as faixas do anexo têm de 3 a 6
    divisórias, e o extrator só alcança as de 8 (§2.11).
    """
    proposta = PdfPlumberContractExtractor().extrair(caminho_contrato_pgm)

    # Os sete excluídos pelo `ANEXO II` não estão na tabela de itens.
    for codigo in (
        "12.029.00009.00",
        "12.029.00012.00",
        "12.029.00021.00",
        "12.029.00024.00",
        "12.029.00026.00",
        "12.074.00001.00",
        "14.033.00001.00",
    ):
        assert codigo not in proposta.codigos, f"{codigo} veio do ANEXO II"

    # E os dois incluídos estão **uma vez só**, com a quantidade que o anexo diz.
    assert len(proposta.itens_de("14.070.00001.00")) == 1
    assert proposta.quantidade_para("14.070.00001.00") == Decimal("43")
    assert len(proposta.itens_de("14.070.00002.00")) == 1


# ── T-1340 · O âncora do par completo do PGM ──────────────────────────────────


@pytest.fixture(scope="module")
def resultado_do_pgm(
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
) -> object:
    return DIContainer().gerar(
        Entradas(
            contrato=caminho_contrato_pgm,
            levantamento=caminho_levantamento_pgm,
            aditivos=(caminho_aditivo_pgm,),
        )
    )


def test_t1340_o_par_completo_do_pgm_gera_documento(resultado_do_pgm) -> None:  # type: ignore[no-untyped-def]
    """O critério de aceite da ESPEC 019 §9.3, em números.

    47 linhas ordenadas pelo contrato e 11 no bloco final — contra 45 e 13 sem o
    aditivo. O total continua 58: o universo é a aba `Levantamento`, e ele não
    mudou. O que mudou foi **quantos daqueles códigos o contrato conhece**.
    """
    assert resultado_do_pgm.achados.bloqueantes == []
    assert len(resultado_do_pgm.relatorio.linhas) == 47
    assert len(resultado_do_pgm.relatorio.demais_itens) == 11
    assert resultado_do_pgm.relatorio.total_linhas == 58


def test_t1340_os_dois_incluidos_entram_no_corpo_ordenado(resultado_do_pgm) -> None:  # type: ignore[no-untyped-def]
    """`R-ADT-04` — saem do bloco `DEMAIS ITENS` e entram ao fim da ordem.

    São o *grupo C* da ESPEC 018 §2.3: a planilha afirmava que estavam
    contratados e o PDF não os conhecia. A peça que faltava era o aditivo.
    """
    ordenadas = [str(linha.codigo) for linha in resultado_do_pgm.relatorio.linhas]
    finais = [str(linha.codigo) for linha in resultado_do_pgm.relatorio.demais_itens]

    assert ordenadas[-2:] == list(INCLUIDOS)
    assert not set(INCLUIDOS) & set(finais)


def test_t1340_v_rec_01_zera_no_pgm(resultado_do_pgm) -> None:  # type: ignore[no-untyped-def]
    """O silêncio da `V-REC-01` no documento real — **verde por outro motivo**.

    T-1621 / ESPEC 022 — as asserções não mudaram, o mecanismo por trás delas
    sim. Até aqui o silêncio vinha da `D-08` da ESPEC 019: a validação recebia a
    lista dos códigos que os blocos `Aumento` e `Redução` tocavam e calava sobre
    eles. Agora ele é **aritmético** — os deltas são somados ao consolidado
    (`R-QTD-01`), as duas fontes batem nos cinco códigos (ESPEC 022 §2.2), e não
    há o que acusar.

    A distinção importa porque a antiga só valia por correspondência: os cinco
    códigos suprimidos eram *exatamente* os cinco acusados, e essa coincidência
    é que autorizava o silêncio. Ela não sobreviveria a uma sexta divergência
    dentro dos mesmos códigos — e não sobreviveu: ESPEC 022 §2.4 mediu que, com
    a aba adulterada, a versão anterior acusava **zero**.

    T-1525 / ESPEC 021 — **o canário mudou de galho**, e continua necessário. Até
    a ESPEC 021, os cinco `V-REC-02` provavam que o pipeline não tinha
    simplesmente emudecido; a `V-REC-02` deixou de ser achado (`R-PER-08`) e a
    contraprova passou a ser a contagem de linhas derivadas, que continua 5. Sem
    a segunda asserção, este teste ficaria verde num pipeline que não registrasse
    nada.

    O canário do silêncio **em si** vive em dois outros testes, e nenhum dos dois
    é este: `test_t1340_o_silencio_e_fundamentado_e_nao_geral`, que prova que sem
    aditivo os cinco avisos voltam, e
    `test_quantitativo_consolidado.py::test_t1605_a_aba_adulterada_e_acusada`,
    que prova que com a aba errada um aviso aparece.
    """
    validacoes = [a.validacao for a in resultado_do_pgm.achados.avisos]

    assert "V-REC-01" not in validacoes
    assert validacoes == []
    assert len(resultado_do_pgm.derivadas) == 5
    # T-1728 — o campo novo também está vazio. Sem esta linha o teste ficaria
    # verde num pipeline que parasse de comparar: `avisos == []` deixou de
    # distinguir *nada a acusar* de *nada foi conferido* quando a informação
    # mudou de lugar.
    assert resultado_do_pgm.divergencias == ()


def test_t1340_o_silencio_e_fundamentado_e_nao_geral(
    caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path
) -> None:
    """`[risco]` — sem o aditivo, os cinco avisos **voltam**.

    É a contraprova que separa *"a validação calou porque o aditivo explica"* de
    *"a validação foi desligada"*. Sem esta asserção, `D-08` passaria também numa
    implementação que simplesmente removesse a `V-REC-01`.
    """
    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato_pgm, levantamento=caminho_levantamento_pgm)
    )

    # T-1728 / ESPEC 023 — a `V-REC-01` deixou de ser achado (`R-FON-09`) e a
    # âncora acompanhou a informação até a fonte nova. **Não** virou
    # `avisos == []`: assim ela continua provando o que foi escrita para provar —
    # que sem a peça os cinco voltam, um a um, e não que o pipeline emudeceu.
    acusados = {d.codigo for d in resultado.divergencias}
    assert acusados == EXPLICADOS_PELO_ADITIVO


def test_t1340_o_rodape_nomeia_as_duas_pecas(resultado_do_pgm) -> None:  # type: ignore[no-untyped-def]
    """`R-ADT-11` / `D-09` — a origem do escopo são duas peças, e o rodapé diz."""
    relatorio = resultado_do_pgm.relatorio

    assert relatorio.propostas == ("PA-PGM-251015-159", "PA-PGM-260304-715")
    assert relatorio.proposta_origem == "PA-PGM-251015-159 e PA-PGM-260304-715"


@pytest.mark.parametrize(
    ("propostas", "esperado"),
    [
        (("PA-SMIT-260319-739",), "Conforme a proposta PA-SMIT-260319-739"),
        (
            ("PA-PGM-251015-159", "PA-PGM-260304-715"),
            "Conforme as propostas PA-PGM-251015-159 e PA-PGM-260304-715",
        ),
    ],
)
def test_t1341_o_rodape_do_docx_concorda_em_numero(
    propostas: tuple[str, ...], esperado: str, tmp_path: Path
) -> None:
    """`R-ADT-11` / `D-09` — a cadeia que sai no documento entregue ao órgão.

    **Não havia teste nenhum sobre o rodapé** antes desta espec: a linha podia
    ser reescrita sem nada ficar vermelho. Entra agora porque `D-09` a reescreve.

    Saiu a palavra *Quantidades*: desde a ESPEC 018 `D-05` as duas quantidades
    vêm da aba `Levantamento`. O que estas propostas originam é o **escopo** —
    quais itens existem, em que ordem e com que designação —, e dizer
    *quantidades* apontava para a fonte errada.
    """
    relatorio = Report(
        titulo="LEVANTAMENTO - COMPROVAÇÃO",
        data_levantamento=None,
        contrato_referencia="TC 015/PGM/2024",
        proposta_origem=" e ".join(propostas),
        propostas=propostas,
    )

    destino = DocxRenderer().renderizar(relatorio, tmp_path / "saida.docx")
    textos = [p.text for p in docx.Document(destino).paragraphs]

    (rodape,) = [t for t in textos if t.startswith("Contrato:")]
    assert rodape == f"Contrato: TC 015/PGM/2024  ·  {esperado}"


def test_t1340_o_piloto_sem_aditivo_nao_se_move(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """ESPEC 019 §9.1 e `D-10` — zero aditivos é o caminho de hoje, bit a bit."""
    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento)
    )

    assert resultado.achados.bloqueantes == []
    assert len(resultado.relatorio.linhas) == 54
    assert len(resultado.relatorio.demais_itens) == 4
    assert resultado.relatorio.proposta_origem == "PA-SMIT-260319-739"
    # T-1526 / ESPEC 021 — as quatro linhas `1 / 1` do piloto deixaram de ser
    # quatro frases e passaram a ser quatro registros. O piloto fica **sem
    # nenhum aviso**, e é a contagem de derivadas que prova que o caminho rodou.
    assert resultado.achados.avisos == []
    assert len(resultado.derivadas) == 4
