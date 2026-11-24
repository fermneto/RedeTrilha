from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.indice_tags import extrair_tags, indice_tags
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostOut, PostUpdate
from app.schemas.user import UserOut


def para_saida(post: Post, incluir_repost: bool = True) -> PostOut:
    """Monta o PostOut. `repost_de` vem com um nível só."""
    original = post.repost_de if incluir_repost else None
    return PostOut(
        id=post.id,
        autor_id=post.autor_id,
        titulo=post.titulo,
        texto=post.texto,
        forma=post.forma,
        obra=post.obra,
        ano=post.ano,
        fonte=post.fonte,
        repost_de_id=post.repost_de_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        autor=UserOut.model_validate(post.autor),
        repost_de=para_saida(original, incluir_repost=False) if original else None,
        tags=sorted(extrair_tags(post.texto, post.forma)),
    )


def buscar(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="poema não encontrado")
    return post


def criar(db: Session, autor: User, dados: PostCreate) -> Post:
    post = Post(autor_id=autor.id, **dados.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    _indexar(post)
    return post


def editar(db: Session, usuario: User, post_id: int, dados: PostUpdate) -> Post:
    post = _buscar_do_autor(db, usuario, post_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(post, campo, valor)
    db.commit()
    db.refresh(post)
    _indexar(post)
    return post


def apagar(db: Session, usuario: User, post_id: int) -> None:
    post = _buscar_do_autor(db, usuario, post_id)
    db.delete(post)
    db.commit()
    indice_tags.remover(post_id)


def reconstruir_indice(db: Session) -> None:
    """Chamado no startup: o índice de tags vive em memória."""
    linhas = db.execute(select(Post.id, Post.texto, Post.forma, Post.created_at))
    indice_tags.reconstruir(
        [
            (post_id, extrair_tags(texto, forma), criado_em)
            for post_id, texto, forma, criado_em in linhas
        ]
    )


def _buscar_do_autor(db: Session, usuario: User, post_id: int) -> Post:
    post = buscar(db, post_id)
    if post.autor_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o autor pode alterar o poema")
    return post


def _indexar(post: Post) -> None:
    indice_tags.indexar(post.id, extrair_tags(post.texto, post.forma), post.created_at)
