"""T-54 — Recepção de arquivos enviados.

Tipo verificado por **assinatura**, não por extensão: renomear um ZIP para
`.pdf` é trivial, e o erro só apareceria lá dentro do extrator, como uma falha
obscura em vez de uma mensagem clara.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

TAMANHO_MAXIMO = 40 * 1024 * 1024  # 40 MB — o contrato-piloto tem 0,8 MB
PEDACO = 1024 * 1024

ASSINATURA_PDF = b"%PDF-"
ASSINATURA_ZIP = b"PK\x03\x04"  # XLSX é um contêiner ZIP

_ASSINATURAS = {"pdf": (ASSINATURA_PDF,), "xlsx": (ASSINATURA_ZIP,)}


async def gravar(arquivo: UploadFile, destino: Path, formato: str, campo: str) -> Path:
    """Grava o upload em disco, conferindo tamanho e assinatura."""
    esperadas = _ASSINATURAS[formato]
    caminho = destino / f"{campo}.{formato}"
    total = 0

    await arquivo.seek(0)
    cabecalho = await arquivo.read(8)
    if not any(cabecalho.startswith(a) for a in esperadas):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{campo}' não é um arquivo {formato.upper()} válido — "
            "a assinatura do arquivo não confere com a extensão",
        )

    await arquivo.seek(0)
    with caminho.open("wb") as saida:
        while pedaco := await arquivo.read(PEDACO):
            total += len(pedaco)
            if total > TAMANHO_MAXIMO:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"'{campo}' excede o limite de {TAMANHO_MAXIMO // (1024 * 1024)} MB",
                )
            saida.write(pedaco)

    return caminho
