from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.curtida import Curtida
from app.models.user import User
from app.services.posts import original_de


def curtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: curtir o que já curtiu não faz nada. Repost puro curte o original."""
    post_id = original_de(db, post_id).id
    ja_curtiu = db.scalar(
        select(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == post_id)
    )
    if ja_curtiu is None:
        db.add(Curtida(user_id=usuario.id, post_id=post_id))
        db.commit()


def descurtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: descurtir o que não curtiu não faz nada. Repost puro descurte o original."""
    post_id = original_de(db, post_id).id
    db.execute(
        delete(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == post_id)
    )
    db.commit()
