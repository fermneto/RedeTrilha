import secrets

import bcrypt
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.models.session import Session
from app.models.user import User
from app.schemas.auth import LoginIn, RegistroIn


def gerar_hash(senha: str) -> str:
    # gensalt() embute um salt aleatório no hash: senhas iguais, hashes diferentes.
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()


def registrar(db: DbSession, dados: RegistroIn) -> User:
    ja_existe = db.scalar(select(User).where(User.username == dados.username))
    if ja_existe:
        raise HTTPException(status_code=409, detail="username já existe")

    user = User(
        username=dados.username, name=dados.name, password_hash=gerar_hash(dados.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
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


def deslogar(db: DbSession, token: str) -> None:
    sessao = db.get(Session, token)
    if sessao:
        db.delete(sessao)
        db.commit()


def token_do_header(authorization: str) -> str | None:
    if not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ") or None


def usuario_do_token(db: DbSession, token: str) -> User | None:
    sessao = db.get(Session, token)
    return db.get(User, sessao.user_id) if sessao else None
