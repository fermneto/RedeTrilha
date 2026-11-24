from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.sugestao import SugestaoPage
from app.services import sugestoes as service

router = APIRouter(tags=["sugestoes"])


@router.get("/sugestoes", response_model=SugestaoPage)
def sugestoes(
    offset: Offset = 0,
    limit: Limite = 20,
    # ISO 639-1 do navegador; sem ela, vale a língua dos poemas da própria pessoa.
    lingua: Annotated[str | None, Query(pattern=r"^[a-z]{2}$")] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.sugestoes(db, user, offset, limit, lingua)
