"""Diagnóstico da extração da tabela de itens do contrato.

Quando o processamento é bloqueado por ``V-CTR-01`` (tabela não localizada), a
aplicação não diz *por quê*: ``montar_grade()`` devolve ``None`` e o extrator
apenas segue para a próxima página. Este script reconstrói, passo a passo, a
mesma decisão que a grade toma — e mostra em qual dos filtros a página caiu.

Uso::

    python scripts/diagnostico_grade_contrato.py caminho/do/contrato.pdf

Rode-o primeiro contra ``backend/tests/fixtures/contrato.pdf`` para ver a
assinatura de um contrato que funciona, e depois contra o arquivo que falhou:
o diagnóstico está na diferença entre os dois.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend" / "src"))

import pdfplumber  # noqa: E402

from infrastructure.contract.grid import (  # noqa: E402
    COLUNAS_DA_TABELA,
    COMPRIMENTO_MINIMO_HORIZONTAL,
    COMPRIMENTO_MINIMO_VERTICAL,
    ESPESSURA_MAXIMA_DO_TRACO,
    TOLERANCIA,
    derivar_gabarito,
    montar_grade,
)

_CODIGO = re.compile(r"\b\d{2}\.\d{3}\.\d{5}\.\d{2}\b")
_CABECALHO = ("CÓDIGO", "DESCRIÇÃO", "UNIDADE", "PREÇO", "QTDE", "MESES", "TOTAL")

# O gabarito do piloto em proporção do próprio vão. Se um contrato usar o mesmo
# template em outra margem ou outra escala, os valores absolutos mudam mas estes
# não — é o que separa "template diferente" de "mesmo template deslocado".
_VAO_DO_PILOTO = COLUNAS_DA_TABELA[-1] - COLUNAS_DA_TABELA[0]
GABARITO_RELATIVO = tuple(
    (c - COLUNAS_DA_TABELA[0]) / _VAO_DO_PILOTO for c in COLUNAS_DA_TABELA
)


@dataclass
class Pagina:
    numero: int
    largura: float
    altura: float
    rotacao: int
    rects: int
    lines: int
    curves: int
    palavras: int
    verticais_brutas: list[float] = field(default_factory=list)
    verticais_aceitas: list[float] = field(default_factory=list)
    verticais_de_lines: list[float] = field(default_factory=list)
    horizontais: int = 0
    horizontais_de_lines: int = 0
    codigos_no_texto: int = 0
    cabecalho: list[str] = field(default_factory=list)
    grade_ok: bool = False

    @property
    def parece_da_tabela(self) -> bool:
        """A página traz itens do contrato, tenha a grade sido montada ou não."""
        return self.codigos_no_texto > 0

    @property
    def deveria_ter_grade(self) -> bool:
        """Página com item **e** com moldura desenhada: se não gerou grade, perdeu linha.

        A capa e o sumário citam códigos sem serem a tabela — não têm borda
        nenhuma e sair sem grade é o certo. O que não pode acontecer é uma
        página desenhada como tabela, com itens, ficar de fora.
        """
        return self.parece_da_tabela and (self.rects > 0 or self.lines + self.curves > 0)


def _verticais(pagina: Any) -> list[float]:
    """Candidatas a divisória de coluna — o filtro de ``_fronteiras_verticais``
    **sem** a comparação com ``COLUNAS_DA_TABELA``, que é o que se quer medir."""
    return sorted(
        {
            round(r["x0"], 1)
            for r in pagina.rects
            if r["width"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["height"] > COMPRIMENTO_MINIMO_VERTICAL
        }
    )


def _horizontais(pagina: Any) -> list[float]:
    return sorted(
        {
            round(r["top"], 1)
            for r in pagina.rects
            if r["height"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["width"] > COMPRIMENTO_MINIMO_HORIZONTAL
        }
    )


def _de_lines(pagina: Any, vertical: bool) -> list[float]:
    """As mesmas fronteiras, mas a partir de ``lines``/``curves``.

    Alguns geradores de PDF desenham a moldura como traço vetorial em vez de
    retângulo fino preenchido. O produto só olha ``rects``, então nesse caso a
    tabela existe e é invisível para ele.
    """
    achadas: set[float] = set()
    for objeto in [*pagina.lines, *pagina.curves]:
        largura = abs(objeto["x1"] - objeto["x0"])
        altura = abs(objeto["y1"] - objeto["y0"])
        fina = (largura if vertical else altura) < ESPESSURA_MAXIMA_DO_TRACO
        comprida = (altura if vertical else largura) > (
            COMPRIMENTO_MINIMO_VERTICAL if vertical else COMPRIMENTO_MINIMO_HORIZONTAL
        )
        if fina and comprida:
            achadas.add(round(objeto["x0" if vertical else "top"], 1))
    return sorted(achadas)


def _aceitas(brutas: list[float]) -> list[float]:
    return [x for x in brutas if any(abs(x - c) < TOLERANCIA for c in COLUNAS_DA_TABELA)]


def _cabecalho_presente(pagina: Any) -> list[str]:
    texto = (pagina.extract_text() or "").upper()
    return [rotulo for rotulo in _CABECALHO if rotulo in texto]


def _casa_por_proporcao(brutas: list[float]) -> tuple[float, float] | None:
    """Procura um vão cujas divisórias reproduzam o gabarito em proporção.

    Devolve ``(esquerda, direita)`` do vão que casou, ou ``None``. É a prova de
    que o PDF usa o mesmo template do piloto, apenas deslocado ou reescalado —
    o caso que uma tolerância relativa resolveria e a absoluta de 1,5 pt não.
    """
    for i, esquerda in enumerate(brutas):
        for direita in brutas[i + 1 :]:
            vao = direita - esquerda
            if vao < 200:  # vão pequeno demais para ser a tabela de itens
                continue
            if all(
                any(abs((x - esquerda) / vao - alvo) < 0.02 for x in brutas)
                for alvo in GABARITO_RELATIVO
            ):
                return (esquerda, direita)
    return None


def _desvio_relativo(brutas: list[float], vao: tuple[float, float]) -> float:
    """Pior desvio entre o gabarito e as divisórias reais, em fração do vão.

    Mede a folga que sobra na tolerância: um desvio de 0,0149 contra tolerância
    de 0,02 casa, mas casa por pouco — e isso é informação de projeto, não
    detalhe. Uma tolerância calibrada em cima do único par de contratos que
    temos é uma constante nova esperando para quebrar, como a de hoje quebrou.
    """
    esquerda, largura = vao[0], vao[1] - vao[0]
    return max(
        min(abs((x - esquerda) / largura - alvo) for x in brutas)
        for alvo in GABARITO_RELATIVO
    )


def inspecionar(caminho: Path) -> tuple[list[Pagina], tuple[float, ...] | None]:
    """Devolve o retrato de cada página e o gabarito que o extrator derivaria.

    O gabarito passou a ser derivado do documento (ESPEC 017), e é a informação
    que faltava aqui: sabendo qual geometria o extrator escolheu, o veredito
    deixa de ser inferência e passa a ser leitura.
    """
    paginas: list[Pagina] = []
    with pdfplumber.open(caminho) as pdf:
        gabarito = derivar_gabarito(pdf)
        for numero, pagina in enumerate(pdf.pages, start=1):
            brutas = _verticais(pagina)
            registro = Pagina(
                numero=numero,
                largura=round(pagina.width, 1),
                altura=round(pagina.height, 1),
                rotacao=pagina.rotation or 0,
                rects=len(pagina.rects),
                lines=len(pagina.lines),
                curves=len(pagina.curves),
                palavras=len(pagina.extract_words()),
                verticais_brutas=brutas,
                verticais_aceitas=_aceitas(brutas),
                verticais_de_lines=_de_lines(pagina, vertical=True),
                horizontais=len(_horizontais(pagina)),
                horizontais_de_lines=len(_de_lines(pagina, vertical=False)),
                codigos_no_texto=len(set(_CODIGO.findall(pagina.extract_text() or ""))),
                cabecalho=_cabecalho_presente(pagina),
                grade_ok=(
                    gabarito is not None and montar_grade(pagina, gabarito) is not None
                ),
            )
            paginas.append(registro)
    return paginas, gabarito


# ── Apresentação ──────────────────────────────────────────────────────────────


def _tabela(paginas: list[Pagina]) -> None:
    interessantes = [p for p in paginas if p.parece_da_tabela or p.grade_ok]
    if not interessantes:
        print("  nenhuma página com código de serviço no texto.")
        interessantes = paginas[:5]
        print("  (mostrando as 5 primeiras)\n")

    cabecalho = (
        f"  {'pág':>4} {'rects':>6} {'lines':>6} {'palav':>6} {'vert':>5} "
        f"{'aceit':>6} {'horiz':>6} {'cods':>5}  grade"
    )
    print(cabecalho)
    print("  " + "─" * (len(cabecalho) - 2))
    for p in interessantes:
        print(
            f"  {p.numero:>4} {p.rects:>6} {p.lines + p.curves:>6} {p.palavras:>6} "
            f"{len(p.verticais_brutas):>5} {len(p.verticais_aceitas):>6} "
            f"{p.horizontais:>6} {p.codigos_no_texto:>5}  {'OK' if p.grade_ok else '— None'}"
        )


def _veredito(paginas: list[Pagina], gabarito: tuple[float, ...] | None) -> None:
    com_codigos = [p for p in paginas if p.parece_da_tabela]
    com_grade = [p for p in paginas if p.grade_ok]

    print(f"\n  páginas ................. {len(paginas)}")
    print(f"  páginas com códigos ..... {len(com_codigos)}")
    print(f"  páginas com grade ....... {len(com_grade)}")

    if com_grade:
        print("\n  ✓ A grade foi montada. V-CTR-01 não vem da detecção da grade.")
        # Página perdida é a que **contém o gabarito escolhido** e mesmo assim
        # não produziu grade. "Tem código e tem borda" não basta: o PA-PGM traz
        # nas páginas 31 e 32 outra tabela, com códigos e moldura próprias, e
        # sinalizá-la seria gritar lobo — o checksum daquele contrato fecha em
        # 0,00, provando que nada da tabela de itens se perdeu.
        perdidas = sorted(
            p.numero
            for p in paginas
            if not p.grade_ok
            and gabarito is not None
            and set(gabarito).issubset(p.verticais_brutas)
        )
        if perdidas:
            print(f"    ATENÇÃO: página que contém o gabarito e não produziu grade: {perdidas}")
            print("             extração parcial — é o caso que faz o checksum divergir.")
        return

    print("\n  ✗ Nenhuma página produziu grade. Causa provável:")

    sem_texto = all(p.palavras == 0 for p in paginas)
    if sem_texto:
        print("    [H3] PDF digitalizado ou sem camada de texto — nenhuma palavra")
        print("         extraível. Nem a grade nem o texto existem: exige OCR ou o")
        print("         PDF original. Fora do alcance de qualquer ajuste no extrator.")
        return

    if not com_codigos:
        print("    [H4] Nenhum código de serviço no texto de nenhuma página.")
        print("         O arquivo provavelmente não é a proposta comercial completa")
        print("         — é o que a mensagem de V-CTR-01 já sugere ao usuário.")
        return

    # A página de referência NÃO é a de mais divisórias: um contrato traz outras
    # tabelas — cronograma, quadro de totais — e algumas são mais subdivididas
    # que a de itens. Escolher pelo máximo de verticais escolhe a tabela errada.
    # O casamento por proporção é testado em TODAS as páginas candidatas; basta
    # uma casar para o veredito ser "mesmo template".
    candidatas = [p for p in com_codigos if p.verticais_brutas] or com_codigos
    casadas = [(p, _casa_por_proporcao(p.verticais_brutas)) for p in candidatas]
    casadas = [(p, vao) for p, vao in casadas if vao is not None]

    referencia = max(candidatas, key=lambda p: p.codigos_no_texto)

    if referencia.rects == 0 and (referencia.lines + referencia.curves) > 0:
        print("    [H2] A página não tem `rects`, mas tem `lines`/`curves`:")
        print(f"         {len(referencia.verticais_de_lines)} verticais e "
              f"{referencia.horizontais_de_lines} horizontais estão lá, como traço vetorial.")
        print("         A moldura existe; o extrator só não olha onde ela está.")
        print("         → resolvido pela camada 3a (aceitar lines/curves).")
        return

    if not referencia.verticais_brutas:
        print("    [H2/H3] Há texto, mas nenhuma divisória vertical detectável em")
        print("            nenhuma forma. A tabela não é desenhada com bordas.")
        print("            → só a camada 3c (âncora pelo cabeçalho) alcança este caso.")
        return

    if casadas:
        referencia, vao = max(casadas, key=lambda par: par[0].codigos_no_texto)
        paginas_casadas = sorted(p.numero for p, _ in casadas)
        print(f"    [H1/H5] MESMO TEMPLATE, DESLOCADO. Na página {referencia.numero} as")
        print("            divisórias reproduzem o gabarito do piloto no vão")
        print(f"            {vao[0]:.1f}–{vao[1]:.1f} pt, mas em posição absoluta diferente:")
        print(f"            o piloto espera {COLUNAS_DA_TABELA[0]}–{COLUNAS_DA_TABELA[-1]} pt.")
        print(f"            Deslocamento de {vao[0] - COLUNAS_DA_TABELA[0]:+.1f} pt,")
        print(f"            escala {vao[1] - vao[0]:.1f}/{_VAO_DO_PILOTO:.1f} = "
              f"{(vao[1] - vao[0]) / _VAO_DO_PILOTO:.4f}.")
        print(f"            Páginas que casam: {paginas_casadas}")
        desvio = _desvio_relativo(referencia.verticais_brutas, vao)
        print(f"            Desvio relativo máximo: {desvio:.4f} (tolerância 0.0200 — "
              f"margem de {(0.02 - desvio) / 0.02:.0%}).")
        print("            → resolvido pela camada 3b (casar por proporção).")
    else:
        print(f"    [H1] Template diferente. A página {referencia.numero} tem")
        print(f"         {len(referencia.verticais_brutas)} divisórias, das quais "
              f"{len(referencia.verticais_aceitas)} caem na tolerância de {TOLERANCIA} pt,")
        print("         e a proporção entre elas não reproduz o gabarito do piloto.")
        print("         As larguras de coluna mudaram de verdade.")
        print("         → exige a camada 3c (âncora pelo texto do cabeçalho).")
        if referencia.cabecalho:
            print(f"         Cabeçalho localizável: {', '.join(referencia.cabecalho)}")
        else:
            print("         ATENÇÃO: nem o cabeçalho da tabela foi localizado no texto.")

    print(f"\n    Verticais brutas da página {referencia.numero}:")
    print(f"      {referencia.verticais_brutas}")
    print("    Gabarito esperado (COLUNAS_DA_TABELA):")
    print(f"      {list(COLUNAS_DA_TABELA)}")


def main() -> int:
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument("pdf", type=Path, help="contrato a diagnosticar")
    argumentos = analisador.parse_args()

    if not argumentos.pdf.exists():
        print(f"arquivo não encontrado: {argumentos.pdf}", file=sys.stderr)
        return 2

    print(f"\n╭─ Diagnóstico da grade ─ {argumentos.pdf.name}")
    paginas, gabarito = inspecionar(argumentos.pdf)

    formatos = {(p.largura, p.altura, p.rotacao) for p in paginas}
    descricao = ", ".join(
        f"{largura}×{altura} rot={rot}" for largura, altura, rot in sorted(formatos)
    )
    print(f"│  formato: {descricao}")
    if gabarito is None:
        print("│  gabarito derivado: NENHUM — nenhuma página tem oito divisórias")
    else:
        canonico = gabarito == COLUNAS_DA_TABELA
        print(f"│  gabarito derivado: {list(gabarito)}")
        print(f"│  {'igual ao de referência' if canonico else 'DIFERENTE do de referência'}"
              f" — vão {gabarito[-1] - gabarito[0]:.1f} pt")
    print("╰─")
    print()

    _tabela(paginas)
    _veredito(paginas, gabarito)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
