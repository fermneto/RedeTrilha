from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.feed import FeedPage
from app.services import feed as service

router = APIRouter(tags=["feed"])


@router.get("/feed", response_model=FeedPage)
def feed(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.feed(db, user, offset, limit, cursor)
