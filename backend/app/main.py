import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.erros import erro_de_validacao
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


def _banco_vazio() -> bool:
    with SessionLocal() as db:
        return db.scalar(select(User.id).limit(1)) is None


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    # Deploy: o seed só roda num banco SEM usuários (o primeiro boot no Postgres
    # do Supabase); nos reinícios seguintes os dados criados na URL pública ficam.
    # Import aqui dentro: fora do deploy, o script nem é carregado.
    if os.environ.get("SEED_ON_BOOT") == "true" and _banco_vazio():
        from scripts.seed import main as rodar_seed

        rodar_seed()
    # Nada a reconstruir: o índice de tags e o limite de tradução moram no banco
    # (core/README.md), então o boot é rápido e vale para vários workers.
    yield


def origens_permitidas() -> list[str]:
    """Origens do CORS, de CORS_ORIGINS separadas por vírgula (no deploy, a URL da Vercel)."""
    valor = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    # rstrip("/"): o navegador manda a Origin sem a barra que vem ao copiar a URL.
    return [origem.strip().rstrip("/") for origem in valor.split(",") if origem.strip()]


app = FastAPI(title="Rede Social da Trilha", lifespan=lifespan)
# 422 em português em toda a API (ver app/erros.py).
app.add_exception_handler(RequestValidationError, erro_de_validacao)

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
