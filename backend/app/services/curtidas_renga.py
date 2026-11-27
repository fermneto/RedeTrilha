"""Curtir uma renga, como um poema (services/curtidas.py).

A renga é de todos os autores: a curtida avisa cada poeta que escreveu ao menos
uma estrofe (decisão do Neto, #171), menos quem curtiu.
"""

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.curtida_renga import CurtidaRenga
from app.models.user import User
from app.services import avisos, rengas


def curtir(db: Session, usuario: User, renga_id: int) -> None:
    """Idempotente: curtir o que já curtiu não faz nada. Os autores recebem o aviso
    no mesmo commit.

    A constraint única (user_id, renga_id) barra a corrida do clique duplo; a
    chamada que perde cai no IntegrityError e vale como já curtida.
    """
    renga = rengas.para_interagir(db, usuario, renga_id)
    ja_curtiu = db.scalar(
        select(CurtidaRenga).where(
            CurtidaRenga.user_id == usuario.id, CurtidaRenga.renga_id == renga.id
        )
    )
    if ja_curtiu is None:
        db.add(CurtidaRenga(user_id=usuario.id, renga_id=renga.id))
        rengas.avisar_autores(db, usuario, renga, "curtida")
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def descurtir(db: Session, usuario: User, renga_id: int) -> None:
    """Idempotente: descurtir o que não curtiu não faz nada."""
    renga = rengas.buscar(db, renga_id)
    db.execute(
        delete(CurtidaRenga).where(
            CurtidaRenga.user_id == usuario.id, CurtidaRenga.renga_id == renga.id
        )
    )
    avisos.desfazer(db, "curtida", usuario.id, renga_id=renga.id)
    db.commit()
