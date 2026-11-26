"""Usuários: a lista simples (GET /usuarios) e o perfil. O Acervo usa /acervo; conta nova nasce só em POST /auth/registro."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache_http import cache
from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.schemas.preferencia import Preferencias
from app.schemas.user import PerfilOut, PerfilUpdate, UserPage
from app.services import perfil
from app.services import users as service

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


# Sem login e sem dado de quem pede: o único cache `public`.
@router.get("", response_model=UserPage, dependencies=[cache(60, publico=True)])
def listar_usuarios(
    offset: Offset = 0,
    limit: Limite = 20,
    db: Session = Depends(get_db),
):
    return service.listar(db, offset, limit)


# Rota fixa (/eu) antes de /{username}: o FastAPI casa na ordem de registro,
# e /{username} capturaria "eu".
@router.patch("/eu", response_model=PerfilOut)
def editar_perfil(
    dados: PerfilUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return perfil.editar(db, user, dados)


@router.get("/{username}", response_model=PerfilOut)
def ler_perfil(
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return perfil.perfil(db, username, user)


@router.get("/{username}/posts", response_model=FeedPage)
def poemas_do_perfil(
    username: str,
    offset: Offset = 0,
    limit: Limite = 20,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return perfil.poemas(db, username, user, offset, limit, cursor)


# Os gostos (preferências do onboarding) são públicos no perfil.
@router.get("/{username}/gostos", response_model=Preferencias)
def gostos_do_perfil(
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return perfil.gostos(db, username, user)
