"""Leitura do índice de tags: poemas por tag, trending, busca e o feed Explorar.

O índice (core/indice_tags.py) devolve só ids na ordem certa; aqui a página
é recortada antes de ir ao banco, que busca só a fatia.
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.indice_tags import indice_tags
from app.models.post import Post
from app.models.user import User
from app.schemas.post import FORMAS, PostPage
from app.schemas.tags import BuscaDeTags, TagContagem, TagEncontrada, Trending
from app.services.posts import para_saidas

JANELA_TRENDING = timedelta(hours=24)
# Quantas tags a busca do Explorar mostra (o resto dos poetas e tags fica para digitar mais).
TAGS_NA_BUSCA = 5
_MAIS_NOVO_PRIMEIRO = (Post.created_at.desc(), Post.id.desc())


def posts_da_tag(
    db: Session, usuario: User, tag: str, offset: int, limit: int
) -> PostPage:
    ids = indice_tags.posts_da_tag(tag)
    fatia = _buscar_por_ids(db, ids[offset : offset + limit])
    return _pagina(db, usuario, fatia, len(ids), offset, limit)


def trending(db: Session) -> Trending:
    """Top 5 tags dos poemas das últimas 24 h (ver IndiceTags.trending).

    Cada uma vem com o primeiro verso do poema mais novo que a usou: uma
    consulta só, pelos ids que o índice devolve.
    """
    pares = indice_tags.trending(datetime.now(UTC) - JANELA_TRENDING)
    recentes = {tag: indice_tags.mais_recente(tag) for tag, _ in pares}
    ids = [post_id for post_id in recentes.values() if post_id is not None]
    textos = dict(db.execute(select(Post.id, Post.texto).where(Post.id.in_(ids))).all()) if ids else {}
    return Trending(
        items=[
            TagContagem(tag=tag, contagem=n, trecho=primeiro_verso(textos.get(recentes[tag], "")))
            for tag, n in pares
        ]
    )


def buscar_tags(q: str) -> BuscaDeTags:
    """Tags que começam pelo termo (normalizado), mais usadas primeiro."""
    pares = indice_tags.buscar(q, TAGS_NA_BUSCA)
    return BuscaDeTags(items=[TagEncontrada(tag=tag, poemas=n) for tag, n in pares])


def primeiro_verso(texto: str) -> str | None:
    """A primeira linha com texto, como foi escrita (sem strip: o recuo é do poema)."""
    for linha in texto.split("\n"):
        if linha.strip():
            return linha.removesuffix("\r")
    return None


def explorar(
    db: Session,
    usuario: User,
    tag: str | None,
    forma: str | None,
    offset: int,
    limit: int,
) -> PostPage:
    """Poemas de todos, mais novo primeiro; `tag` e `forma` juntos fazem interseção."""
    if forma is not None and forma not in FORMAS:
        raise HTTPException(
            status_code=422, detail=f"forma deve ser uma de: {', '.join(FORMAS)}"
        )
    if tag and forma is None:
        return posts_da_tag(db, usuario, tag, offset, limit)

    # Repost puro (texto vazio) só faz sentido no feed.
    filtros = [~Post.repost_puro]
    if tag:
        filtros.append(Post.id.in_(indice_tags.posts_da_tag(tag)))
    if forma is not None:
        filtros.append(Post.forma == forma)
    total = db.scalar(select(func.count()).select_from(Post).where(*filtros)) or 0
    posts = db.scalars(
        select(Post)
        .where(*filtros)
        .order_by(*_MAIS_NOVO_PRIMEIRO)
        .offset(offset)
        .limit(limit)
    )
    return _pagina(db, usuario, list(posts), total, offset, limit)


def _buscar_por_ids(db: Session, ids: list[int]) -> list[Post]:
    """Busca os posts e devolve na ordem de `ids` (a do índice)."""
    if not ids:
        return []
    por_id = {post.id: post for post in db.scalars(select(Post).where(Post.id.in_(ids)))}
    return [por_id[post_id] for post_id in ids if post_id in por_id]


def _pagina(
    db: Session, usuario: User, posts: list[Post], total: int, offset: int, limit: int
) -> PostPage:
    """Monta a página com curtidas e `curti` do usuário, contadas em lote."""
    return PostPage(
        items=para_saidas(db, posts, usuario),
        total=total,
        offset=offset,
        limit=limit,
    )
