from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Id, Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.post import PostPage
from app.schemas.user import UserPage
from app.services import repercussao as service

router = APIRouter(tags=["repercussao"])


@router.get("/posts/{post_id}/curtidas", response_model=UserPage)
def curtidas_do_poema(
    post_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.curtidas_do_poema(db, user, post_id, offset, limit)


@router.get("/posts/{post_id}/reposts", response_model=UserPage)
def reposts_do_poema(
    post_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.reposts_do_poema(db, user, post_id, offset, limit)


@router.get("/posts/{post_id}/citacoes", response_model=PostPage)
def citacoes_do_poema(
    post_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.citacoes_do_poema(db, user, post_id, offset, limit)


@router.get("/rengas/{renga_id}/curtidas", response_model=UserPage)
def curtidas_da_renga(
    renga_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.curtidas_da_renga(db, user, renga_id, offset, limit)


@router.get("/rengas/{renga_id}/reposts", response_model=UserPage)
def reposts_da_renga(
    renga_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.reposts_da_renga(db, user, renga_id, offset, limit)


@router.get("/rengas/{renga_id}/citacoes", response_model=PostPage)
def citacoes_da_renga(
    renga_id: Id,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.citacoes_da_renga(db, user, renga_id, offset, limit)
