import secrets

import bcrypt
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.contadores import contador_iniciais
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import LoginIn, RegistroIn


def registrar(db: DbSession, dados: RegistroIn) -> User:
    ja_existe = db.scalar(select(User).where(User.username == dados.username))
    if ja_existe:
        raise HTTPException(status_code=409, detail="username já existe")

    # gensalt() embute um salt aleatório no hash: senhas iguais, hashes diferentes.
    hash_ = bcrypt.hashpw(dados.password.encode(), bcrypt.gensalt()).decode()
    user = User(username=dados.username, name=dados.name, password_hash=hash_)
    db.add(user)
    db.commit()
    db.refresh(user)

    contador_iniciais.incrementar(user.username)
    return user


def logar(db: DbSession, dados: LoginIn) -> str:
    user = db.scalar(select(User).where(User.username == dados.username))
    # O mesmo 401 para usuário inexistente, senha errada e conta sem senha
    # (consagrado): não revela quais usernames existem. Sem hash, o checkpw
    # explodiria com "Invalid salt", por isso o hash é conferido antes.
    if (
        not user
        or not user.password_hash
        or not bcrypt.checkpw(dados.password.encode(), user.password_hash.encode())
    ):
        raise HTTPException(status_code=401, detail="usuário ou senha inválidos")

    sessao = Session(token=secrets.token_urlsafe(32), user_id=user.id)
    db.add(sessao)
    db.commit()
    return sessao.token


def usuario_do_token(db: DbSession, token: str) -> User | None:
    sessao = db.get(Session, token)
    return db.get(User, sessao.user_id) if sessao else None
