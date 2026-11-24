# Imagem da API do Verso (deploy na Oracle Cloud, docs/deploy-oracle.md).
# Multi-arquitetura: a base e o uv têm linux/arm64 (Ampere A1) e linux/amd64.
#   docker build -t verso-api backend
#   docker buildx build --platform linux/arm64 -t verso-api backend

# ---- build: resolve as dependências com o uv, sem as de desenvolvimento ----
FROM python:3.12-slim-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
# Só o lock primeiro: a camada das dependências fica em cache entre builds.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---- runtime: só o Python, o .venv e o código; usuário sem root ----
FROM python:3.12-slim-bookworm AS runtime
RUN groupadd --system verso && useradd --system --gid verso --home-dir /app verso
WORKDIR /app
COPY --from=build --chown=verso:verso /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
USER verso
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/saude', timeout=4).status == 200 else 1)"]
ENTRYPOINT ["/app/iniciar.sh"]
