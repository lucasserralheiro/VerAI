"""T-800 · T-801 — O que o Excel exibiria, e onde isso diverge do relatório.

ESPEC 013 troca duas colunas por quantidade — uma de texto, uma de número — por
**uma** coluna numérica com formato de exibição. O risco da troca é silencioso: a
célula guarda o número certo e **mostra** outra coisa, e nenhum teste de valor
percebe.

Este módulo é o instrumento que percebe. Ele deriva, do par (valor, código de
formato), o texto que o Excel mostraria, e confronta com ``Quantity.formatar()`` —
que é a grafia do `.docx`, a fonte da verdade.

**Vale só para os dois códigos desta espec.** Um interpretador geral de formato do
Excel seria maior que a mudança inteira e traria defeitos próprios, que passariam
por defeitos do renderizador — instrumento com bug acusa o inocente.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

import openpyxl
from leitura_analise import ABA_DA_CLASSIFICACAO, PRIMEIRA_LINHA_DE_DADO

from domain.entities.analysis import AnaliseDaMedicao

# Os cabeçalhos que carregam quantidade, em qualquer arranjo de colunas. Localizar
# por nome e não por índice é o que faz este comparador sobreviver à própria
# mudança que ele verifica — ver PLANO 013 §5.5.
CABECALHOS_DE_QUANTIDADE = ("Contratado", "Medido", "Saldo")

# Escritos na convenção do OOXML — `.` decimal e `,` milhar —, que é inglesa. O
# Excel os exibe com os separadores do idioma do usuário: é ele quem traduz. A
# grafia brasileira (`#.##0,00`) parece a certa e produz arquivo inválido.
CODIGO_MILHAR_INTEIRO = "#,##0"
CODIGO_MILHAR_DECIMAL = "#,##0.00"
CODIGO_SIMPLES_INTEIRO = "0"
CODIGO_SIMPLES_DECIMAL = "0.00"

# Os códigos com `.##` da primeira versão da ESPEC 013. **Não são mais
# emitidos**, e continuam modelados aqui de propósito: quem os reintroduzir
# precisa ver o comparador acusar, e não passar (`R-NUM-08`).
CODIGO_MILHAR_OMISSO = "#,##0.##"
CODIGO_SIMPLES_OMISSO = "0.##"

# O formato fixo de antes da ESPEC 013 — igual, por coincidência, ao decimal de
# hoje. Continua nomeado **só** para que a T-802 possa medir o "antes".
CODIGO_LEGADO = "#,##0.00"

CODIGOS_CONHECIDOS = (
    CODIGO_MILHAR_INTEIRO,
    CODIGO_MILHAR_DECIMAL,
    CODIGO_SIMPLES_INTEIRO,
    CODIGO_SIMPLES_DECIMAL,
    CODIGO_MILHAR_OMISSO,
    CODIGO_SIMPLES_OMISSO,
)


def texto_exibido(valor: Decimal, codigo: str) -> str:
    """O que o Excel mostra para ``valor`` sob ``codigo``.

    Suporta os códigos de ``CODIGOS_CONHECIDOS`` e mais nada.

    A regra que este comparador errou na primeira versão, e que é a razão de ele
    existir: **no Excel o separador decimal é literal**. O ``#`` omite o
    *dígito* ausente, não a vírgula — sob ``0.##`` o valor ``10`` exibe ``10,``,
    que foi o defeito visto na planilha aberta. Modelar ``.##`` como "sem casa
    decimal alguma" fazia o instrumento repetir a suposição do código, e um
    instrumento que erra junto confirma o defeito em vez de acusá-lo.

    Daí os quatro códigos sem ``#`` depois do ponto: a decisão de haver ou não
    casa decimal é tomada por célula, no renderizador, e o Excel só executa.

    O arredondamento acompanha ``Quantity.formatar()`` de propósito: o que este
    comparador mede é o **formato**, não a política de arredondamento.
    """
    if codigo not in CODIGOS_CONHECIDOS:
        raise ValueError(f"código de formato fora do escopo do comparador: {codigo!r}")

    quantizado = valor.quantize(Decimal("0.01"))
    _, ponto, casas = codigo.partition(".")

    if not ponto:
        # Código sem parte decimal: o Excel **arredonda** a exibição para o
        # inteiro, não trunca. Não acontece com os valores que recebem este
        # código — só o recebem os que já são redondos —, mas um comparador que
        # trunca aqui erraria calado no dia em que acontecesse.
        inteiro = f"{abs(quantizado.quantize(Decimal('1'))):.0f}"
        return f"{_sinal(quantizado)}{_inteiro(inteiro, codigo)}"

    inteiro, _, decimal = f"{abs(quantizado):.2f}".partition(".")
    if casas == "##":
        # `#` omite o zero à direita — **e a vírgula fica**, mesmo sem dígito.
        decimal = decimal.rstrip("0")
        return f"{_sinal(quantizado)}{_inteiro(inteiro, codigo)},{decimal}"

    sinal, inteiro = _sinal(quantizado), _inteiro(inteiro, codigo)
    return f"{sinal}{inteiro},{decimal}" if decimal else f"{sinal}{inteiro}"


def _sinal(quantizado: Decimal) -> str:
    return "-" if quantizado < 0 else ""


def _inteiro(digitos: str, codigo: str) -> str:
    """Ponto de milhar só nos códigos que o pedem."""
    if not codigo.startswith("#,##0"):
        return digitos
    return f"{int(digitos):,}".replace(",", ".")


def _e_quantidade(titulo: object) -> bool:
    """Casa por **prefixo**, para valer nos dois arranjos.

    Antes da ESPEC 013 a coluna numérica se chama ``Contratado (nº)``; depois,
    ``Contratado``. Casar por prefixo é o que permite a este comparador medir o
    "antes" e o "depois" sem ter duas versões de si mesmo — e um comparador com
    duas versões não compara coisa nenhuma.
    """
    return isinstance(titulo, str) and titulo.startswith(CABECALHOS_DE_QUANTIDADE)


def _grandeza(titulo: str) -> str:
    """``Contratado (nº)`` e ``Contratado`` são a mesma grandeza."""
    return next(c for c in CABECALHOS_DE_QUANTIDADE if titulo.startswith(c))


@dataclass(frozen=True)
class Divergencia:
    """Uma célula cuja grafia não é a do relatório."""

    codigo_do_item: str
    coluna: str
    esperado: str
    obtido: str

    def __str__(self) -> str:
        return (
            f"{self.codigo_do_item} · {self.coluna}: "
            f"relatório grafa {self.esperado!r}, planilha exibiria {self.obtido!r}"
        )


def divergencias_de_grafia(arquivo: Path, analise: AnaliseDaMedicao) -> list[Divergencia]:
    """Lista **nomeada** das células cuja exibição difere do relatório.

    Nunca um booleano: diferença sem nome não orienta correção — é a mesma
    exigência da T-504 do PLANO 009.
    """
    esperado = {
        str(item.linha.codigo): {
            "Contratado": item.linha.contratada.formatar(),
            "Medido": item.linha.medida.formatar(),
            "Saldo": item.linha.saldo.formatar(),
        }
        for situacao in analise.situacoes
        for item in situacao.itens
    }

    achadas: list[Divergencia] = []
    livro = openpyxl.load_workbook(arquivo)
    try:
        for aba in ABA_DA_CLASSIFICACAO.values():
            planilha = livro[aba]
            cabecalho = [c.value for c in planilha[PRIMEIRA_LINHA_DE_DADO - 1]]

            for linha in planilha.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO):
                codigo_do_item = linha[0].value
                if codigo_do_item is None:
                    continue

                for celula, titulo in zip(linha, cabecalho, strict=False):
                    if not _e_quantidade(titulo):
                        continue
                    # No arranjo anterior à ESPEC 013 a mesma grandeza aparece
                    # duas vezes — texto e número. A de texto não tem formato a
                    # medir, e é o tipo que a distingue.
                    if not isinstance(celula.value, int | float | Decimal):
                        continue

                    grandeza = _grandeza(titulo)
                    obtido = texto_exibido(Decimal(str(celula.value)), celula.number_format)
                    devido = esperado[str(codigo_do_item)][grandeza]
                    if obtido != devido:
                        achadas.append(
                            Divergencia(str(codigo_do_item), grandeza, devido, obtido)
                        )
    finally:
        livro.close()

    return achadas
