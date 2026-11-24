"""Repost puro: um Post do usuário com `repost_de_id` e texto vazio.

A citação (com texto) é criada pelo `POST /posts` (ver `services/posts.criar`).
Repostar um repost puro vai no original, como no X.
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.curtida import Curtida
from app.models.post import Post
from app.models.user import User
from app.services.posts import original_de


def repostar(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: repostar o que já repostou não duplica."""
    original = original_de(db, post_id)
    if _repost_puro(db, usuario, original.id) is None:
        db.add(Post(autor_id=usuario.id, texto="", repost_de_id=original.id))
        db.commit()


def desfazer(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: desfazer um repost que não existe não faz nada."""
    original = original_de(db, post_id)
    repost = _repost_puro(db, usuario, original.id)
    if repost is not None:
        db.execute(delete(Curtida).where(Curtida.post_id == repost.id))
        db.delete(repost)
        db.commit()


def _repost_puro(db: Session, usuario: User, original_id: int) -> Post | None:
    return db.scalar(
        select(Post).where(
            Post.autor_id == usuario.id, Post.repost_de_id == original_id, Post.texto == ""
        )
    )
