"""Feed cronológico: poemas (e reposts) de quem o usuário segue, mais os dele."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostPage
from app.services.follows import ids_seguidos
from app.services.posts import para_saidas


def feed(db: Session, usuario: User, offset: int, limit: int) -> PostPage:
    filtro = Post.autor_id.in_([*ids_seguidos(db, usuario.id), usuario.id])
    total = db.scalar(select(func.count()).select_from(Post).where(filtro)) or 0
    posts = db.scalars(
        select(Post)
        .where(filtro)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return PostPage(
        items=para_saidas(db, list(posts), usuario),
        total=total,
        offset=offset,
        limit=limit,
    )
