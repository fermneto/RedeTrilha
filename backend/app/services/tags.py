"""Leitura do índice de tags: poemas por tag, trending, busca e o feed Explorar.

O índice (services/indice_tags.py, tabela `post_tags`) devolve só ids na
ordem certa, já recortados na página; aqui os posts da fatia vêm do banco.
"""

import re
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.indice_tags import normalizar
from app.core.marcas import texto_sem_marcas
from app.models.post import Post
from app.models.post_tag import PostTag
from app.models.user import User
from app.schemas.post import FORMAS, PostPage
from app.schemas.tags import BuscaDeTags, TagContagem, TagEncontrada, Trending
from app.services import indice_tags
from app.services.posts import para_saidas

JANELA_TRENDING = timedelta(hours=24)
# Linha só de #tags ("#saudade #mar"): não serve de trecho.
_SO_TAGS = re.compile(r"\s*#\S+(?:\s+#\S+)*\s*")
# Quantas tags a busca do Explorar mostra (o resto dos poetas e tags fica para digitar mais).
TAGS_NA_BUSCA = 5
_MAIS_NOVO_PRIMEIRO = (Post.created_at.desc(), Post.id.desc())


def posts_da_tag(
    db: Session, usuario: User, tag: str, offset: int, limit: int
) -> PostPage:
    ids, total = indice_tags.posts_da_tag(db, tag, offset, limit)
    return _pagina(db, usuario, _buscar_por_ids(db, ids), total, offset, limit)


def trending(db: Session, k: int = 5) -> Trending:
    """Top k tags dos poemas das últimas 24 h (ver indice_tags.trending).

    Cada uma vem com o primeiro verso de um poema dela, um poema diferente por
    tag (indice_tags.representantes): uma consulta só, pelos ids escolhidos.
    """
    pares = indice_tags.trending(db, datetime.now(UTC) - JANELA_TRENDING, k)
    escolhidos = indice_tags.representantes(db, [tag for tag, _ in pares])
    ids = [post_id for post_id in escolhidos.values() if post_id is not None]
    textos = textos_dos_posts(db, ids)
    return Trending(
        items=[
            TagContagem(tag=tag, contagem=n, trecho=primeiro_verso(textos.get(escolhidos[tag], "")))
            for tag, n in pares
        ]
    )


def textos_dos_posts(db: Session, ids: list[int]) -> dict[int, str]:
    """Texto de cada poema; o que foi apagado entre uma consulta e outra não vem."""
    if not ids:
        return {}
    return dict(db.execute(select(Post.id, Post.texto).where(Post.id.in_(ids))).all())


def buscar_tags(db: Session, q: str) -> BuscaDeTags:
    """Tags que começam pelo termo (normalizado), mais usadas primeiro."""
    pares = indice_tags.buscar(db, q, TAGS_NA_BUSCA)
    return BuscaDeTags(items=[TagEncontrada(tag=tag, poemas=n) for tag, n in pares])


def primeiro_verso(texto: str) -> str | None:
    """A primeira linha com texto que não seja só #tags, como foi escrita, sem as
    marcas de formatação (o Em alta mostra texto puro).

    Sem strip: o recuo é do poema.
    """
    for linha in texto_sem_marcas(texto).split("\n"):
        if linha.strip() and not _SO_TAGS.fullmatch(linha):
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
    if forma is not None:
        filtros.append(Post.forma == forma)
    contagem = select(func.count()).select_from(Post)
    consulta = select(Post)
    if tag:
        # tag + forma: JOIN com o índice, uma linha por (poema, tag).
        filtros.append(PostTag.tag == normalizar(tag))
        contagem = contagem.join(PostTag, PostTag.post_id == Post.id)
        consulta = consulta.join(PostTag, PostTag.post_id == Post.id)
    total = db.scalar(contagem.where(*filtros)) or 0
    posts = db.scalars(
        consulta.where(*filtros).order_by(*_MAIS_NOVO_PRIMEIRO).offset(offset).limit(limit)
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
