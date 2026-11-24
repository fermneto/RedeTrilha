from fastapi import APIRouter, Depends
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.sugestoes(db, user, offset, limit)
