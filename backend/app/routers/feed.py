from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.services import feed as service
from app.services import para_voce

router = APIRouter(tags=["feed"])


@router.get("/feed", response_model=FeedPage)
def feed(
    offset: Offset = 0,
    limit: Limite = 20,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.feed(db, user, offset, limit, cursor)


@router.get("/feed/para-voce", response_model=FeedPage)
def para_voce_feed(
    offset: Offset = 0,
    limit: Limite = 20,
    cursor: str | None = None,
    # ISO 639-1 do navegador; sem ela, vale a língua dos poemas da própria pessoa.
    lingua: Annotated[str | None, Query(pattern=r"^[a-z]{2}$")] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return para_voce.feed(db, user, offset, limit, cursor, lingua)
