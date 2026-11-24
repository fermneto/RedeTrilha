from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.user import UserPage
from app.services import follows as service

router = APIRouter(prefix="/usuarios", tags=["follows"])


@router.post("/{username}/follow", status_code=204)
def seguir(
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.seguir(db, user, username)


@router.delete("/{username}/follow", status_code=204)
def deixar_de_seguir(
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.deixar_de_seguir(db, user, username)


@router.get("/{username}/seguidores", response_model=UserPage)
def listar_seguidores(
    username: str,
    offset: Offset = 0,
    limit: Limite = 20,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar_seguidores(db, username, offset, limit)


@router.get("/{username}/seguindo", response_model=UserPage)
def listar_seguindo(
    username: str,
    offset: Offset = 0,
    limit: Limite = 20,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar_seguindo(db, username, offset, limit)
