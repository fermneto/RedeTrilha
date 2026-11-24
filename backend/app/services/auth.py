import secrets

import bcrypt
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.models.session import Session
from app.models.user import User
from app.schemas.auth import LoginIn, RegistroIn
from app.services.users import garantir_username_livre


def gerar_hash(senha: str) -> str:
    # gensalt() embute um salt aleatório no hash: senhas iguais, hashes diferentes.
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()


def registrar(db: DbSession, dados: RegistroIn) -> User:
    garantir_username_livre(db, dados.username)
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


def deslogar(db: DbSession, authorization: str | None) -> None:
    """Apaga a sessão do token. Sem Authorization (bypass de DEBUG) não há sessão para apagar."""
    token = token_do_header(authorization) if authorization else None
    if not token:
        return
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
