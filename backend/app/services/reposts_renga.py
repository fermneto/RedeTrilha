"""Repost puro de uma renga, como o de um poema (services/reposts.py).

A renga não é post: o repost é uma linha de `reposts_renga`, e a renga sobe no
feed de quem segue quem repostou ("fulano repostou", services/feed.py). A citação
(um poema que cita a renga) é criada pelo `POST /posts` com `renga_citada_id`.
O repost avisa todos os autores da renga (decisão do Neto, #171), menos quem repostou.
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.repost_renga import RepostRenga
from app.models.user import User
from app.services import avisos, rengas


def repostar(db: Session, usuario: User, renga_id: int) -> None:
    """Idempotente: repostar o que já repostou não duplica.

    A constraint única (user_id, renga_id) barra a corrida entre duas chamadas
    simultâneas; a que perde cai no IntegrityError e vale como já repostada.
    """
    renga = rengas.para_interagir(db, usuario, renga_id)
    if _repost(db, usuario, renga.id) is None:
        db.add(RepostRenga(user_id=usuario.id, renga_id=renga.id))
        avisos.avisar(
            db,
            usuario,
            [(autor, "repost") for autor in rengas.ids_dos_autores(db, renga.id)],
            dono_id=renga.criador_id,
            renga_id=renga.id,
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def desfazer(db: Session, usuario: User, renga_id: int) -> None:
    """Idempotente: desfazer um repost que não existe não faz nada."""
    renga = rengas.buscar(db, renga_id)
    repost = _repost(db, usuario, renga.id)
    if repost is not None:
        db.delete(repost)
        avisos.desfazer(db, "repost", usuario.id, renga_id=renga.id)
        db.commit()


def _repost(db: Session, usuario: User, renga_id: int) -> RepostRenga | None:
    return db.scalar(
        select(RepostRenga).where(RepostRenga.user_id == usuario.id, RepostRenga.renga_id == renga_id)
    )
