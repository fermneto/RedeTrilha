"""Rascunhos: poemas guardados que só o autor vê, até serem publicados.

Rascunho de outra pessoa dá 404, como se não existisse. Publicar usa o mesmo
`posts.criar` do POST /posts (que indexa as tags) e apaga o rascunho na mesma
transação: o poema nasce com a data da publicação e sem versões, por mais que
o rascunho tenha sido editado.
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.rascunho import Rascunho
from app.models.user import User
from app.schemas.post import PostCreate
from app.schemas.rascunho import RascunhoCreate, RascunhoOut, RascunhoPage, RascunhoUpdate
from app.services import posts as posts_service

# O editado por último primeiro; o id desempata.
_ORDEM = (Rascunho.updated_at.desc(), Rascunho.id.desc())


def listar(db: Session, autor: User, offset: int, limit: int) -> RascunhoPage:
    filtro = Rascunho.autor_id == autor.id
    total = db.scalar(select(func.count()).select_from(Rascunho).where(filtro)) or 0
    rascunhos = db.scalars(
        select(Rascunho).where(filtro).order_by(*_ORDEM).offset(offset).limit(limit)
    )
    items = [RascunhoOut.model_validate(rascunho) for rascunho in rascunhos]
    return RascunhoPage(items=items, total=total, offset=offset, limit=limit)


def criar(db: Session, autor: User, dados: RascunhoCreate) -> Rascunho:
    rascunho = Rascunho(autor_id=autor.id, **dados.model_dump())
    db.add(rascunho)
    db.commit()
    db.refresh(rascunho)
    return rascunho


def buscar_do_autor(db: Session, autor: User, rascunho_id: int) -> Rascunho:
    """404 também para o rascunho de outra pessoa: não revela que ele existe."""
    rascunho = db.get(Rascunho, rascunho_id)
    if rascunho is None or rascunho.autor_id != autor.id:
        raise HTTPException(status_code=404, detail="rascunho não encontrado")
    return rascunho


def editar(db: Session, autor: User, rascunho_id: int, dados: RascunhoUpdate) -> Rascunho:
    rascunho = buscar_do_autor(db, autor, rascunho_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(rascunho, campo, valor)
    db.commit()
    db.refresh(rascunho)
    return rascunho


def apagar(db: Session, autor: User, rascunho_id: int) -> None:
    db.delete(buscar_do_autor(db, autor, rascunho_id))
    db.commit()


def publicar(db: Session, autor: User, rascunho_id: int) -> Post:
    """Vira poema publicado agora; o rascunho sai no mesmo commit do `posts.criar`."""
    rascunho = buscar_do_autor(db, autor, rascunho_id)
    dados = PostCreate(
        titulo=rascunho.titulo,
        texto=rascunho.texto,
        forma=rascunho.forma,
        idioma=rascunho.idioma,
    )
    db.delete(rascunho)
    return posts_service.criar(db, autor, dados)
