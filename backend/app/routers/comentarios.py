from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, get_current_user
from app.models.user import User
from app.schemas.comentario import (
    ComentarioApagadoOut,
    ComentarioCreate,
    ComentarioOut,
    ComentarioPage,
    VersosComentadosOut,
)
from app.services import comentarios as service

router = APIRouter(tags=["comentarios"])


@router.post("/posts/{post_id}/comentarios", response_model=ComentarioOut, status_code=201)
def comentar(
    post_id: int,
    dados: ComentarioCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.comentar(db, user, post_id, dados)


@router.get("/posts/{post_id}/comentarios", response_model=ComentarioPage)
def listar_comentarios(
    post_id: int,
    limit: Limite = 20,
    cursor: str | None = None,
    verso: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.respostas_do_poema(db, user, post_id, limit, cursor, verso)


@router.get("/posts/{post_id}/comentarios/versos", response_model=VersosComentadosOut)
def versos_comentados(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.versos_comentados(db, user, post_id)


@router.get("/comentarios/{comentario_id}/respostas", response_model=ComentarioPage)
def listar_respostas(
    comentario_id: int,
    limit: Limite = 20,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.respostas_do_comentario(db, user, comentario_id, limit, cursor)


@router.delete("/comentarios/{comentario_id}", response_model=ComentarioApagadoOut)
def apagar_comentario(
    comentario_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.apagar(db, user, comentario_id)
