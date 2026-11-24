"""Acervo: a tela que navega todos os poetas, consagrados e poetas do Verso."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.acervo import AcervoPage, ChaveEpoca, FiltrosDoAcervo, Ordem, Tipo
from app.services import acervo as service

router = APIRouter(prefix="/acervo", tags=["acervo"])

# 24 = a página da tela (grade de 2 ou 3 colunas fecha sem sobra).
POR_PAGINA = 24


@router.get("", response_model=AcervoPage)
def listar(
    tipo: Tipo = "todos",
    q: Annotated[str | None, Query(max_length=80)] = None,
    lingua: Annotated[str | None, Query(pattern=r"^[a-z]{2}$")] = None,
    epoca: ChaveEpoca | None = None,
    ordem: Ordem = "alfabetica",
    offset: Offset = 0,
    limit: Limite = POR_PAGINA,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filtros = service.Filtros(tipo=tipo, q=q, lingua=lingua, epoca=epoca, ordem=ordem)
    return service.listar(db, user, filtros, offset, limit)


@router.get("/filtros", response_model=FiltrosDoAcervo)
def filtros(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.opcoes_de_filtro(db)
