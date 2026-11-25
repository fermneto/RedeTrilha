"""Repost puro: um Post do usuário com `repost_de_id` e texto vazio.

A citação (com texto) é criada pelo `POST /posts` (ver `services/posts.criar`).
Repostar um repost puro vai no original, como no X.
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.user import User
from app.services import avisos
from app.services.posts import original_de, original_para_interagir


def repostar(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: repostar o que já repostou não duplica.

    O índice único `uq_repost_puro` barra a corrida entre duas chamadas
    simultâneas; a que perde cai no IntegrityError e vale como já repostado.
    """
    original = original_para_interagir(db, usuario, post_id)
    if _repost_puro(db, usuario, original.id) is None:
        db.add(Post(autor_id=usuario.id, texto="", repost_de_id=original.id))
        avisos.avisar(db, usuario, [(original.autor_id, "repost")], post_id=original.id)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def desfazer(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: desfazer um repost que não existe não faz nada."""
    original = original_de(db, post_id)
    repost = _repost_puro(db, usuario, original.id)
    if repost is not None:
        db.delete(repost)
        avisos.desfazer(db, "repost", usuario.id, post_id=original.id)
        db.commit()


def _repost_puro(db: Session, usuario: User, original_id: int) -> Post | None:
    return db.scalar(
        select(Post).where(
            Post.autor_id == usuario.id, Post.repost_de_id == original_id, Post.texto == ""
        )
    )
