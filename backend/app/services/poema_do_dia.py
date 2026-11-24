"""Poema do dia: um poema de consagrado, o mesmo para todo mundo no mesmo dia UTC.

A escolha é determinística: o sha256 da data (AAAA-MM-DD) módulo a quantidade
de poemas de consagrados, ordenados por id. Sem estado guardado: o mesmo dia
dá o mesmo poema enquanto o acervo não mudar.
"""

import hashlib
from datetime import UTC, date, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostOut
from app.services.posts import para_saida_de


def indice_do_dia(dia: date, quantidade: int) -> int:
    """Posição do poema do dia numa lista de `quantidade` poemas (hash estável, não o hash() do Python)."""
    resumo = hashlib.sha256(dia.isoformat().encode()).digest()
    return int.from_bytes(resumo, "big") % quantidade


def _dos_consagrados():
    # Só poemas originais: consagrados não repostam, mas o filtro deixa isso explícito.
    return (
        select(Post)
        .join(User, Post.autor_id == User.id)
        .where(User.consagrado.is_(True), Post.repost_de_id.is_(None))
    )


def poema_do_dia(db: Session, usuario: User, dia: date | None = None) -> PostOut:
    dia = dia or datetime.now(UTC).date()
    consulta = _dos_consagrados()
    quantidade = db.scalar(select(func.count()).select_from(consulta.subquery()))
    if not quantidade:
        raise HTTPException(status_code=404, detail="nenhum poema de consagrado ainda")
    posicao = indice_do_dia(dia, quantidade)
    post = db.scalar(consulta.order_by(Post.id).offset(posicao).limit(1))
    return para_saida_de(db, post, usuario)
