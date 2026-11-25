from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.renga import (
    ConvitesCreate,
    EstrofeCreate,
    RengaCreate,
    RengaDetalhe,
    RengaPage,
)
from app.services import rengas as service

router = APIRouter(tags=["rengas"])


@router.post("/rengas", response_model=RengaDetalhe, status_code=201)
def criar_renga(
    dados: RengaCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.criar(db, user, dados)


@router.get("/rengas", response_model=RengaPage)
def listar_rengas(
    offset: Offset = 0,
    limit: Limite = 20,
    situacao: Literal["aberta", "fechada"] | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.listar(db, user, situacao, offset, limit)


@router.get("/rengas/{renga_id}", response_model=RengaDetalhe)
def ler_renga(
    renga_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.detalhar(db, user, renga_id)


@router.post("/rengas/{renga_id}/estrofes", response_model=RengaDetalhe, status_code=201)
def acrescentar_estrofe(
    renga_id: int,
    dados: EstrofeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.acrescentar(db, user, renga_id, dados.texto)


@router.post("/rengas/{renga_id}/encerrar", response_model=RengaDetalhe)
def encerrar_renga(
    renga_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.encerrar(db, user, renga_id)


@router.post("/rengas/{renga_id}/convites", response_model=RengaDetalhe)
def convidar_para_renga(
    renga_id: int,
    dados: ConvitesCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.convidar(db, user, renga_id, dados.usernames)
