"""T-305 e T-316 — A configuração dos anexos (ESPEC 004 §4.1, ESPEC 037).

Cada anexo declara **quatro coisas mais o nome da aba**, e só essas quatro:

    aba ............. de onde vem o conteúdo
    orientacao ...... retrato ou paisagem, como no GRC (`R-ANX-03`)
    corpo ........... o corpo de fonte medido no GRC (`R-ANX-04`)
    cabecalho ....... como reconhecer a linha que se repete (`R-CAB-01`)

**A quarta era um número, e virou um rótulo (ESPEC 037).** `linha_cabecalho`
continua no JSON, e não é mais lido pelo leitor: as três primeiras descrevem
como o GRC *imprime* a aba e não variam entre planilhas; o número da linha
descreve **um arquivo**, e varia com o tamanho do preâmbulo daquele órgão. Foi
essa troca de categoria que pôs uma linha de dados no topo de cada página em
cinco anexos do PGM.

Todo o resto — título, resumo, subtítulos, mesclagens e cores — **vem da aba**.
Foi o que a medição mostrou (ESPEC 004 §3.1), e é o que reduz a configuração a
isto: as três primeiras não estão na planilha, e a quarta é uma escolha nossa.

Fica em JSON versionado ao lado do código, pelo mesmo motivo do catálogo padrão:
diffável na revisão, e acrescentar um anexo não é mudar o renderizador.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from domain.entities.annex import Orientacao

ARQUIVO = Path(__file__).parent / "anexos.json"

# Medidas extraídas do relatório GRC por `scripts/medir_anexos_grc.py`. Gerado,
# não editado à mão — e separado do `anexos.json`, que é configuração humana.
MEDIDAS = Path(__file__).parent / "medidas_grc.json"


@dataclass(frozen=True)
class MedidasDoAnexo:
    """A geometria da tabela no documento de referência.

    `larguras_pt` fica vazio quando a medição é ambígua: as fronteiras vêm das
    bordas do PDF, e uma coluna sem borda não produz fronteira. Nesses casos
    vale a proporção da planilha, esticada até `largura_total_pt` — que continua
    sendo medida.
    """

    largura_total_pt: float
    altura_linha_pt: float | None = None
    larguras_pt: tuple[float, ...] = ()
    # Tamanho impresso de cada figura da aba, na ordem em que aparecem.
    imagens_pt: tuple[tuple[float, float], ...] = ()


@dataclass(frozen=True)
class ConfiguracaoDeAnexo:
    aba: str
    orientacao: Orientacao
    corpo: float
    # ESPEC 037 `R-CAB-05` — 1-based, contada na aba, como se lê a planilha
    # aberta no Excel. **Não alimenta mais a renderização**: é a medição do GRC,
    # e existe para ser o oráculo da `R-CAB-06`, que exige que a âncora resolva
    # exatamente neste número no piloto. Apagá-lo jogaria fora a única medição
    # independente que existe — ver `D-03`.
    linha_cabecalho: int | None
    # ESPEC 037 `R-CAB-01` — os primeiros rótulos do cabeçalho de colunas,
    # medidos no piloto. É por eles que a linha é localizada em cada planilha.
    # Vazio significa anexo que não repete cabeçalho (`R-CAB-04`).
    cabecalho: tuple[str, ...] = ()
    # ESPEC 051 `R-SEG-01` — âncoras de cabeçalhos além do primário, para abas
    # com mais de uma tabela empilhada e de forma diferente (`Servidores`,
    # `ServidoresSemDesenv`). Cada uma resolvida pela mesma R-CAB-01/03 da
    # ESPEC 037. Vazio para os 17 anexos com uma única tabela de corpo.
    cabecalhos_adicionais: tuple[tuple[str, ...], ...] = ()
    # Só documentação: de onde a medição saiu. Não influencia a renderização.
    paginas_grc: str = ""


def medidas_do_grc() -> dict[str, MedidasDoAnexo]:
    if not MEDIDAS.exists():  # pragma: no cover — só se o arquivo gerado sumir
        return {}
    dados = json.loads(MEDIDAS.read_text(encoding="utf-8"))
    return {
        aba: MedidasDoAnexo(
            largura_total_pt=float(medida["largura_total_pt"]),
            altura_linha_pt=(
                float(medida["altura_linha_pt"])
                if medida.get("altura_linha_pt") is not None
                else None
            ),
            larguras_pt=tuple(float(v) for v in medida.get("larguras_pt", ())),
            imagens_pt=tuple(
                (float(caixa[0]), float(caixa[1])) for caixa in medida.get("imagens_pt", ())
            ),
        )
        for aba, medida in dados.items()
    }


def anexos_configurados() -> tuple[ConfiguracaoDeAnexo, ...]:
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))
    return tuple(
        ConfiguracaoDeAnexo(
            aba=entrada["aba"],
            orientacao=Orientacao(entrada["orientacao"]),
            corpo=float(entrada["corpo"]),
            linha_cabecalho=entrada.get("linha_cabecalho"),
            cabecalho=tuple(entrada.get("cabecalho", ())),
            cabecalhos_adicionais=tuple(
                tuple(ancora) for ancora in entrada.get("cabecalhos_adicionais", ())
            ),
            paginas_grc=entrada.get("paginas_grc", ""),
        )
        for entrada in dados["anexos"]
    )
