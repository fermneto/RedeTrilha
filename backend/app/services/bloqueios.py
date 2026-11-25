"""Bloquear alguém nas mensagens: nenhum dos dois manda mensagem ao outro, e quem
foi bloqueado não abre conversa com quem o bloqueou. Desbloquear desfaz.

A conversa que já existia continua lá, com o histórico, para os dois.
"""

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.bloqueio import Bloqueio
from app.models.user import User
from app.services.users import buscar_por_username


def bloquear(db: Session, eu: User, username: str) -> None:
    """Idempotente: bloquear de novo não faz nada."""
    outro = buscar_por_username(db, username)
    if outro.id == eu.id:
        raise HTTPException(status_code=422, detail="não dá para bloquear a si mesmo")
    if bloqueou(db, eu.id, outro.id):
        return
    db.add(Bloqueio(bloqueador_id=eu.id, bloqueado_id=outro.id))
    try:
        db.commit()
    except IntegrityError:
        # Dois cliques ao mesmo tempo: o outro já gravou o mesmo bloqueio.
        db.rollback()


def desbloquear(db: Session, eu: User, username: str) -> None:
    """Idempotente: desbloquear quem não está bloqueado não faz nada."""
    outro = buscar_por_username(db, username)
    db.execute(
        delete(Bloqueio).where(Bloqueio.bloqueador_id == eu.id, Bloqueio.bloqueado_id == outro.id)
    )
    db.commit()


def bloqueou(db: Session, quem_id: int, outro_id: int) -> bool:
    """`quem_id` bloqueou `outro_id`? Uma busca pelo par único."""
    return (
        db.scalar(
            select(Bloqueio.id).where(
                Bloqueio.bloqueador_id == quem_id, Bloqueio.bloqueado_id == outro_id
            )
        )
        is not None
    )
