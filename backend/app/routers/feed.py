from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.services import feed_infinito

router = APIRouter(tags=["feed"])

# ISO 639-1 do navegador; sem ela, vale a língua dos poemas da própria pessoa.
Lingua = Annotated[str | None, Query(pattern=r"^[a-z]{2}$")]


@router.get("/feed", response_model=FeedPage)
def feed(
    offset: Offset = 0,
    limit: Limite = 20,
    cursor: str | None = None,
    # Vale quando o Seguindo acaba e continua com o "Para você".
    lingua: Lingua = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return feed_infinito.seguindo(db, user, offset, limit, cursor, lingua)


@router.get("/feed/para-voce", response_model=FeedPage)
def para_voce_feed(
    offset: Offset = 0,
    limit: Limite = 20,
    cursor: str | None = None,
    lingua: Lingua = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return feed_infinito.para_voce_infinito(db, user, offset, limit, cursor, lingua)
