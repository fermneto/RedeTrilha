from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import curtidas_renga as service

router = APIRouter(prefix="/rengas", tags=["curtidas"])


@router.post("/{renga_id}/curtir", status_code=204)
def curtir_renga(
    renga_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.curtir(db, user, renga_id)


@router.delete("/{renga_id}/curtir", status_code=204)
def descurtir_renga(
    renga_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.descurtir(db, user, renga_id)
