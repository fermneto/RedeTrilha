"""Histórico de versões de um poema publicado, visível só para o autor.

As versões nascem em `posts.editar` (cada edição de título, texto ou forma
guarda como o poema era) e somem em `posts.apagar`.
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.user import User
from app.models.versao_poema import VersaoPoema
from app.schemas.versao_poema import VersaoOut, VersaoPage

# A mais recente primeiro; o id desempata edições no mesmo instante.
_ORDEM = (VersaoPoema.criada_em.desc(), VersaoPoema.id.desc())


def listar(db: Session, usuario: User, post_id: int, offset: int, limit: int) -> VersaoPage:
    """404 para quem não é o autor, como se o histórico não existisse."""
    post = db.get(Post, post_id)
    if post is None or post.autor_id != usuario.id:
        raise HTTPException(status_code=404, detail="poema não encontrado")
    filtro = VersaoPoema.post_id == post_id
    total = db.scalar(select(func.count()).select_from(VersaoPoema).where(filtro)) or 0
    versoes = db.scalars(
        select(VersaoPoema).where(filtro).order_by(*_ORDEM).offset(offset).limit(limit)
    )
    items = [VersaoOut.model_validate(versao) for versao in versoes]
    return VersaoPage(items=items, total=total, offset=offset, limit=limit)
