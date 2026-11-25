from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, get_current_user
from app.models.user import User
from app.schemas.aviso import AvisoPage, LeituraDeAvisos, ResumoDeAvisos
from app.services import avisos as service

router = APIRouter(prefix="/avisos", tags=["avisos"])


@router.get("", response_model=AvisoPage)
def listar(
    cursor: str | None = None,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar(db, user, cursor, limit)


@router.get("/resumo", response_model=ResumoDeAvisos)
def resumo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.resumo(db, user)


@router.post("/lidos", status_code=204)
def marcar_lidos(
    dados: LeituraDeAvisos | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.marcar_lidos(db, user, dados.ate if dados else None)
