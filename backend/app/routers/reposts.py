from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Id, get_current_user
from app.models.user import User
from app.services import reposts as service

router = APIRouter(prefix="/posts", tags=["reposts"])


@router.post("/{post_id}/repostar", status_code=204)
def repostar(
    post_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.repostar(db, user, post_id)


@router.delete("/{post_id}/repostar", status_code=204)
def desfazer_repost(
    post_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.desfazer(db, user, post_id)
