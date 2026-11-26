"""As dicas do livro já vistas: ficam na conta, valem em qualquer aparelho."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.dica_vista import DicaVista
from app.models.user import User
from app.schemas.dica import DICAS, DicasVistas


def ler(db: Session, usuario: User) -> DicasVistas:
    vistas = set(db.scalars(select(DicaVista.dica).where(DicaVista.user_id == usuario.id)))
    return DicasVistas(vistas=[d for d in DICAS if d in vistas])


def marcar_vista(db: Session, usuario: User, dica: str) -> DicasVistas:
    """Idempotente: marcar de novo uma dica vista não muda nada."""
    if db.get(DicaVista, (usuario.id, dica)) is None:
        db.add(DicaVista(user_id=usuario.id, dica=dica))
        db.commit()
    return ler(db, usuario)


def zerar(db: Session, usuario: User) -> DicasVistas:
    """O "rever as dicas" das Preferências: todas voltam a aparecer, uma de cada vez."""
    db.execute(delete(DicaVista).where(DicaVista.user_id == usuario.id))
    db.commit()
    return DicasVistas(vistas=[])
