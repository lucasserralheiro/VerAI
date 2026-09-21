"""T-2323 / T-2324 — O cabeçalho que se repete é o cabeçalho (ESPEC 037).

**A rede que faltava.** `test_docx_anexos.py` já olhava a marca `w:tblHeader` em
três testes. Os três afirmam **posição** — que a marca cai na fileira 0 —, e
nenhum afirma **identidade**. E os três rodam só sobre o piloto.

Foi por essa fresta que o defeito atravessou o versionamento: no par do PGM,
**cinco** anexos marcavam uma linha de dados como cabeçalho, e o Word a repetia
no topo de cada página. `Office365` repetia `PERFIL POWER BI PRO | … | 10 | 5`.

O que este módulo afirma é uma **relação entre o documento e o catálogo**, e não
um número: toda fileira marcada ou é o cabeçalho da tabela de comprovação, ou
traz os rótulos que `anexos.json` declara para algum anexo. É o que continua
valendo para a planilha do mês que vem.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import docx
import pytest
from docx.oxml.ns import qn

from domain.entities.annex import Anexo, CelulaAnexo, Orientacao
from domain.entities.report import Report
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.annex.cabecalho import localizar_cabecalho
from infrastructure.annex.configuracao import anexos_configurados
from infrastructure.measurement.aba_reader import AbaReader
from infrastructure.report import layout
from infrastructure.report.docx_renderer import DocxRenderer
from infrastructure.shared.arquivos import abrir_planilha_com_estilos
from infrastructure.validations.annex_validations import v_anx_02_cabecalho_nao_localizado


def _tem_cabecalho_repetido(fileira: Any) -> bool:
    trPr = fileira._tr.find(qn("w:trPr"))
    return trPr is not None and trPr.find(qn("w:tblHeader")) is not None


def _rotulos_da_fileira(fileira: Any) -> tuple[str, ...]:
    """Textos não vazios, com repetições **consecutivas** colapsadas.

    **O colapso não é esperteza: é como o `python-docx` expõe célula mesclada.**
    `fileira.cells` devolve o mesmo objeto uma vez por posição da grade, então o
    cabeçalho de `Office365` no piloto sai
    ``Nº | Secretaria | Nome | Nome | Nome | Nome | Login``. Do lado da planilha
    o `openpyxl` faz o contrário — guarda o valor só na âncora da região e deixa
    as demais vazias. **As duas normalizações precisam encontrar-se no meio.**

    Três fileiras do piloto só passam com o colapso **e** com o descarte de
    vazias: `CertificadosDigitais` (``SECRETARIA | URL | URL | DATA VALIDADE``),
    `Central de Servicos` (``Unidade | Unidade | Qtde``) e `WIFI`
    (``· | · | Unidade | Quantidade Medida | · | · | ·``).
    """
    saida: list[str] = []
    for celula in fileira.cells:
        texto = celula.text.strip()
        if texto and (not saida or saida[-1] != texto):
            saida.append(texto)
    return tuple(saida)


def _normalizar(rotulos: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(r.strip().casefold() for r in rotulos)


def _fileiras_marcadas(caminho: Path) -> list[tuple[str, ...]]:
    documento = docx.Document(str(caminho))
    return [
        _rotulos_da_fileira(fileira)
        for tabela in documento.tables
        for fileira in tabela.rows
        if _tem_cabecalho_repetido(fileira)
    ]


def _ancoras() -> list[tuple[str, ...]]:
    """As 19 âncoras do catálogo, mais as adicionais, mais a tabela de comprovação.

    A comprovação entra porque usa o **mesmo** `repetir_cabecalho`, e o
    cabeçalho dela é construído pelo renderizador a partir de
    `layout.CABECALHO_COLUNAS` — não vem de planilha, e não há o que localizar.

    ESPEC 051 `R-SEG-01` — as âncoras adicionais (`Servidores`,
    `ServidoresSemDesenv`) entram aqui também: sem elas, a fileira do
    cabeçalho de detalhe passaria por "sem âncora declarada" depois da
    correção, quando na verdade é exatamente o cabeçalho que ela produz.
    """
    catalogo = [_normalizar(c.cabecalho) for c in anexos_configurados() if c.cabecalho]
    adicionais = [
        _normalizar(ancora)
        for c in anexos_configurados()
        for ancora in c.cabecalhos_adicionais
    ]
    return [_normalizar(layout.CABECALHO_COLUNAS), *catalogo, *adicionais]


def _sem_ancora(caminho: Path) -> list[tuple[str, ...]]:
    """As fileiras marcadas que **nenhuma** âncora explica."""
    ancoras = _ancoras()
    return [
        rotulos
        for rotulos in _fileiras_marcadas(caminho)
        if not any(_normalizar(rotulos)[: len(a)] == a for a in ancoras)
    ]


# ── T-2323 · a rede, nos dois pares ───────────────────────────────────────────


def test_t2323_toda_fileira_marcada_do_piloto_e_um_cabecalho(docx_do_piloto: Path) -> None:
    """Verde **antes e depois**: o piloto é a régua de não-vazamento.

    As 19 âncoras foram medidas nesta planilha, então todas resolvem no número
    que `linha_cabecalho` já trazia. Um vermelho aqui é a correção tendo mexido
    num índice que estava certo.
    """
    assert _sem_ancora(docx_do_piloto) == []


def test_t2323_toda_fileira_marcada_do_pgm_e_um_cabecalho(documento_do_pgm: Path) -> None:
    """**É o teste que reprova hoje**, e é o motivo desta espec existir.

    Cinco fileiras de dados carregam `w:tblHeader` no par do PGM, uma por anexo
    cujo preâmbulo tem tamanho diferente do da planilha em que `linha_cabecalho`
    foi medido:

    * `Servidores` ........... ``D84V50I | 1 | 2 | 80 | 20 | 0 | 0``
    * `ServidoresSemDesenv` .. ``C68V13I | 2 | 4 | 70 | 10 | 0 | 0``
    * `SDWAN` ................ ``LINK DE CONECTIVIDADE | … | 2``
    * `SOA` .................. ``SN1403 | PIDE-PLANO DE INFORMATIZAÇÃO… | 944``
    * `Office365` ............ ``PERFIL POWER BI PRO | … | 10 | 5 | 0 | 5 | 5``

    Usa a fixture de sessão do `conftest`: renderizar o PGM de novo custaria os
    ~115 s que a `T-2001` existe para não pagar duas vezes.
    """
    orfas = _sem_ancora(documento_do_pgm)
    assert orfas == [], f"{len(orfas)} fileiras marcadas sem cabeçalho declarado: {orfas}"


# ── ESPEC 051 · nenhuma fileira marcada tem célula vazia ──────────────────────


def test_nenhuma_fileira_marcada_tem_celula_vazia(
    docx_do_piloto: Path, documento_do_pgm: Path
) -> None:
    """ESPEC 051 `§8.2` — a rede que a ESPEC 037 não escreveu porque não sabia deste defeito.

    Escopo em `Servidores`/`ServidoresSemDesenv`, e não no documento inteiro:
    `WIFI` tem cabeçalho legítimo de 2 rótulos em 10 colunas, começando por
    células vazias **por desenho da aba** (ESPEC 037 §2.6) — uma asserção sem
    escopo reprovaria um caso correto. `_rotulos_da_fileira` descarta células
    vazias de propósito (para lidar com mesclagem); é exatamente esse
    descarte que deixava passar uma fileira com 4 de 15 colunas sem texto —
    `Servidores`/`ServidoresSemDesenv` tinham o cabeçalho de resumo (11
    rótulos) marcado numa tabela de 15 colunas de grade, porque o bloco
    continha também a tabela de detalhe. Esta rede olha a fileira **crua**,
    sem descartar nada, só nas fileiras cujos rótulos casam uma âncora —
    primária ou adicional — desses dois anexos.
    """
    alvo = {"Servidores", "ServidoresSemDesenv"}
    ancoras = [
        _normalizar(ancora)
        for config in anexos_configurados()
        if config.aba in alvo
        for ancora in (config.cabecalho, *config.cabecalhos_adicionais)
    ]
    for caminho in (docx_do_piloto, documento_do_pgm):
        documento = docx.Document(str(caminho))
        for tabela in documento.tables:
            for fileira in tabela.rows:
                if not _tem_cabecalho_repetido(fileira):
                    continue
                rotulos = _normalizar(_rotulos_da_fileira(fileira))
                if not any(rotulos[: len(a)] == a for a in ancoras):
                    continue
                textos = [celula.text.strip() for celula in fileira.cells]
                assert all(textos), f"{caminho.name}: {textos}"


# ── T-2324 · `R-CAB-06`, a âncora resolve a linha medida no GRC ───────────────


def test_t2324_a_ancora_resolve_a_linha_medida_no_piloto(caminho_levantamento: Path) -> None:
    """**A razão de `linha_cabecalho` continuar existindo** (`R-CAB-05`, `D-03`).

    As âncoras foram transcritas de uma planilha; os números foram medidos no
    GRC, por outro caminho e em outro incremento. Comparar os dois é a única
    rede que pega uma âncora transcrita errada **antes** de ela virar documento
    — e é um teste que só se escreve se os dois existirem. Quem apagar
    `linha_cabecalho` por parecer resíduo terá apagado este oráculo.

    **O `import` é local de propósito.** Antes da `E2` o módulo não existe, e um
    `import` no topo derrubaria a *coleta* do arquivo inteiro — inclusive da
    rede da `T-2323`, que precisa reprovar por **valor** para o portão `P1`
    significar alguma coisa.
    """
    from infrastructure.annex.cabecalho import localizar_cabecalho

    livro = abrir_planilha_com_estilos(caminho_levantamento, "medição")
    leitor = AbaReader()
    try:
        divergentes = []
        for config in anexos_configurados():
            if config.aba not in livro.sheetnames or config.linha_cabecalho is None:
                continue
            forma = leitor.ler(livro[config.aba])
            resolvido = localizar_cabecalho(forma.linhas, config.cabecalho)
            if resolvido != config.linha_cabecalho - 1:
                divergentes.append((config.aba, config.linha_cabecalho - 1, resolvido))
    finally:
        livro.close()

    assert divergentes == []


# O guarda do catálogo — toda entrada declara âncora, de um a três rótulos —
# vive em `test_anexos_configuracao.py`, ao lado dos dois de `linha_cabecalho`
# que ele acompanha (`T-2345`). Aqui o assunto é o documento.


# ── T-2328 · os casos construídos (`R-CAB-02` a `R-CAB-04`) ───────────────────


def _linha(*textos: str) -> tuple[CelulaAnexo, ...]:
    return tuple(CelulaAnexo(texto=t) for t in textos)


def _relatorio(anexos: list[Anexo]) -> Report:
    """Um relatório novo a cada uso — o `relatorio_vazio` é de sessão."""
    return Report(
        titulo="LEVANTAMENTO - COMPROVAÇÃO",
        data_levantamento=date(2026, 7, 15),
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
        anexos=anexos,
    )


@pytest.mark.parametrize("preambulo", [3, 8, 20])
def test_t2328a_o_indice_acompanha_o_preambulo(preambulo: int) -> None:
    """**O defeito, em miniatura.** É o `Office365` do SMIT, do PGM e do FTM.

    O mesmo cabeçalho, precedido de blocos de resumo de tamanhos diferentes —
    que é o que varia com o escopo contratado do órgão. Um número fixo acerta
    um dos três e marca linha de dados nos outros dois.
    """
    linhas = (
        *(_linha("resumo", str(i)) for i in range(preambulo)),
        _linha("Nº", "Secretaria", "Nome"),
        _linha("1", "FTM", "Alipia"),
    )
    assert localizar_cabecalho(linhas, ("Nº", "Secretaria", "Nome")) == preambulo


def test_t2328b_mesclada_ou_nao_da_o_mesmo_rotulo() -> None:
    """`R-CAB-02` — é o caso SMIT × FTM, e o que faz uma âncora servir aos dois.

    O `openpyxl` guarda o valor só na âncora da região mesclada: `Nome` em
    quatro colunas chega como `Nome` seguido de três vazias.
    """
    mesclada = (_linha("Nº", "Secretaria", "Nome", "", "", "", "Login"),)
    simples = (_linha("Nº", "Secretaria", "Nome", "Login"),)
    chave = ("Nº", "Secretaria", "Nome")

    assert localizar_cabecalho(mesclada, chave) == 0
    assert localizar_cabecalho(simples, chave) == 0


def test_t2328c_caixa_e_espaco_nao_separam_mas_acento_sim() -> None:
    """`R-CAB-02` — normalizar não é adivinhar.

    Dobrar acento criaria casamentos que ninguém pediu, e a medição nas 35
    combinações diz que não é preciso.
    """
    linhas = (_linha(" nº ", "SECRETARIA"),)

    assert localizar_cabecalho(linhas, ("Nº", "Secretaria")) == 0
    assert localizar_cabecalho(linhas, ("NÚMERO", "Secretaria")) is None


def test_t2328d_prefixo_de_cabecalho_mais_largo_resolve() -> None:
    """`R-CAB-03` — o caso `BD`, e a razão de não ser igualdade.

    A mesma aba traz `VOLUME GB | PERFIL` no piloto e `AMBIENTE | VOLUME GB` no
    PGM. Exigir a tupla inteira devolveria `None` para uma aba **hoje correta**,
    e a correção quebraria o que funcionava.
    """
    piloto = (_linha("CLIENTE", "GERENCIADOR", "PROJETO", "VOLUME GB", "PERFIL"),)
    pgm = (_linha("CLIENTE", "GERENCIADOR", "PROJETO", "AMBIENTE", "VOLUME GB"),)
    chave = ("CLIENTE", "GERENCIADOR", "PROJETO")

    assert localizar_cabecalho(piloto, chave) == 0
    assert localizar_cabecalho(pgm, chave) == 0


def test_t2328e_ancora_repetida_resolve_na_primeira() -> None:
    """`R-CAB-03` — o caso `NAS`, e a razão de não exigir unicidade.

    Algumas abas têm um segundo bloco com a mesma tabela: `NAS` casa nas linhas
    7 e 40 do piloto, e 7 e 179 do PGM. A primeira é o cabeçalho da maior
    tabela, que é o que `anexos.json` sempre quis apontar.
    """
    linhas = (
        _linha("título"),
        _linha("Secretaria", "Pasta", "Share"),
        _linha("SMIT", "x", "y"),
        _linha(""),
        _linha("Secretaria", "Pasta", "Share"),
    )
    assert localizar_cabecalho(linhas, ("Secretaria", "Pasta", "Share")) == 1


def test_t2328f_sem_ancora_o_anexo_sai_sem_repeticao(tmp_path: Path) -> None:
    """`R-CAB-04` — **a falha segura, afirmada no artefato e não no código.**

    É o único dos seis que passa pelo renderizador, e é o que prova que não foi
    preciso uma linha nova lá: com `linha_cabecalho is None`, `Anexo.corte`
    devolve `None` e `linha_cabecalho == inicio` fica `False`, então os **dois**
    caminhos deixam de marcar sozinhos (`D-04`).

    Nunca se marca "a linha que estiver lá": perde-se a repetição, que é
    conveniência de leitura, e não se ganha uma linha falsa, que é informação
    errada num documento que instrui faturamento.
    """
    anexo = Anexo(
        aba="SemAncora",
        orientacao=Orientacao.RETRATO,
        corpo=8.0,
        linha_cabecalho=None,
        linhas=(_linha("Coluna"), _linha("valor"), _linha("outro")),
        proporcoes=(10.0,),
    )
    destino = DocxRenderer().renderizar(_relatorio([anexo]), tmp_path / "sem_ancora.docx")

    documento = docx.Document(str(destino))
    tabelas_do_anexo = documento.tables[1:]

    assert len(tabelas_do_anexo) == 1  # uma tabela só, sem corte
    assert len(tabelas_do_anexo[0].rows) == 3  # e com todas as linhas
    assert not [
        f for t in tabelas_do_anexo for f in t.rows if _tem_cabecalho_repetido(f)
    ]


# ── T-2339 · `V-ANX-02`, o achado que impede o silêncio ───────────────────────


def _anexo(aba: str, *, com_conteudo: bool, cabecalho: int | None) -> Anexo:
    linhas = (_linha("valor"),) if com_conteudo else ((),)
    return Anexo(
        aba=aba,
        orientacao=Orientacao.RETRATO,
        corpo=8.0,
        linha_cabecalho=cabecalho,
        linhas=linhas,
    )


def test_t2339_avisa_quando_o_anexo_tem_conteudo_e_nao_achou_cabecalho() -> None:
    """Sem este achado, a ESPEC 037 troca um defeito ruidoso por um mudo.

    Antes dela, uma planilha com o cabeçalho renomeado repetia uma linha de
    dados em cada página — errado, e **visível**. Depois, o anexo sai sem
    repetição: correto, discreto e sem denunciar nada.
    """
    achados = ValidationReport()
    v_anx_02_cabecalho_nao_localizado(
        [_anexo("Office365", com_conteudo=True, cabecalho=None)], achados
    )

    assert len(achados.achados) == 1
    assert achados.achados[0].validacao == "V-ANX-02"
    assert achados.achados[0].severidade is Severity.AVISA
    assert "Office365" in achados.achados[0].mensagem
    assert not achados.bloqueado


def test_t2339_cala_para_anexo_vazio_sem_cabecalho() -> None:
    """**O caso que impede a `V-ANX-02` de duplicar a `V-ANX-01`** (`R-GRD-06`).

    Anexo vazio também chega com `linha_cabecalho is None`, e nele não há o que
    repetir. Sem esta condição, uma planilha com as abas renomeadas geraria dois
    achados sobre a mesma causa — que foi o defeito dos 57 achados do `PA-PGM`.
    """
    achados = ValidationReport()
    v_anx_02_cabecalho_nao_localizado(
        [_anexo("Colocation", com_conteudo=False, cabecalho=None)], achados
    )

    assert achados.achados == []


def test_t2339_cala_quando_todos_resolveram() -> None:
    """O caso dos dois pares versionados — e a razão de `T-2340` não mover nada."""
    achados = ValidationReport()
    v_anx_02_cabecalho_nao_localizado(
        [_anexo("Usuários", com_conteudo=True, cabecalho=7)], achados
    )

    assert achados.achados == []