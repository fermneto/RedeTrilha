from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.comentario import ComentarioArvore, ComentarioCreate, ComentarioOut
from app.services import comentarios as service

router = APIRouter(prefix="/posts", tags=["comentarios"])


@router.post("/{post_id}/comentarios", response_model=ComentarioOut, status_code=201)
def comentar(
    post_id: int,
    dados: ComentarioCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.comentar(db, user, post_id, dados)


@router.get("/{post_id}/comentarios", response_model=ComentarioArvore)
def listar_comentarios(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.arvore(db, post_id)
