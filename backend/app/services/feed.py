"""Feed cronológico, como no X: poemas, reposts e rengas de quem o usuário segue, mais os dele.

Cada poema aparece uma vez só, na posição da ocorrência mais recente: o próprio
poema ou um repost puro dele (texto vazio). O item é sempre o poema original, e
`repostado_por` lista quem o repostou (seguidos e o próprio usuário), quem
repostou por último primeiro. Citação (repost com texto) é poema de quem citou
e não deduplica com o original.

Rengas entram do mesmo jeito: cada estrofe de um seguido (ou do usuário) é uma
ocorrência da renga, e a renga aparece uma vez, na estrofe mais recente, como
um repost sobe o poema. A 1ª estrofe é a abertura ("fulano abriu uma renga");
as outras, "fulano escreveu uma estrofe" (ver `RengaNoFeed`). Fechada, a renga
continua no feed, na mesma regra.

Paginação como na timeline cronológica reversa da API do X
(https://docs.x.com/x-api/posts/timelines/quickstart/reverse-chron-quickstart e
https://docs.x.com/x-api/fundamentals/pagination): até 100 itens por página,
mais novos primeiro, e um token opaco (`proximo_cursor`) que aponta para depois
do último item entregue. Com o cursor, poemas novos que chegam no topo não
deslocam a rolagem infinita. `offset` e `total` continuam valendo (o teste do
núcleo usa os dois); se vier `cursor`, ele tem precedência sobre o `offset` e o
`total` vem None (a API do X não tem total); o `offset` devolvido é a posição
real do primeiro item na lista deduplicada.

Desempate. Post e estrofe vêm de tabelas diferentes e podem ter o mesmo id e a
mesma data. A posição é (data, chave), com chave = 2·id + 1 para post e 2·id
para estrofe: única entre os dois tipos e crescente com o id dentro de cada um,
então o cursor (data, chave) continua estável e determinístico.

Custo: a deduplicação é feita em Python sobre a lista ordenada de ocorrências,
que só traz ids e datas (sem o texto dos poemas). Tempo O(n log n) pela
ordenação que intercala posts e estrofes, memória O(n), com n = posts e
estrofes dos seguidos + os do usuário, porque o `total` exato e a posição de
cada item dependem da lista inteira. Depois, uma query para os posts da
página, uma para os usuários dos rótulos e duas para as curtidas, todas
O(limit), mais o detalhe de cada renga da página.
"""

from datetime import datetime
from typing import Literal, NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.models.post import Post
from app.models.renga import EstrofeRenga
from app.models.user import User
from app.schemas.feed import FeedPage, PoemaNoFeed, RengaNoFeed
from app.schemas.user import UserOut
from app.services import rengas as rengas_service
from app.services.cursor import codificar_cursor, ler_cursor, utc_sem_fuso
from app.services.follows import ids_seguidos
from app.services.posts import para_saidas


class Ocorrencia(NamedTuple):
    """Uma linha do feed antes de deduplicar.

    Poema: `origem_id` é o post (o poema ou um repost puro) e `alvo_id` o poema
    mostrado. Renga: `origem_id` é a estrofe e `alvo_id` a renga; `abertura`
    marca a 1ª estrofe.
    """

    tipo: Literal["poema", "renga"]
    origem_id: int
    autor_id: int
    alvo_id: int
    repost_puro: bool
    abertura: bool
    created_at: datetime

    @property
    def posicao(self) -> tuple[datetime, int]:
        chave = 2 * self.origem_id + (1 if self.tipo == "poema" else 0)
        return (utc_sem_fuso(self.created_at), chave)


class Item(NamedTuple):
    """Um item do feed: a ocorrência mais recente e os autores do rótulo.

    Poema: quem repostou. Renga: quem escreveu estrofe depois da 1ª.
    """

    ocorrencia: Ocorrencia
    por: list[int]


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
    """Poemas, citações, reposts puros e rengas dos `autores`, deduplicados e paginados
    como o feed. Público para o perfil (`GET /usuarios/{username}/posts`), que passa um
    autor só."""
    ocorrencias = sorted(
        [*_ocorrencias_de_posts(db, autores), *_ocorrencias_de_rengas(db, autores)],
        key=lambda o: o.posicao,
        reverse=True,
    )
    itens = _deduplicar(ocorrencias)
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


def _ocorrencias_de_posts(db: Session, autores: list[int]) -> list[Ocorrencia]:
    """Posts dos autores. Repost puro de poema apagado fica fora."""
    original = aliased(Post)
    repost_puro = Post.repost_puro
    linhas = db.execute(
        select(Post.id, Post.autor_id, Post.repost_de_id, repost_puro, Post.created_at)
        .outerjoin(original, original.id == Post.repost_de_id)
        .where(Post.autor_id.in_(autores), ~repost_puro | original.id.is_not(None))
    )
    return [
        Ocorrencia(
            "poema", post_id, autor_id, repost_de_id if puro else post_id, bool(puro), False, criado
        )
        for post_id, autor_id, repost_de_id, puro, criado in linhas
    ]


def _ocorrencias_de_rengas(db: Session, autores: list[int]) -> list[Ocorrencia]:
    """Estrofes dos autores, cada uma uma ocorrência da renga dela."""
    linhas = db.execute(
        select(
            EstrofeRenga.id,
            EstrofeRenga.autor_id,
            EstrofeRenga.renga_id,
            EstrofeRenga.posicao,
            EstrofeRenga.created_at,
        ).where(EstrofeRenga.autor_id.in_(autores))
    )
    return [
        Ocorrencia("renga", estrofe_id, autor_id, renga_id, False, posicao == 1, criado)
        for estrofe_id, autor_id, renga_id, posicao, criado in linhas
    ]


def _deduplicar(ocorrencias: list[Ocorrencia]) -> list[Item]:
    """Um item por poema ou renga, na ocorrência mais recente, juntando os autores do
    rótulo. O(n)."""
    por_alvo: dict[tuple[str, int], Item] = {}
    for ocorrencia in ocorrencias:
        item = por_alvo.setdefault(
            (ocorrencia.tipo, ocorrencia.alvo_id), Item(ocorrencia, [])
        )
        entra_no_rotulo = ocorrencia.repost_puro or (
            ocorrencia.tipo == "renga" and not ocorrencia.abertura
        )
        if entra_no_rotulo and ocorrencia.autor_id not in item.por:
            item.por.append(ocorrencia.autor_id)
    return [_com_abertura(item) for item in por_alvo.values()]


def _com_abertura(item: Item) -> Item:
    """Renga sem estrofe de seguido depois da 1ª: o rótulo é quem a abriu."""
    if item.ocorrencia.tipo == "renga" and not item.por:
        return Item(item.ocorrencia, [item.ocorrencia.autor_id])
    return item


def _montar(db: Session, pagina: list[Item], usuario: User) -> list[PoemaNoFeed | RengaNoFeed]:
    poemas = [item for item in pagina if item.ocorrencia.tipo == "poema"]
    ids = {item.ocorrencia.alvo_id for item in poemas}
    por_id = {post.id: post for post in db.scalars(select(Post).where(Post.id.in_(ids)))}
    ids_do_rotulo = {autor_id for item in pagina for autor_id in item.por}
    usuarios = {
        user.id: UserOut.model_validate(user)
        for user in db.scalars(select(User).where(User.id.in_(ids_do_rotulo)))
    }
    saidas = iter(para_saidas(db, [por_id[item.ocorrencia.alvo_id] for item in poemas], usuario))

    itens: list[PoemaNoFeed | RengaNoFeed] = []
    for item in pagina:
        rotulo = [usuarios[autor_id] for autor_id in item.por]
        if item.ocorrencia.tipo == "poema":
            saida = next(saidas)
            itens.append(PoemaNoFeed(**{**saida.model_dump(), "repostado_por": rotulo}))
        else:
            itens.append(
                RengaNoFeed(
                    renga=rengas_service.detalhar(db, usuario, item.ocorrencia.alvo_id),
                    atividade="abriu" if item.ocorrencia.abertura else "escreveu",
                    por=rotulo,
                )
            )
    return itens
