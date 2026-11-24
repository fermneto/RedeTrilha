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
from app.models.traducao import INDICE_DO_LIMITE
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
from app.services import indice_tags


# Índices novos em tabelas que já existiam antes deles (o create_all não os cria).
INDICES_EM_TABELA_EXISTENTE = (INDICE_DO_LIMITE,)

# Número arbitrário e fixo do advisory lock do preparo do banco (ver _trava_do_preparo).
_CHAVE_DO_PREPARO = 7_302_019


def _banco_vazio() -> bool:
    with SessionLocal() as db:
        return db.scalar(select(User.id).limit(1)) is None


def preparar_banco() -> None:
    """Cria as tabelas, roda o seed (com SEED_ON_BOOT=true, num banco SEM usuários)
    e põe em dia um banco de antes do índice de tags no banco.

    Deploy: o seed só roda no primeiro boot no Postgres do Supabase; nos reinícios
    seguintes os dados criados na URL pública ficam. Com vários workers (Oracle,
    docs/deploy-oracle.md), quem chama isto é o serviço `seed` do compose, uma vez,
    antes da API: cada worker rodando o seed ao mesmo tempo duplicaria os dados.
    Import aqui dentro: fora do deploy, o script nem é carregado.

    Banco antigo: o `create_all` cria a tabela nova `post_tags` vazia, mas não
    cria índice novo em tabela que já existe. Por isso, ainda dentro da trava,
    os índices de `INDICES_EM_TABELA_EXISTENTE` são criados se faltarem e o
    índice de tags é populado a partir dos posts se estiver vazio. Num banco
    novo ou já em dia, isso custa uma checagem por índice e duas consultas
    com LIMIT 1.
    """
    with _trava_do_preparo():
        Base.metadata.create_all(engine)
        if os.environ.get("SEED_ON_BOOT") == "true" and _banco_vazio():
            from scripts.seed import main as rodar_seed

            rodar_seed()
        for indice in INDICES_EM_TABELA_EXISTENTE:
            indice.create(engine, checkfirst=True)
        with SessionLocal() as db:
            indice_tags.popular_se_vazio(db)


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
    # Nada a reconstruir: o índice de tags e o limite de tradução moram no banco
    # (core/README.md), então o boot é rápido e vale para vários workers.
    preparar_banco()
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
