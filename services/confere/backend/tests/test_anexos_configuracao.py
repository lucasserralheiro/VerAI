"""T-316 e T-318 — A configuração dos 19 anexos (ESPEC 004 §3 e §4.1).

A tabela abaixo é a da especificação, transcrita. Ela existe para que uma
alteração no `anexos.json` que contrarie o documento de referência quebre um
teste, em vez de sair no relatório — a orientação e o corpo foram **medidos** no
GRC, e um valor arbitrado aqui não teria como ser percebido.
"""

from __future__ import annotations

import pytest

from domain.entities.annex import Orientacao
from infrastructure.annex.configuracao import anexos_configurados

# aba, orientação, corpo — ESPEC 004 §3, medidos no GRC.
ESPERADO = [
    ("Detalhes", Orientacao.RETRATO, 4.8),
    ("DetalhesSemDesenv", Orientacao.RETRATO, 4.6),
    ("Servidores", Orientacao.RETRATO, 4.3),
    ("ServidoresSemDesenv", Orientacao.RETRATO, 4.4),
    ("BD", Orientacao.RETRATO, 6.7),
    ("Usuários", Orientacao.PAISAGEM, 5.6),
    ("NAS", Orientacao.RETRATO, 6.4),
    ("Central de Servicos", Orientacao.RETRATO, 11.0),
    ("Colocation", Orientacao.RETRATO, 11.0),
    ("Comunicação Dados", Orientacao.PAISAGEM, 3.5),
    ("SDWAN", Orientacao.PAISAGEM, 4.1),
    ("WIFI", Orientacao.PAISAGEM, 5.8),
    ("CertificadosDigitais", Orientacao.RETRATO, 11.0),
    ("Internet", Orientacao.RETRATO, 11.0),
    ("SOA", Orientacao.RETRATO, 11.0),
    ("OutrosServicos", Orientacao.RETRATO, 11.0),
    ("Office365", Orientacao.PAISAGEM, 4.0),
    ("ServicosVcloud", Orientacao.RETRATO, 8.9),
    ("ServicosEmNuvem", Orientacao.RETRATO, 10.2),
]

# `R-ANX-08` — a primeira é decorativa, a segunda já é a tabela de comprovação,
# a terceira está vazia.
FORA = {"Capa", "Levantamento", "Comunicação Dados Histórico"}


def test_sao_dezenove_anexos() -> None:
    assert len(anexos_configurados()) == 19


def test_a_ordem_e_a_do_relatorio_de_referencia() -> None:
    assert [c.aba for c in anexos_configurados()] == [aba for aba, _, _ in ESPERADO]


@pytest.mark.parametrize(("aba", "orientacao", "corpo"), ESPERADO, ids=lambda v: str(v))
def test_orientacao_e_corpo_sao_os_do_grc(
    aba: str, orientacao: Orientacao, corpo: float
) -> None:
    config = next(c for c in anexos_configurados() if c.aba == aba)
    assert (config.orientacao, config.corpo) == (orientacao, corpo)


def test_quatorze_retratos_e_cinco_paisagens() -> None:
    """ESPEC 004 §3 — contado no GRC, não arbitrado."""
    orientacoes = [c.orientacao for c in anexos_configurados()]
    assert orientacoes.count(Orientacao.RETRATO) == 14
    assert orientacoes.count(Orientacao.PAISAGEM) == 5


def test_as_abas_excluidas_nao_entram() -> None:
    assert not FORA & {c.aba for c in anexos_configurados()}


def test_todo_anexo_declara_a_linha_de_cabecalho() -> None:
    """Sem ela o cabeçalho não se repete, e `R-ANX-11` não teria onde se aplicar."""
    sem_cabecalho = [c.aba for c in anexos_configurados() if c.linha_cabecalho is None]
    assert not sem_cabecalho


def test_a_linha_de_cabecalho_e_contada_a_partir_de_um() -> None:
    """1-based, como se lê a planilha aberta — nunca zero."""
    assert all(
        c.linha_cabecalho is not None and c.linha_cabecalho >= 1
        for c in anexos_configurados()
    )


def test_todo_anexo_declara_a_ancora_do_cabecalho() -> None:
    """ESPEC 037 `R-CAB-01` — sem âncora não há como localizar a linha.

    E os dois testes acima **continuam valendo**: `linha_cabecalho` saiu da
    renderização e virou o oráculo da `R-CAB-06`, que exige que a âncora resolva
    exatamente nele no piloto. Apagá-lo por parecer resíduo apagaria a única
    medição independente que existe (`R-CAB-05`, `D-03`).
    """
    sem_ancora = [c.aba for c in anexos_configurados() if not c.cabecalho]
    assert not sem_ancora


def test_so_servidores_servidoressemdesenv_e_wifi_tem_ancora_adicional() -> None:
    """ESPEC 051 `R-SEG-07`, revisada pela ESPEC 054 — três anexos com mais de uma tabela.

    `Servidores` e `ServidoresSemDesenv` têm, além da tabela de resumo (11
    colunas), uma segunda tabela de detalhe por servidor (15 colunas) mais
    adiante na mesma aba — medido nos dois pacotes de referência e no arquivo
    real da submissão que originou a ESPEC 051. `WIFI` tem, além do resumo
    (`Unidade`/`Quantidade Medida`, linha 5), a tabela `TIPO de TC` (10
    colunas, linha 10) — medido na ESPEC 054. As outras 16 abas têm uma única
    tabela de corpo, e `cabecalhos_adicionais` fica vazio nelas.
    """
    com_adicional = {c.aba for c in anexos_configurados() if c.cabecalhos_adicionais}
    assert com_adicional == {"Servidores", "ServidoresSemDesenv", "WIFI"}


def test_a_ancora_tem_de_um_a_tres_rotulos() -> None:
    """Três é margem, não necessidade — **um** já resolve os dois pares (`I-05`).

    Quatro anexos têm cabeçalho de dois rótulos e ficam com dois. Alongar a
    âncora é a resposta se uma planilha futura repetir um rótulo cedo demais, e
    é uma linha de JSON.
    """
    fora = [c.aba for c in anexos_configurados() if not 1 <= len(c.cabecalho) <= 3]
    assert not fora
