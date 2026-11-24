from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import arvore_comentarios
from app.models.comentario import Comentario
from app.models.user import User
from app.schemas.comentario import ComentarioArvore, ComentarioCreate, ComentarioOut
from app.schemas.user import UserOut
from app.services.posts import buscar


def comentar(db: Session, autor: User, post_id: int, dados: ComentarioCreate) -> ComentarioOut:
    """Comentário na raiz ou resposta. Pai inexistente ou de outro poema dá 404."""
    buscar(db, post_id)
    if dados.parent_id is not None:
        pai = db.get(Comentario, dados.parent_id)
        if pai is None or pai.post_id != post_id:
            raise HTTPException(status_code=404, detail="comentário pai não encontrado")
    comentario = Comentario(
        post_id=post_id, autor_id=autor.id, texto=dados.texto, parent_id=dados.parent_id
    )
    db.add(comentario)
    db.commit()
    db.refresh(comentario)
    return _para_saida(comentario, [])


def arvore(db: Session, post_id: int) -> ComentarioArvore:
    """Uma query com os comentários do poema; a árvore é montada em core/ (O(n))."""
    buscar(db, post_id)
    comentarios = db.scalars(
        select(Comentario)
        .where(Comentario.post_id == post_id)
        .order_by(Comentario.created_at, Comentario.id)
    )
    raizes = arvore_comentarios.montar(
        [(c.id, c.parent_id, c.created_at, c) for c in comentarios]
    )
    return ComentarioArvore(items=[_saida_do_no(no) for no in raizes])


def _saida_do_no(no: arvore_comentarios.No) -> ComentarioOut:
    return _para_saida(no.payload, [_saida_do_no(filho) for filho in no.respostas])


def _para_saida(comentario: Comentario, respostas: list[ComentarioOut]) -> ComentarioOut:
    return ComentarioOut(
        id=comentario.id,
        texto=comentario.texto,
        autor=UserOut.model_validate(comentario.autor),
        parent_id=comentario.parent_id,
        created_at=comentario.created_at,
        respostas=respostas,
    )
