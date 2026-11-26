from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.dica import Dica, DicasVistas
from app.services import dicas as service

router = APIRouter(prefix="/dicas", tags=["dicas"])


@router.get("", response_model=DicasVistas)
def ler(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.ler(db, user)


@router.put("/{dica}", response_model=DicasVistas)
def marcar_vista(dica: Dica, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.marcar_vista(db, user, dica)


@router.delete("", response_model=DicasVistas)
def zerar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.zerar(db, user)
