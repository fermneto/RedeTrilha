"""Feed cronológico, como no X: poemas e reposts de quem o usuário segue, mais os dele.

Cada poema aparece uma vez só, na posição da ocorrência mais recente: o próprio
poema ou um repost puro dele (texto vazio). Quando essa ocorrência é um repost,
o item é o poema original com `repostado_por` preenchido. Citação (repost com
texto) é poema de quem citou e não deduplica com o original.

A deduplicação é feita em Python sobre a lista ordenada de ocorrências, que só
traz ids (sem o texto dos poemas):
- tempo O(n) e memória O(n), com n = posts dos seguidos + os do usuário, porque
  o `total` precisa contar os itens já deduplicados;
- depois, uma query para os O(limit) posts da página e duas para as curtidas.
Se n crescer muito, o caminho é paginar por cursor (created_at, id) em vez de
offset, e aí o `total` deixa de ser exato.
"""

from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostOut, PostPage
from app.schemas.user import UserOut
from app.services.follows import ids_seguidos
from app.services.posts import para_saidas


class Ocorrencia(NamedTuple):
    """Uma linha do feed antes de deduplicar."""

    post_id: int
    poema_id: int
    repost_puro: bool


def feed(db: Session, usuario: User, offset: int, limit: int) -> PostPage:
    itens = _deduplicar(_ocorrencias(db, [*ids_seguidos(db, usuario.id), usuario.id]))
    pagina = itens[offset : offset + limit]
    return PostPage(
        items=_montar(db, pagina, usuario),
        total=len(itens),
        offset=offset,
        limit=limit,
    )


def _ocorrencias(db: Session, autores: list[int]) -> list[Ocorrencia]:
    """Posts dos autores, mais novo primeiro. Repost puro de poema apagado fica fora."""
    original = aliased(Post)
    repost_puro = (Post.repost_de_id.is_not(None)) & (Post.texto == "")
    linhas = db.execute(
        select(Post.id, Post.repost_de_id, repost_puro)
        .outerjoin(original, original.id == Post.repost_de_id)
        .where(Post.autor_id.in_(autores), ~repost_puro | original.id.is_not(None))
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    return [
        Ocorrencia(post_id, repost_de_id if puro else post_id, bool(puro))
        for post_id, repost_de_id, puro in linhas
    ]


def _deduplicar(ocorrencias: list[Ocorrencia]) -> list[Ocorrencia]:
    """Fica a primeira (mais recente) ocorrência de cada poema. O(n)."""
    vistos: set[int] = set()
    itens = []
    for ocorrencia in ocorrencias:
        if ocorrencia.poema_id not in vistos:
            vistos.add(ocorrencia.poema_id)
            itens.append(ocorrencia)
    return itens


def _montar(db: Session, pagina: list[Ocorrencia], usuario: User) -> list[PostOut]:
    ids = {o.post_id for o in pagina} | {o.poema_id for o in pagina}
    por_id = {post.id: post for post in db.scalars(select(Post).where(Post.id.in_(ids)))}
    saidas = para_saidas(db, [por_id[o.poema_id] for o in pagina], usuario)
    return [
        saida.model_copy(
            update={"repostado_por": UserOut.model_validate(por_id[o.post_id].autor)}
        )
        if o.repost_puro
        else saida
        for saida, o in zip(saidas, pagina)
    ]
