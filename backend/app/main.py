from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.contadores import contador_iniciais
from app.db import Base, SessionLocal, engine
from app.erros import erro_de_validacao
from app.models.user import User
from app.routers import (
    antologias,
    auth,
    comentarios,
    curtidas,
    feed,
    follows,
    poema_do_dia,
    posts,
    reposts,
    tags,
    traducao,
    users,
)
from app.services.posts import reconstruir_indice
from app.services.traducao import reconstruir_limite


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    # Reconstrói as estruturas do core/ a partir do banco (memória zera a cada
    # restart — inclusive no --reload; ver core/README.md).
    with SessionLocal() as db:
        usernames = list(db.scalars(select(User.username)))
        reconstruir_indice(db)
        reconstruir_limite(db)
    contador_iniciais.reconstruir(usernames)
    yield


app = FastAPI(title="Rede Social da Trilha", lifespan=lifespan)
# 422 em português em toda a API (ver app/erros.py).
app.add_exception_handler(RequestValidationError, erro_de_validacao)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
