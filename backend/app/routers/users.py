"""Slice de exemplo completo: model → schema → service → router → página Next.

Toda feature nova imita este caminho. 1 arquivo por router — registre o seu
com uma linha em main.py.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.contadores import contador_iniciais
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.schemas.user import PerfilOut, PerfilUpdate, UserCreate, UserOut, UserPage
from app.services import perfil
from app.services import users as service

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=UserPage)
def listar_usuarios(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    users, total = service.listar(db, offset, limit)
    return UserPage(items=users, total=total, offset=offset, limit=limit)


@router.get("/stats")
def stats_por_inicial():
    """Endpoint que USA a estrutura do core/ — alvo do teste-sabotagem de exemplo."""
    return {"usuarios_por_inicial": contador_iniciais.contagem()}


@router.post("", response_model=UserOut, status_code=201)
def criar_usuario(dados: UserCreate, db: Session = Depends(get_db)):
    # slice de exemplo: cria sem senha (password_hash=None, não loga).
    # Conta com login nasce em POST /auth/registro.
    return service.criar(db, dados)


# Rotas fixas (/stats acima, /eu aqui) antes de /{username}: o FastAPI casa na
# ordem de registro, e /{username} capturaria "stats" e "eu".
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
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return perfil.poemas(db, username, user, offset, limit, cursor)
