from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, get_current_user
from app.models.user import User
from app.schemas.comentario import (
    ComentarioApagadoOut,
    ComentarioCreate,
    ComentarioRengaOut,
    ComentarioRengaPage,
    VersosComentadosOut,
)
from app.services import comentarios_renga as service

router = APIRouter(tags=["comentarios"])


@router.post(
    "/rengas/{renga_id}/comentarios", response_model=ComentarioRengaOut, status_code=201
)
def comentar_renga(
    renga_id: int,
    dados: ComentarioCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.comentar(db, user, renga_id, dados)


@router.get("/rengas/{renga_id}/comentarios", response_model=ComentarioRengaPage)
def listar_comentarios_da_renga(
    renga_id: int,
    limit: Limite = 20,
    cursor: str | None = None,
    verso: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.respostas_da_renga(db, user, renga_id, limit, cursor, verso)


@router.get("/rengas/{renga_id}/comentarios/versos", response_model=VersosComentadosOut)
def versos_comentados_da_renga(
    renga_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.versos_comentados(db, user, renga_id)


@router.get(
    "/rengas/{renga_id}/comentarios/{comentario_id}/respostas",
    response_model=ComentarioRengaPage,
)
def listar_respostas_na_renga(
    renga_id: int,
    comentario_id: int,
    limit: Limite = 20,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.respostas_do_comentario(db, user, renga_id, comentario_id, limit, cursor)


@router.delete(
    "/rengas/{renga_id}/comentarios/{comentario_id}", response_model=ComentarioApagadoOut
)
def apagar_comentario_da_renga(
    renga_id: int,
    comentario_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.apagar(db, user, renga_id, comentario_id)
