"""T-301 — Leitor genérico de aba (ESPEC 004 `R-ANX-05` a `R-ANX-07`).

Lê **forma, não significado**. Devolve todas as linhas e todas as colunas de uma
aba com o que a torna reconhecível na página — valor, negrito, preenchimento,
cor da fonte, borda e mesclagens — sem conhecer nenhuma delas.

É a peça que faz um anexo novo não exigir código: as 19 abas têm de 3 a 22
colunas e nenhuma semântica em comum, e o único jeito de atendê-las com um
leitor só é ele não saber o que está lendo.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from domain.entities.annex import CelulaAnexo, Mesclagem

# Largura de coluna do Excel quando a aba não a declara. As abas só gravam a
# largura das colunas que o usuário ajustou; as demais herdam este padrão, e
# ignorá-lo faria colunas inteiras saírem com proporção zero.
LARGURA_PADRAO = 9.09

# Preenchimento branco não é desenhado: é a cor do papel, e emitir um `w:shd`
# por célula custaria dezenas de milhares de elementos sem nenhum efeito visual.
BRANCO = "FFFFFF"

# ESPEC 047 — nomes de mês em português: os outros 18 anexos já usam esse
# idioma, e o projeto não depende de `locale` do sistema em nenhum outro ponto.
_MESES_ABREVIADOS = (
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
)  # fmt: skip
_MESES_COMPLETOS = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)  # fmt: skip

# Tokens de data do `number_format` do Excel — sempre em inglês no XML por
# trás, mesmo quando o Excel exibe o editor de formato em português. Ordem do
# mais longo para o mais curto, para `mmmm` não ser lido como `mmm` + `m`.
_TOKEN_DE_DATA = re.compile(
    r'"[^"]*"|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d', re.IGNORECASE
)


@dataclass(frozen=True)
class FormaDaAba:
    linhas: tuple[tuple[CelulaAnexo, ...], ...]
    mesclagens: tuple[Mesclagem, ...]
    proporcoes: tuple[float, ...]


class AbaReader:
    def ler(self, aba: Any) -> FormaDaAba:
        total_linhas = aba.max_row or 0
        total_colunas = aba.max_column or 0
        if not total_linhas or not total_colunas:
            return FormaDaAba(linhas=(), mesclagens=(), proporcoes=())

        linhas = tuple(
            tuple(self._celula(aba.cell(linha, coluna)) for coluna in range(1, total_colunas + 1))
            for linha in range(1, total_linhas + 1)
        )
        total_colunas = self._colunas_uteis(linhas)
        linhas = tuple(linha[:total_colunas] for linha in linhas)

        return FormaDaAba(
            linhas=linhas,
            mesclagens=self._mesclagens(aba, total_colunas),
            proporcoes=self._proporcoes(aba, total_colunas),
        )

    @staticmethod
    def _colunas_uteis(linhas: tuple[tuple[CelulaAnexo, ...], ...]) -> int:
        """Descarta as colunas finais que não têm nada — nem texto, nem forma.

        O ``max_column`` do openpyxl conta toda coluna com **algum registro** no
        arquivo, inclusive as que só existem por um resquício de formatação. O
        Excel não as imprime, e o GRC confirma: a aba `Usuários` tem 15 colunas
        no arquivo e o relatório mostra **8**.

        Mantê-las espremia as oito reais em pouco mais da metade da largura.
        Só o fim da aba é aparado: uma coluna vazia no meio é parte do desenho
        da planilha e sai como está.

        **A borda não conta como conteúdo aqui**, e foi preciso medir para
        descobrir: as sete colunas sobrando de `Usuários` têm borda em uma única
        linha — a 1021, uma faixa mesclada e vazia no rodapé da aba. O Excel não
        as imprime, e usar a borda como sinal as manteria todas.
        """
        for coluna in range(len(linhas[0]) if linhas else 0, 0, -1):
            indice = coluna - 1
            if any(linha[indice].texto or linha[indice].preenchimento for linha in linhas):
                return coluna
        return 0

    # ── Célula ────────────────────────────────────────────────────────────────

    def _celula(self, celula: Any) -> CelulaAnexo:
        return CelulaAnexo(
            texto=self._texto(celula.value, celula.number_format),
            negrito=bool(celula.font and celula.font.bold),
            preenchimento=self._preenchimento(celula),
            cor=self._cor_da_fonte(celula),
            borda=self._tem_borda(celula),
            alinhamento=self._alinhamento(celula),
        )

    # ESPEC 052 — os três valores explícitos que as 22 abas do levantamento usam.
    # Qualquer outro (inclusive `None`, o "Geral" do Excel) cai no fallback por tipo.
    _ALINHAMENTOS_CONHECIDOS = frozenset({"left", "center", "right"})

    def _alinhamento(self, celula: Any) -> str:
        """`R-ALN-01` a `R-ALN-04` — o alinhamento explícito, ou o tipo decide.

        Sem alinhamento declarado, o Excel alinha número e data à direita e texto
        à esquerda automaticamente — é esse comportamento que o fallback reproduz,
        sobre o **valor original** da célula, antes de `_texto` converter tudo
        para `str`. `bool` é checado antes de `int`/`float` porque em Python é
        subclasse do primeiro: checar na ordem errada faria todo booleano sair
        `right`, não `center`.
        """
        horizontal = celula.alignment.horizontal if celula.alignment else None
        if isinstance(horizontal, str) and horizontal in self._ALINHAMENTOS_CONHECIDOS:
            return horizontal
        valor = celula.value
        if isinstance(valor, bool):
            return "center"
        if isinstance(valor, (int, float, Decimal, date, datetime)):
            return "right"
        return "left"

    def _texto(self, valor: object, formato: str | None = None) -> str:
        """Normaliza a célula para texto no padrão pt-BR.

        O openpyxl devolve números como ``int``/``float``, cuja representação
        usa **ponto** decimal — a mesma armadilha que fez ``762.55`` virar
        76.255 na leitura do levantamento. Aqui o texto vai direto para a
        página, então o separador precisa ser a vírgula desde a origem.
        """
        if valor is None:
            return ""
        if isinstance(valor, datetime):
            # Data com hora zerada é data: as abas guardam vencimento de
            # certificado e data de aceite como ``datetime`` à meia-noite, e
            # imprimir "00:00" em todas elas seria ruído.
            if valor.time() == time(0, 0):
                return self._data_sem_dia(valor, formato) or valor.strftime("%d/%m/%Y")
            return valor.strftime("%d/%m/%Y %H:%M")
        if isinstance(valor, date):
            return self._data_sem_dia(valor, formato) or valor.strftime("%d/%m/%Y")
        if isinstance(valor, bool):
            return "Sim" if valor else "Não"
        if isinstance(valor, int):
            return str(valor)
        if isinstance(valor, float):
            # `is_integer` evita "220,0" onde a planilha mostra "220". O `repr`
            # dá a representação mais curta que volta ao mesmo float, então
            # 18.261 sai "18,261" e não "18,260999999999999".
            return str(int(valor)) if valor.is_integer() else repr(valor).replace(".", ",")
        if isinstance(valor, Decimal):
            return str(valor).replace(".", ",")
        return str(valor).strip()

    @staticmethod
    def _data_sem_dia(valor: date, formato: str | None) -> str | None:
        """ESPEC 047 `R-DAT-01` a `R-DAT-03` — datas cujo formato do Excel não tem dia.

        `DATA VALIDADE` e afins sempre saem `dd/mm/aaaa` (`R-DAT-03`), mas colunas
        como a de alerta de renovação em `CertificadosDigitais` guardam a mesma
        data com o formato `mmm/aa` — a planilha nunca mostrou o dia, e forçar
        `dd/mm/aaaa` inventaria um dia 1º que não está lá. Vale só quando o
        formato **não** tem token de dia; do contrário devolve `None`, e quem
        chama cai no padrão fixo de sempre.
        """
        if not formato:
            return None
        corpo = re.sub(r"\[[^\]]*\]", "", formato.split(";", 1)[0])
        sem_literais = re.sub(r'"[^"]*"', "", corpo).lower()
        if "d" in sem_literais or not re.search(r"[my]", sem_literais):
            return None

        def _trocar(match: re.Match[str]) -> str:
            token = match.group(0)
            if token.startswith('"'):
                return token[1:-1]
            token_min = token.lower()
            if token_min == "yyyy":
                return f"{valor.year:04d}"
            if token_min == "yy":
                return f"{valor.year % 100:02d}"
            if token_min == "mmmm":
                return _MESES_COMPLETOS[valor.month - 1]
            if token_min == "mmm":
                return _MESES_ABREVIADOS[valor.month - 1]
            if token_min == "mm":
                return f"{valor.month:02d}"
            return str(valor.month)

        return _TOKEN_DE_DATA.sub(_trocar, corpo)

    def _preenchimento(self, celula: Any) -> str | None:
        cor = self._hexadecimal(celula.fill.start_color if celula.fill else None)
        if cor is None or not celula.fill or not celula.fill.patternType:
            return None
        return None if cor == BRANCO else cor

    def _cor_da_fonte(self, celula: Any) -> str | None:
        cor = self._hexadecimal(celula.font.color if celula.font else None)
        # Preto é o padrão do documento; declará-lo por célula não muda nada.
        return None if cor in (None, "000000") else cor

    @staticmethod
    def _hexadecimal(cor: Any) -> str | None:
        """Só cores RGB explícitas.

        Cores de tema e indexadas dependem da paleta do arquivo para virar RGB.
        Nenhuma aba deste levantamento as usa nas células que importam, e
        resolvê-las por aproximação produziria cor errada em silêncio — pior do
        que não pintar.
        """
        if cor is None or getattr(cor, "type", None) != "rgb":
            return None
        rgb = cor.rgb
        if not isinstance(rgb, str) or len(rgb) < 6:
            return None
        return rgb[-6:].upper()

    @staticmethod
    def _tem_borda(celula: Any) -> bool:
        borda = celula.border
        if borda is None:
            return False
        return any(
            lado is not None and lado.style
            for lado in (borda.left, borda.right, borda.top, borda.bottom)
        )

    # ── Aba ───────────────────────────────────────────────────────────────────

    @staticmethod
    def _mesclagens(aba: Any, total_colunas: int) -> tuple[Mesclagem, ...]:
        faixas = (
            Mesclagem(
                linha=faixa.min_row - 1,
                coluna=faixa.min_col - 1,
                ate_linha=faixa.max_row - 1,
                # Limitada à última coluna útil. Uma faixa que ia até a coluna
                # aparada seria descartada inteira, e o título de `Usuários` —
                # mesclado até a 15ª — deixaria de ocupar a linha.
                ate_coluna=min(faixa.max_col - 1, total_colunas - 1),
            )
            for faixa in aba.merged_cells.ranges
            if faixa.min_col - 1 < total_colunas
        )
        # Ordenar dá saída estável: o openpyxl guarda as faixas num conjunto,
        # cuja ordem varia entre execuções e quebraria `R-DOC-10`.
        return tuple(sorted(faixas, key=lambda m: (m.linha, m.coluna)))

    @staticmethod
    def _proporcoes(aba: Any, total_colunas: int) -> tuple[float, ...]:
        from openpyxl.utils import get_column_letter

        padrao = aba.sheet_format.defaultColWidth or LARGURA_PADRAO
        larguras = []
        for coluna in range(1, total_colunas + 1):
            dimensao = aba.column_dimensions.get(get_column_letter(coluna))
            largura = dimensao.width if dimensao and dimensao.width else padrao
            larguras.append(float(largura))
        return tuple(larguras)
