"""T-2305 — Validação dos anexos de detalhamento (ESPEC 036 §5.1).

Existe por causa do que a ESPEC 036 **apagou**. Até ela, uma planilha que
nomeasse as abas de outro jeito produzia dezenove páginas dizendo *"a planilha
não trouxe conteúdo para este anexo"* — feias, mas o único sinal de que algo
estava errado com o arquivo inteiro. Omitidas as páginas, o sinal precisa de
outro lugar, e o lugar é o painel de achados.

Um achado, não dezenove (`R-GRD-06`): a causa é a planilha; as dezenove
ausências são a consequência repetida. Foi assim que nasceram os 57 achados do
`PA-PGM` que a ESPEC 017 teve de desfazer.
"""

from __future__ import annotations

from domain.entities.annex import Anexo
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.annex.configuracao import anexos_configurados

# As abas configuradas vão no `detalhe`, que é a parte recolhida do cartão
# (`R-DOC-05`): quem confere não precisa da lista, e o suporte precisa.
_LIMITE_DE_ABAS_NO_DETALHE = 19


def v_anx_01_nenhuma_aba_de_anexo_reconhecida(
    anexos: list[Anexo], achados: ValidationReport
) -> None:
    """Nenhuma aba configurada trouxe conteúdo. **Avisa, não bloqueia.**

    `AVISA` e não `BLOQUEIA` (`D-05`): quando isto dispara, `V-MED-01` já passou
    e a identidade já foi conferida — o que fatura está inteiro, e o que falta é
    detalhamento. O `AnexoReader` já decidiu, com razão, que aba faltante não
    derruba a geração; bloquear aqui desfaria aquela decisão pelo lado de fora.

    **Ausência parcial não dispara** (`D-04`). O PGM não tem `Colocation`,
    `Comunicação Dados` nem `CertificadosDigitais` porque não contratou aqueles
    serviços: são 3 de 19 em toda competência, e avisar sobre elas todo mês
    transformaria um fato estável em ruído.

    Lista vazia também não dispara. Fora do fluxo do contêiner — e o contêiner
    só lê os anexos quando o relatório vai existir — a lista vazia significa
    *"não se leu"*, e não *"não veio nada"*.
    """
    if not anexos or any(not anexo.vazio for anexo in anexos):
        return

    abas = [anexo.aba for anexo in anexos[:_LIMITE_DE_ABAS_NO_DETALHE]]
    achados.registrar_em_partes(
        "V-ANX-01",
        Severity.AVISA,
        titulo="Nenhuma aba de detalhamento foi reconhecida na planilha.",
        causa=(
            f"As {len(anexos)} abas de anexo esperadas não foram encontradas, ou vieram "
            "sem conteúdo. A tabela de comprovação foi lida normalmente."
        ),
        acao=(
            "Confira se a planilha é a do levantamento completo. O documento sai sem "
            "os anexos de detalhamento."
        ),
        detalhe="Abas configuradas: " + ", ".join(abas) + ".",
    )


def v_anx_02_cabecalho_nao_localizado(
    anexos: list[Anexo], achados: ValidationReport
) -> None:
    """ESPEC 037 `V-ANX-02` — o cabeçalho não foi achado, e o anexo sai sem ele.

    **`not anexo.vazio` é o que separa esta validação da `V-ANX-01`.** Anexo
    vazio também tem `linha_cabecalho is None`, e nele não há o que repetir:
    dois achados sobre o mesmo fato seriam a `R-GRD-06` violada — o defeito dos
    57 achados do `PA-PGM` que a ESPEC 017 teve de desfazer.

    **Um achado com a lista, não um por aba**, pela mesma razão. E `AVISA`, não
    `BLOQUEIA` (`D-06`): o conteúdo do anexo saiu inteiro; o que falta é a
    repetição de um rótulo entre páginas.

    Não dispara em nenhum dos dois pares versionados — as 19 âncoras resolvem no
    piloto e as 16 presentes resolvem no PGM. É guarda de anomalia, no
    precedente da `V-ANX-01` logo acima.
    """
    orfaos = [
        anexo.aba for anexo in anexos if not anexo.vazio and anexo.linha_cabecalho is None
    ]
    if not orfaos:
        return

    ancoras = {config.aba: config.cabecalho for config in anexos_configurados()}
    detalhe = "; ".join(
        f"{aba}: esperava uma linha começando por " + " | ".join(ancoras.get(aba, ()))
        for aba in orfaos[:_LIMITE_DE_ABAS_NO_DETALHE]
    )
    achados.registrar_em_partes(
        "V-ANX-02",
        Severity.AVISA,
        titulo="O cabeçalho de colunas não foi localizado em alguns anexos.",
        causa=(
            f"Em {len(orfaos)} aba(s) de detalhamento — {', '.join(orfaos)} — nenhuma linha "
            "traz os rótulos esperados de cabeçalho. O conteúdo saiu inteiro; o que falta é a "
            "repetição do cabeçalho no topo de cada página."
        ),
        acao=(
            "Confira se a planilha renomeou as colunas dessas abas. O restante do documento "
            "não é afetado."
        ),
        detalhe=detalhe + ".",
    )
