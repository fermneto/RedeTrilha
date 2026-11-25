from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import bloqueios as service

router = APIRouter(prefix="/usuarios", tags=["bloqueios"])


@router.post("/{username}/bloqueio", status_code=204)
def bloquear(username: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.bloquear(db, user, username)


@router.delete("/{username}/bloqueio", status_code=204)
def desbloquear(username: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.desbloquear(db, user, username)
