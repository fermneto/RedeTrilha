"""Dependências compartilhadas dos endpoints.

get_current_user é a porta de entrada da autenticação: toda rota protegida
declara `user: User = Depends(get_current_user)` (guia 01).
"""

import os
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Path, Query, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.limites import INT4_MAX, INT4_MIN
from app.db import SessionLocal, get_db
from app.models.user import User
from app.services.auth import token_do_header, usuario_do_token

# Paginação das listagens, igual em todas as rotas: `offset: Offset = 0, limit: Limite = 20`.
Offset = Annotated[int, Query(ge=0, le=INT4_MAX)]
Limite = Annotated[int, Query(ge=1, le=100)]

# Todo id de rota (`/posts/{post_id}`): positivo e dentro do int4 das chaves do
# Postgres. Fora disso é 422, e não o 500 do banco recusando o número.
Id = Annotated[int, Path(ge=1, le=INT4_MAX)]
# `?verso=` dos comentários: comparado às colunas da âncora, também cabe no int4.
Verso = Annotated[int | None, Query(ge=INT4_MIN, le=INT4_MAX)]


def get_current_user(
    authorization: str | None = Header(default=None),
    # str, não int: um "abc" daria 422 e revelaria, em produção, que o bypass existe.
    x_user_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    return usuario_da_requisicao(db, authorization, x_user_id)


async def id_de_quem_abre_o_stream(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> int:
    """A autenticação do `GET /mensagens/stream`, que fica aberto por minutos.

    Não usa o `get_db`: a sessão dele só fecharia no fim da resposta, e o stream
    seguraria uma conexão do pool o tempo todo. Aqui a sessão vive só na consulta
    do token, numa thread, com a vaga que a fila do banco reservou para isso
    (app/limite_do_banco.py); depois o stream não toca mais no banco.
    """

    def autenticar() -> int:
        with SessionLocal() as db:
            return usuario_da_requisicao(db, authorization, x_user_id).id

    async with request.state.vaga_do_banco:
        return await run_in_threadpool(autenticar)


def usuario_da_requisicao(db: Session, authorization: str | None, x_user_id: str | None) -> User:
    """Quem faz a requisição: o dono do token ou, só com DEBUG, o do X-User-Id. Senão, 401."""
    # Veio Authorization: ele decide sozinho. Token inválido é 401 sempre,
    # mesmo com DEBUG, para o bypass nunca mascarar um token quebrado.
    if authorization is not None:
        token = token_do_header(authorization)
        user = usuario_do_token(db, token) if token else None
        if user:
            return user
        raise HTTPException(status_code=401, detail="não autenticado")

    # bypass de DESENVOLVIMENTO: só sem Authorization e só com DEBUG=true.
    # Em produção não existe DEBUG: o header é ignorado e a rota protegida dá 401.
    # isascii(): isdigit() sozinho aceita dígitos Unicode como "²", e o int() daria 500.
    if (
        os.environ.get("DEBUG") == "true"
        and x_user_id is not None
        and x_user_id.isascii()
        and x_user_id.isdigit()
    ):
        user = db.get(User, int(x_user_id))
        if user:
            return user

    raise HTTPException(status_code=401, detail="não autenticado")
