from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Id, get_current_user
from app.models.user import User
from app.services import curtidas as service

router = APIRouter(prefix="/posts", tags=["curtidas"])


@router.post("/{post_id}/curtir", status_code=204)
def curtir(
    post_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.curtir(db, user, post_id)


@router.delete("/{post_id}/curtir", status_code=204)
def descurtir(
    post_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.descurtir(db, user, post_id)
