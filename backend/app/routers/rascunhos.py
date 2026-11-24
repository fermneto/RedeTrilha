from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.post import PostOut
from app.schemas.rascunho import RascunhoCreate, RascunhoOut, RascunhoPage, RascunhoUpdate
from app.services import posts as posts_service
from app.services import rascunhos as service

router = APIRouter(prefix="/rascunhos", tags=["rascunhos"])


@router.get("", response_model=RascunhoPage)
def meus_rascunhos(
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar(db, user, offset, limit)


@router.post("", response_model=RascunhoOut, status_code=201)
def criar_rascunho(
    dados: RascunhoCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.criar(db, user, dados)


@router.get("/{rascunho_id}", response_model=RascunhoOut)
def ler_rascunho(
    rascunho_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.buscar_do_autor(db, user, rascunho_id)


@router.patch("/{rascunho_id}", response_model=RascunhoOut)
def editar_rascunho(
    rascunho_id: int,
    dados: RascunhoUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.editar(db, user, rascunho_id, dados)


@router.delete("/{rascunho_id}", status_code=204)
def apagar_rascunho(
    rascunho_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.apagar(db, user, rascunho_id)


@router.post("/{rascunho_id}/publicar", response_model=PostOut, status_code=201)
def publicar_rascunho(
    rascunho_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return posts_service.para_saida_de(db, service.publicar(db, user, rascunho_id), user)
