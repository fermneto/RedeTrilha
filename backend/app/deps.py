"""Dependências compartilhadas dos endpoints.

get_current_user é a porta de entrada da autenticação: toda rota protegida
declara `user: User = Depends(get_current_user)` (guia 01).
"""

import os

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.services.auth import token_do_header, usuario_do_token


def get_current_user(
    authorization: str | None = Header(default=None),
    # str, não int: um "abc" daria 422 e revelaria, em produção, que o bypass existe.
    x_user_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
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
