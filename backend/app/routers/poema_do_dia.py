from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.post import PostOut
from app.services import poema_do_dia as service

router = APIRouter(prefix="/poemas", tags=["poema do dia"])


@router.get("/do-dia", response_model=PostOut)
def poema_do_dia(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.poema_do_dia(db, user)
