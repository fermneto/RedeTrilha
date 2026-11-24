from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.versao_poema import VersaoPage
from app.services import versoes_poema as service

router = APIRouter(tags=["versoes"])


@router.get("/posts/{post_id}/versoes", response_model=VersaoPage)
def versoes_do_poema(
    post_id: int,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar(db, user, post_id, offset, limit)
