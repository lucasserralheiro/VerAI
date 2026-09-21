"""T-24 a T-28 — Leitor da aba `Levantamento`.

Só esta aba é consumida; as demais 19 são o detalhamento que a sustenta e não
entram no MVP (ESPEC 001 §4.2).

O layout das colunas **varia entre blocos**: em uns o código está na coluna B,
em outros na C. Por isso o código é localizado por padrão em qualquer coluna da
linha, nunca por posição fixa — no arquivo-piloto são 40 linhas de um jeito e
34 do outro.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from domain.entities.measurement import DiagnosticoDaAba, Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.errors import ExtractionError
from domain.value_objects.service_code import PADRAO_EM_TEXTO, ServiceCode
from infrastructure.shared.arquivos import abrir_planilha

ABA = "Levantamento"

COL_DESCRICAO = 0
# A "Quantidade Contratada" da planilha não alimenta o relatório — a fonte da
# verdade é o contrato (ESPEC 001 §4.2). É lida apenas para a V-REC-01
# confrontar as duas fontes.
COL_CONTRATADA = 3
COL_MEDIDA = 4
COLUNAS_LIDAS = 5

_CABECALHOS = {"tipo", "unidade*"}
_DATA = re.compile(r"Data do Levantamento\s*:\s*(\d{2}/\d{2}/\d{4})")
_CONTRATO = re.compile(r"conforme contrato\s*:\s*(.+?)\s*$")


def _texto(valor: object) -> str:
    """Normaliza a célula para texto no padrão pt-BR.

    O openpyxl devolve células numéricas como ``int``/``float``, cuja
    representação usa **ponto** decimal. Repassá-la crua faria o conversor
    pt-BR ler ``762.55`` como 76.255, tratando o ponto como separador de
    milhar — um erro de duas ordens de grandeza que passaria despercebido.
    """
    if valor is None:
        return ""
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y")
    if isinstance(valor, bool):
        return str(valor)
    if isinstance(valor, int | float | Decimal):
        return str(valor).replace(".", ",")
    return str(valor).strip()


class LevantamentoReader:
    def ler(self, caminho: Path) -> Measurement:
        livro = abrir_planilha(caminho, "medição")
        try:
            if ABA not in livro.sheetnames:
                raise ExtractionError(
                    f"planilha sem a aba '{ABA}' — verifique se o arquivo é o levantamento"
                )
            linhas = [
                [_texto(v) for v in linha[:COLUNAS_LIDAS]]
                for linha in livro[ABA].iter_rows(values_only=True)
            ]

            medicao = Measurement()
            self._ler_cabecalho(linhas, medicao)
            self._ler_itens(linhas, medicao)

            # ESPEC 027 `R-LEV-06` — só quando a leitura falha: no caminho
            # feliz este `if` não entra, e o custo é zero. A releitura é sobre
            # a **mesma** aba, ainda aberta — o modo somente-leitura do
            # openpyxl reabre o fluxo XML a cada `iter_rows()`, sem reabrir o
            # arquivo (verificado).
            if not medicao.itens:
                medicao.diagnostico = self._diagnosticar(livro[ABA])
        finally:
            livro.close()

        return medicao

    def identificar(self, caminho: Path) -> Measurement:
        """T-2096 / ESPEC 029 `D-10` — o cabeçalho da aba, em 0,08 s.

        Devolve um `Measurement` **só com o cabeçalho** — título, data e
        contrato de referência —, lendo **dez linhas** em vez das ~1.900 da
        aba inteira. É o lado da planilha do portão de `R-IDT-10`.

        `ler` fica intocada. As duas compartilham `_ler_cabecalho`, e é o que
        garante que o portão e a validação de dentro do fluxo leiam o mesmo
        campo do mesmo jeito.
        """
        livro = abrir_planilha(caminho, "medição")
        try:
            if ABA not in livro.sheetnames:
                raise ExtractionError(
                    f"planilha sem a aba '{ABA}' — verifique se o arquivo é o levantamento"
                )
            linhas = [
                [_texto(v) for v in linha[:COLUNAS_LIDAS]]
                for linha in livro[ABA].iter_rows(max_row=10, values_only=True)
            ]
            medicao = Measurement()
            self._ler_cabecalho(linhas, medicao)
        finally:
            livro.close()

        return medicao

    # ── Diagnóstico, quando a leitura falha (ESPEC 027) ──────────────────────

    def _diagnosticar(self, aba: object) -> DiagnosticoDaAba:
        """T-2039 — a linha **inteira**, não recortada em `COLUNAS_LIDAS`.

        O critério de código é **o mesmo do leitor**: `fullmatch`, não
        `search`. Usar `search` contaria como código o que `_codigo` rejeita,
        e a mensagem apontaria uma coluna que não resolveria nada.
        """
        linhas_preenchidas = 0
        codigos_por_coluna: dict[int, int] = {}

        for linha in aba.iter_rows(values_only=True):  # type: ignore[attr-defined]
            celulas = [_texto(v) for v in linha]
            if any(celulas):
                linhas_preenchidas += 1
            for indice, texto in enumerate(celulas, start=1):
                if PADRAO_EM_TEXTO.fullmatch(texto.strip()):
                    codigos_por_coluna[indice] = codigos_por_coluna.get(indice, 0) + 1

        return DiagnosticoDaAba(
            linhas_preenchidas=linhas_preenchidas,
            colunas_lidas=COLUNAS_LIDAS,
            codigos_por_coluna=codigos_por_coluna,
        )

    # ── Cabeçalho (T-28) ──────────────────────────────────────────────────────

    def _ler_cabecalho(self, linhas: list[list[str]], medicao: Measurement) -> None:
        if linhas and linhas[0][COL_DESCRICAO]:
            medicao.titulo = linhas[0][COL_DESCRICAO]

        for celulas in linhas[:10]:
            texto = " ".join(celulas)
            if (achado := _DATA.search(texto)) and medicao.data_levantamento is None:
                medicao.data_levantamento = self._data(achado.group(1))
            achado = _CONTRATO.search(celulas[COL_DESCRICAO])
            if achado and not medicao.contrato_referencia:
                medicao.contrato_referencia = achado.group(1).strip()

    def _data(self, texto: str) -> date | None:
        try:
            return datetime.strptime(texto, "%d/%m/%Y").date()
        except ValueError:
            return None

    # ── Itens (T-24 a T-27) ───────────────────────────────────────────────────

    def _ler_itens(self, linhas: list[list[str]], medicao: Measurement) -> None:
        bloco = ""

        for numero, celulas in enumerate(linhas, start=1):
            if not any(celulas):
                continue

            codigo = self._codigo(celulas)
            if codigo is None:
                if self._e_titulo_de_bloco(celulas):
                    bloco = celulas[COL_DESCRICAO]
                continue

            medicao.itens.append(
                MeasurementItem(
                    codigo=codigo,
                    descricao=celulas[COL_DESCRICAO],
                    bloco_titulo=bloco,
                    # Texto bruto preservado: `PACOTE` e `Perfil D` precisam
                    # chegar íntegros à reconciliação (ESPEC 001 R-REC-04).
                    medida_texto=celulas[COL_MEDIDA],
                    linha=numero,
                    contratada_texto=celulas[COL_CONTRATADA],
                )
            )

    def _codigo(self, celulas: list[str]) -> ServiceCode | None:
        """T-25 — localiza o código em qualquer coluna da linha."""
        for celula in celulas:
            if PADRAO_EM_TEXTO.fullmatch(celula.strip()):
                return ServiceCode(celula.strip())
        return None

    def _e_titulo_de_bloco(self, celulas: list[str]) -> bool:
        """Faixa de bloco: todas as células preenchidas carregam o mesmo texto.

        `T-1202` / `R-REL-11` — duas formas ocorrem nos arquivos reais, e a
        regra cobre as duas:

        * **coluna única** — título na primeira coluna e o resto vazio, como no
          levantamento do SMIT;
        * **célula mesclada** — o mesmo texto repetido em todas as colunas, como
          no levantamento do PGM.

        O crivo anterior exigia *"texto só na primeira coluna"* e rejeitava a
        forma mesclada. A rejeição não era visível em lugar nenhum: sem faixa
        não há ``bloco_titulo``, e a ``R-MED-02`` ficava sem a marca de
        "descontando desenvolvimento" — **0 de 37 faixas reconhecidas no PGM**,
        com os oito códigos repetidos caindo no atalho *"vale a última lida"*
        (ESPEC 018 §2.8).

        As linhas de cabeçalho ("Tipo | Código | ...") e as de total
        ("TOTAL | | | | 2") caem fora por terem valores **distintos**; a de
        cabeçalho mesclada, pelo ``_CABECALHOS``.
        """
        valores = {c.strip() for c in celulas if c.strip()}
        if len(valores) != 1 or not celulas[COL_DESCRICAO].strip():
            return False
        return valores.pop().lower() not in _CABECALHOS
