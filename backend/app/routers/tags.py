from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.post import PostPage
from app.schemas.tags import TagContagem, Trending
from app.services import tags as service

router = APIRouter(tags=["tags"])


@router.get("/tags/trending", response_model=Trending)
def trending(_: User = Depends(get_current_user)):
    return Trending(
        items=[TagContagem(tag=tag, contagem=n) for tag, n in service.trending()]
    )


@router.get("/tags/{tag}/posts", response_model=PostPage)
def posts_da_tag(
    tag: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.posts_da_tag(db, user, tag, offset, limit)


@router.get("/explorar", response_model=PostPage)
def explorar(
    tag: str | None = None,
    forma: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.explorar(db, user, tag, forma, offset, limit)
