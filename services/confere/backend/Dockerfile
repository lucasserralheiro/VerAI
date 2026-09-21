FROM python:3.12-slim

# Sem .pyc e com saída sem buffer: logs aparecem na hora no docker logs.
# Os UV_* deixam a instalação reprodutível e amigável ao cache de camadas.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

# uv direto da imagem distroless da Astral — versão fixada, sem passo de curl.
COPY --from=ghcr.io/astral-sh/uv:0.10.11 /uv /uvx /bin/

WORKDIR /app

# As dependências são todas Python puro (pdfplumber, openpyxl, reportlab), então
# não há pacote de sistema a instalar. Vale conferir isto ao acrescentar
# qualquer dependência nova: a imagem enxuta é uma escolha, não um acaso.

# Camada de dependências separada do código: alterar o fonte não reinstala nada.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

ENV PATH="/app/.venv/bin:${PATH}" \
    VIRTUAL_ENV=/app/.venv

COPY src/ ./src/

# Os imports são absolutos a partir de src/ — ver a convenção no README.
# Aqui o PYTHONPATH é aceitável, e no desenvolvimento local não era: a variável
# é fixada na imagem, sem shell nem herança de processo no meio. Instalar o
# próprio projeto exigiria copiar `src/` antes do `uv sync`, e com isso qualquer
# alteração de código invalidaria a camada de dependências.
ENV PYTHONPATH=/app/src

# Usuário sem privilégio. O serviço não escreve em disco: os uploads vivem em
# diretório temporário e o PDF é devolvido em memória.
RUN useradd --system --create-home --uid 1001 aplicacao \
    && chown -R aplicacao:aplicacao /app
USER aplicacao

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request as r; r.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
