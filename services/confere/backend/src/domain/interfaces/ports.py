"""T-12 — Ports.

Contratos que o domínio declara e a infraestrutura implementa. Nenhum menciona
``pdfplumber``, ``openpyxl`` ou ``python-docx``: é o que permite testar as regras
com dublês e trocar a estratégia de extração ou de renderização sem tocar no
núcleo. Foi o que permitiu substituir o PDF pelo DOCX (ESPEC 003) sem alterar
uma linha de domínio, aplicação ou validação.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Protocol, runtime_checkable

from domain.entities.analysis import AnaliseDaMedicao
from domain.entities.annex import Anexo
from domain.entities.contract_item import ContractItem
from domain.entities.measurement_item import MeasurementItem
from domain.entities.report import Report
from domain.entities.validation_finding import ValidationReport


class Contract(Protocol):
    """Resultado da extração do contrato."""

    itens: list[ContractItem]
    proposta: str
    total_declarado: object


class Measurement(Protocol):
    """Resultado da leitura da planilha."""

    itens: list[MeasurementItem]
    data_levantamento: date
    contrato_referencia: str


@runtime_checkable
class IContractExtractor(Protocol):
    def extrair(self, caminho: Path) -> Contract: ...


@runtime_checkable
class IMeasurementReader(Protocol):
    def ler(self, caminho: Path) -> Measurement: ...


@runtime_checkable
@runtime_checkable
class IAnnexReader(Protocol):
    """ESPEC 004 — as abas de detalhamento que viram anexos do documento."""

    def ler(self, caminho: Path) -> list[Anexo]: ...


@runtime_checkable
class IReportRenderer(Protocol):
    def renderizar(self, relatorio: Report, destino: Path) -> Path: ...


@runtime_checkable
class IAnaliseRenderer(Protocol):
    """ESPEC 009 — o relatório de análise, em planilha.

    Port próprio, e não um segundo formato de `IReportRenderer`: o que sai daqui
    não é o relatório de comprovação em outro formato, é **outro documento**, com
    outro conteúdo e outro destinatário. Compartilhar o protocolo obrigaria um
    dos dois a receber um agregado que não usa.
    """

    def renderizar(self, analise: AnaliseDaMedicao, destino: Path) -> Path: ...


@runtime_checkable
class IValidation(Protocol):
    """Uma validação nomeada da ESPEC 001 §6."""

    identificador: str

    def executar(self, contexto: object, achados: ValidationReport) -> None: ...
