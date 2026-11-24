from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Limite, Offset, get_current_user
from app.models.user import User
from app.schemas.post import PostPage
from app.schemas.tags import Trending
from app.services import tags as service

router = APIRouter(tags=["tags"])


@router.get("/tags/trending", response_model=Trending)
def trending(_: User = Depends(get_current_user)):
    return service.trending()


@router.get("/tags/{tag}/posts", response_model=PostPage)
def posts_da_tag(
    tag: str,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.posts_da_tag(db, user, tag, offset, limit)


@router.get("/explorar", response_model=PostPage)
def explorar(
    tag: str | None = None,
    forma: str | None = None,
    offset: Offset = 0,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.explorar(db, user, tag, forma, offset, limit)
