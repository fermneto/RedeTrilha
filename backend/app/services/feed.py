"""Feed cronológico, como no X: poemas e reposts de quem o usuário segue, mais os dele.

Cada poema aparece uma vez só, na posição da ocorrência mais recente: o próprio
poema ou um repost puro dele (texto vazio). O item é sempre o poema original, e
`repostado_por` lista quem o repostou (seguidos e o próprio usuário), quem
repostou por último primeiro. Citação (repost com texto) é poema de quem citou
e não deduplica com o original.

Paginação como na timeline cronológica reversa da API do X
(https://docs.x.com/x-api/posts/timelines/quickstart/reverse-chron-quickstart e
https://docs.x.com/x-api/fundamentals/pagination): até 100 itens por página,
mais novos primeiro, e um token opaco (`proximo_cursor`) que aponta para depois
do último item entregue. Com o cursor, poemas novos que chegam no topo não
deslocam a rolagem infinita. `offset` e `total` continuam valendo (o teste do
núcleo usa os dois); se vier `cursor`, ele tem precedência sobre o `offset` e o
`total` vem None (a API do X não tem total); o `offset` devolvido é a posição
real do primeiro item na lista deduplicada.

Custo: a deduplicação é feita em Python sobre a lista ordenada de ocorrências,
que só traz ids e datas (sem o texto dos poemas). Tempo e memória O(n), com
n = posts dos seguidos + os do usuário, porque o `total` exato e a posição de
cada poema dependem da lista inteira. Depois, uma query para os posts da
página, uma para quem repostou e duas para as curtidas, todas O(limit).
"""

from datetime import datetime
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.models.post import Post
from app.models.user import User
from app.schemas.feed import FeedPage
from app.schemas.post import PostOut
from app.schemas.user import UserOut
from app.services.cursor import codificar_cursor, ler_cursor, utc_sem_fuso
from app.services.follows import ids_seguidos
from app.services.posts import para_saidas


class Ocorrencia(NamedTuple):
    """Uma linha do feed antes de deduplicar: um post e o poema que ele mostra."""

    post_id: int
    autor_id: int
    poema_id: int
    repost_puro: bool
    created_at: datetime

    @property
    def posicao(self) -> tuple[datetime, int]:
        return (utc_sem_fuso(self.created_at), self.post_id)


class Item(NamedTuple):
    """Um poema do feed: a ocorrência mais recente e quem o repostou."""

    ocorrencia: Ocorrencia
    reposters: list[int]


def feed(
    db: Session, usuario: User, offset: int, limit: int, cursor: str | None = None
) -> FeedPage:
    return pagina_dos_autores(
        db, [*ids_seguidos(db, usuario.id), usuario.id], usuario, offset, limit, cursor
    )


def pagina_dos_autores(
    db: Session,
    autores: list[int],
    usuario: User,
    offset: int,
    limit: int,
    cursor: str | None = None,
) -> FeedPage:
    """Poemas, citações e reposts puros dos `autores`, deduplicados e paginados como o
    feed. Público para o perfil (`GET /usuarios/{username}/posts`), que passa um autor só."""
    itens = _deduplicar(_ocorrencias(db, autores))
    if cursor is not None:
        depois = ler_cursor(cursor)
        offset = next(
            (i for i, item in enumerate(itens) if item.ocorrencia.posicao < depois),
            len(itens),
        )
    pagina = itens[offset : offset + limit]
    tem_mais = offset + limit < len(itens)
    return FeedPage(
        items=_montar(db, pagina, usuario),
        total=None if cursor is not None else len(itens),
        offset=offset,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(*pagina[-1].ocorrencia.posicao) if pagina and tem_mais else None
        ),
    )


def _ocorrencias(db: Session, autores: list[int]) -> list[Ocorrencia]:
    """Posts dos autores, mais novo primeiro. Repost puro de poema apagado fica fora."""
    original = aliased(Post)
    repost_puro = (Post.repost_de_id.is_not(None)) & (Post.texto == "")
    linhas = db.execute(
        select(Post.id, Post.autor_id, Post.repost_de_id, repost_puro, Post.created_at)
        .outerjoin(original, original.id == Post.repost_de_id)
        .where(Post.autor_id.in_(autores), ~repost_puro | original.id.is_not(None))
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    return [
        Ocorrencia(post_id, autor_id, repost_de_id if puro else post_id, bool(puro), criado)
        for post_id, autor_id, repost_de_id, puro, criado in linhas
    ]


def _deduplicar(ocorrencias: list[Ocorrencia]) -> list[Item]:
    """Um item por poema, na ocorrência mais recente, juntando quem repostou. O(n)."""
    por_poema: dict[int, Item] = {}
    for ocorrencia in ocorrencias:
        item = por_poema.setdefault(ocorrencia.poema_id, Item(ocorrencia, []))
        if ocorrencia.repost_puro and ocorrencia.autor_id not in item.reposters:
            item.reposters.append(ocorrencia.autor_id)
    return list(por_poema.values())


def _montar(db: Session, pagina: list[Item], usuario: User) -> list[PostOut]:
    ids = {item.ocorrencia.poema_id for item in pagina}
    por_id = {post.id: post for post in db.scalars(select(Post).where(Post.id.in_(ids)))}
    ids_reposters = {autor_id for item in pagina for autor_id in item.reposters}
    reposters = {
        user.id: UserOut.model_validate(user)
        for user in db.scalars(select(User).where(User.id.in_(ids_reposters)))
    }
    saidas = para_saidas(db, [por_id[item.ocorrencia.poema_id] for item in pagina], usuario)
    return [
        saida.model_copy(
            update={"repostado_por": [reposters[autor_id] for autor_id in item.reposters]}
        )
        for saida, item in zip(saidas, pagina)
    ]
