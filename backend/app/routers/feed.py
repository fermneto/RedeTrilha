from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.services import feed as service

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
