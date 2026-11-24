from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.post import PostCreate, PostOut, PostUpdate
from app.services import posts as service

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostOut, status_code=201)
def criar_post(
    dados: PostCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.para_saida(service.criar(db, user, dados))


@router.get("/{post_id}", response_model=PostOut)
def ler_post(
    post_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.para_saida(service.buscar(db, post_id))


@router.patch("/{post_id}", response_model=PostOut)
def editar_post(
    post_id: int,
    dados: PostUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.para_saida(service.editar(db, user, post_id, dados))


@router.delete("/{post_id}", status_code=204)
def apagar_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.apagar(db, user, post_id)
