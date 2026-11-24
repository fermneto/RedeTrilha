import os
from collections.abc import Iterator
from contextlib import asynccontextmanager, contextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.db import Base, SessionLocal, engine
from app.erros import erro_de_validacao
from app.observabilidade import erro_interno, iniciar_sentry
from app.models.user import User
from app.routers import (
    acervo,
    antologias,
    auth,
    comentarios,
    curtidas,
    feed,
    follows,
    oficina,
    poema_do_dia,
    posts,
    preferencias,
    rascunhos,
    rengas,
    reposts,
    saude,
    sugestoes,
    tags,
    traducao,
    users,
)
from app.services.posts import reconstruir_indice
from app.services.traducao import reconstruir_limite


# Número arbitrário e fixo do advisory lock do preparo do banco (ver _trava_do_preparo).
_CHAVE_DO_PREPARO = 7_302_019


def _banco_vazio() -> bool:
    with SessionLocal() as db:
        return db.scalar(select(User.id).limit(1)) is None


def preparar_banco() -> None:
    """Cria as tabelas e, com SEED_ON_BOOT=true, roda o seed num banco SEM usuários.

    Deploy: o seed só roda no primeiro boot no Postgres do Supabase; nos reinícios
    seguintes os dados criados na URL pública ficam. Com vários workers (Oracle,
    docs/deploy-oracle.md), quem chama isto é o serviço `seed` do compose, uma vez,
    antes da API: cada worker rodando o seed ao mesmo tempo duplicaria os dados.
    Import aqui dentro: fora do deploy, o script nem é carregado.
    """
    with _trava_do_preparo():
        Base.metadata.create_all(engine)
        if os.environ.get("SEED_ON_BOOT") == "true" and _banco_vazio():
            from scripts.seed import main as rodar_seed

            rodar_seed()


@contextmanager
def _trava_do_preparo() -> Iterator[None]:
    """No Postgres, um advisory lock: dois processos que preparam juntos fazem fila.

    Rede de segurança para quem subir vários workers com SEED_ON_BOOT=true: o
    segundo espera o primeiro terminar e já encontra o banco com usuários.
    """
    if engine.dialect.name != "postgresql":
        yield
        return
    with engine.connect() as conexao:
        conexao.execute(text("SELECT pg_advisory_lock(:chave)"), {"chave": _CHAVE_DO_PREPARO})
        try:
            yield
        finally:
            conexao.execute(text("SELECT pg_advisory_unlock(:chave)"), {"chave": _CHAVE_DO_PREPARO})


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Roda ANTES do rebuild, para o índice de tags já nascer com os dados.
    preparar_banco()
    # Reconstrói as estruturas do core/ a partir do banco (memória zera a cada
    # restart — inclusive no --reload; ver core/README.md).
    with SessionLocal() as db:
        reconstruir_indice(db)
        reconstruir_limite(db)
    yield


def origens_permitidas() -> list[str]:
    """Origens do CORS, de CORS_ORIGINS separadas por vírgula (no deploy, a URL da Vercel)."""
    valor = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    # rstrip("/"): o navegador manda a Origin sem a barra que vem ao copiar a URL.
    return [origem.strip().rstrip("/") for origem in valor.split(",") if origem.strip()]


# Sentry só com SENTRY_DSN; antes do app, para a integração do FastAPI se instalar.
iniciar_sentry()
app = FastAPI(title="Rede Social da Trilha", lifespan=lifespan)
# 422 em português em toda a API (ver app/erros.py).
app.add_exception_handler(RequestValidationError, erro_de_validacao)
# 500: uma linha JSON no log por erro não tratado (ver app/observabilidade.py).
app.add_exception_handler(Exception, erro_interno)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_permitidas(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1 linha por feature — registre o seu router aqui.
app.include_router(users.router)
app.include_router(follows.router)
app.include_router(posts.router)
app.include_router(tags.router)
app.include_router(auth.router)
app.include_router(curtidas.router)
app.include_router(feed.router)
app.include_router(reposts.router)
app.include_router(antologias.router)
app.include_router(comentarios.router)
app.include_router(poema_do_dia.router)
app.include_router(traducao.router)
app.include_router(saude.router)
app.include_router(acervo.router)
app.include_router(rengas.router)
app.include_router(oficina.router)
app.include_router(rascunhos.router)
app.include_router(sugestoes.router)
app.include_router(preferencias.router)
