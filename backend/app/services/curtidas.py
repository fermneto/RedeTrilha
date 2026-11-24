from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.curtida import Curtida
from app.models.user import User
from app.services.posts import buscar


def curtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: curtir o que já curtiu não faz nada."""
    buscar(db, post_id)
    ja_curtiu = db.scalar(
        select(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == post_id)
    )
    if ja_curtiu is None:
        db.add(Curtida(user_id=usuario.id, post_id=post_id))
        db.commit()


def descurtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: descurtir o que não curtiu não faz nada."""
    buscar(db, post_id)
    db.execute(
        delete(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == post_id)
    )
    db.commit()
