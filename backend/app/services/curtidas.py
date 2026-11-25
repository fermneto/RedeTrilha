from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.curtida import Curtida
from app.models.user import User
from app.services import avisos
from app.services.posts import original_de, original_para_interagir


def curtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: curtir o que já curtiu não faz nada. Repost puro curte o original.
    O autor recebe o aviso (services/avisos.py) no mesmo commit.

    A constraint única (user_id, post_id) barra a corrida do clique duplo; a
    chamada que perde cai no IntegrityError e vale como já curtido.
    """
    poema = original_para_interagir(db, usuario, post_id)
    ja_curtiu = db.scalar(
        select(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == poema.id)
    )
    if ja_curtiu is None:
        db.add(Curtida(user_id=usuario.id, post_id=poema.id))
        avisos.avisar(db, usuario, [(poema.autor_id, "curtida")], post_id=poema.id)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def descurtir(db: Session, usuario: User, post_id: int) -> None:
    """Idempotente: descurtir o que não curtiu não faz nada. Repost puro descurte o original."""
    post_id = original_de(db, post_id).id
    db.execute(
        delete(Curtida).where(Curtida.user_id == usuario.id, Curtida.post_id == post_id)
    )
    avisos.desfazer(db, "curtida", usuario.id, post_id=post_id)
    db.commit()
