from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.antologia import (
    AntologiaCreate,
    AntologiaDetalhe,
    AntologiaMarcadaPage,
    AntologiaOut,
    AntologiaPage,
    AntologiaPoemaCreate,
    AntologiaUpdate,
)
from app.services import antologias as service

router = APIRouter(tags=["antologias"])


@router.post("/antologias", response_model=AntologiaOut, status_code=201)
def criar_antologia(
    dados: AntologiaCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.criar(db, user, dados)


@router.get("/antologias", response_model=AntologiaMarcadaPage | AntologiaPage)
def minhas_antologias(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    post_id: int | None = Query(default=None, description="marca `contem` em cada antologia"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if post_id is not None:
        items, total = service.listar_minhas_marcando(db, user, post_id, offset, limit)
        return AntologiaMarcadaPage(items=items, total=total, offset=offset, limit=limit)
    items, total = service.listar_minhas(db, user, offset, limit)
    return AntologiaPage(items=items, total=total, offset=offset, limit=limit)


@router.get("/usuarios/{username}/antologias", response_model=AntologiaPage)
def antologias_de(
    username: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = service.listar_de(db, user, username, offset, limit)
    return AntologiaPage(items=items, total=total, offset=offset, limit=limit)


@router.get("/antologias/{antologia_id}", response_model=AntologiaDetalhe)
def ler_antologia(
    antologia_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.detalhar(db, user, antologia_id)


@router.patch("/antologias/{antologia_id}", response_model=AntologiaOut)
def editar_antologia(
    antologia_id: int,
    dados: AntologiaUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.editar(db, user, antologia_id, dados)


@router.delete("/antologias/{antologia_id}", status_code=204)
def apagar_antologia(
    antologia_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.apagar(db, user, antologia_id)


@router.post("/antologias/{antologia_id}/poemas", status_code=204)
def adicionar_poema(
    antologia_id: int,
    dados: AntologiaPoemaCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.adicionar_poema(db, user, antologia_id, dados.post_id)


@router.delete("/antologias/{antologia_id}/poemas/{post_id}", status_code=204)
def remover_poema(
    antologia_id: int,
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.remover_poema(db, user, antologia_id, post_id)
