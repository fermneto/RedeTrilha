from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserPage


def listar(db: Session, offset: int, limit: int) -> UserPage:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    users = list(
        db.scalars(
            select(User).order_by(User.username).offset(offset).limit(limit)
        )
    )
    return UserPage(items=users, total=total, offset=offset, limit=limit)


def buscar_por_username(db: Session, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(status_code=404, detail="usuário não encontrado")
    return user


def garantir_username_livre(db: Session, username: str) -> None:
    """409 se o username já existe. Usado pelo registro e pelo POST /usuarios."""
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise HTTPException(status_code=409, detail="username já existe")


def criar(db: Session, dados: UserCreate) -> User:
    garantir_username_livre(db, dados.username)
    user = User(**dados.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
