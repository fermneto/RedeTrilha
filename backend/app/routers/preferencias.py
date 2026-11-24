from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache_http import cache
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.preferencia import OpcoesDePreferencias, Preferencias
from app.services import preferencias as service

router = APIRouter(prefix="/preferencias", tags=["preferencias"])


@router.get("", response_model=Preferencias)
def ler(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.ler(db, user)


@router.put("", response_model=Preferencias)
def salvar(
    dados: Preferencias,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.salvar(db, user, dados)


# Listas fixas do código (escolas, formas, países).
@router.get("/opcoes", response_model=OpcoesDePreferencias, dependencies=[cache(3600)])
def opcoes(_: User = Depends(get_current_user)):
    return service.opcoes()
