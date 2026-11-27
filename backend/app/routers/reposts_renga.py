from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Id, get_current_user
from app.models.user import User
from app.services import reposts_renga as service

router = APIRouter(prefix="/rengas", tags=["reposts"])


@router.post("/{renga_id}/repostar", status_code=204)
def repostar_renga(
    renga_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.repostar(db, user, renga_id)


@router.delete("/{renga_id}/repostar", status_code=204)
def desfazer_repost_da_renga(
    renga_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.desfazer(db, user, renga_id)
