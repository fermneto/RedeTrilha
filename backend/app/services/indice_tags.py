"""O índice invertido de tags na tabela `post_tags`, sem estado no processo.

Escrita: `indexar` e `remover` rodam dentro da transação de quem publica ou
apaga o poema (services/posts.py, o importador de consagrados e o seed), então
o índice nunca fica fora de sincronia com `posts`. Nenhuma função aqui faz
commit, menos `popular`.

Leitura: cada consulta vai ao banco por um índice da tabela, e a lógica que
sobra (top-k e o poema de cada tag) é a do core/indice_tags.py. Com vários
workers ou instâncias, todos leem e escrevem o mesmo índice.
"""

from collections import defaultdict
from datetime import datetime

from sqlalchemy import ColumnElement, delete, func, insert, select
from sqlalchemy.orm import Session

from app.core import indice_tags as core
from app.models.post import Post
from app.models.post_tag import PostTag
from app.services.cursor import utc_sem_fuso

# Quantas linhas o `popular` insere por vez.
LOTE = 1000


def tags_do_post(post: Post) -> set[str]:
    """Tags do poema no índice e no PostOut: #hashtags, forma e as `tags_extras`."""
    extras = {core.normalizar(tag) for tag in post.tags_extras or ()}
    return core.extrair_tags(post.texto, post.forma) | extras


def _linhas(post: Post) -> list[dict]:
    criado_em = utc_sem_fuso(post.created_at)
    tags = {core.normalizar(tag) for tag in tags_do_post(post)} - {""}
    return [{"post_id": post.id, "tag": tag, "criado_em": criado_em} for tag in sorted(tags)]


def indexar(db: Session, post: Post) -> None:
    """Grava as tags do poema (já com id). Indexar de novo reindexa. O(t log R).

    t = tags do poema, R = linhas da tabela (cada linha entra nos índices B-tree).
    """
    remover(db, [post.id])
    linhas = _linhas(post)
    if linhas:
        db.execute(insert(PostTag), linhas)


def remover(db: Session, post_ids: list[int]) -> None:
    """Tira os poemas do índice, pelo prefixo `post_id` da chave primária. O(t log R)."""
    db.execute(delete(PostTag).where(PostTag.post_id.in_(post_ids)))


def popular(db: Session) -> int:
    """Refaz `post_tags` a partir de todos os posts, numa transação. Idempotente. O(n·t).

    Para um banco de antes desta tabela (ou depois de mexer em datas à mão).
    Devolve quantas linhas gravou.
    """
    db.execute(delete(PostTag))
    total = 0
    lote: list[dict] = []
    for post in db.scalars(select(Post).execution_options(yield_per=LOTE)):
        lote.extend(_linhas(post))
        if len(lote) >= LOTE:
            db.execute(insert(PostTag), lote)
            total += len(lote)
            lote = []
    if lote:
        db.execute(insert(PostTag), lote)
        total += len(lote)
    db.commit()
    return total


def popular_se_vazio(db: Session) -> int:
    """Popula `post_tags` só se ela está vazia e há posts (um banco antigo). Devolve as linhas.

    Chamado pelo `preparar_banco` a cada boot: num banco em dia, uma consulta.
    """
    if db.scalar(select(PostTag.post_id).limit(1)) is not None:
        return 0
    if db.scalar(select(Post.id).limit(1)) is None:
        return 0
    return popular(db)


def _sem_sublinhado() -> ColumnElement[str]:
    """A coluna `tag` sem o "_", para comparar com core.chave_da_tag."""
    return func.replace(PostTag.tag, "_", "")


def tags_equivalentes(db: Session, tag: str) -> list[str]:
    """As tags guardadas que a busca por `tag` acha: as de mesma chave, sem o "_".

    'versolivre' e 'verso_livre' acham verso_livre; se existirem noite_fria e
    noitefria, as duas. Uma consulta pelas tags distintas, O(R) (a expressão não
    usa o índice de `tag`); a página e o total, depois, vão pelo índice.
    """
    chave = core.chave_da_tag(tag)
    if not chave:
        return []
    return sorted(db.scalars(select(PostTag.tag).distinct().where(_sem_sublinhado() == chave)))


def posts_da_tag(db: Session, tag: str, offset: int, limit: int) -> tuple[list[int], int]:
    """(ids da página, total) dos poemas da tag, mais novo primeiro; empate: maior id.

    A tag passa por `chave_da_tag` ('Solidão' acha 'solidao', 'versolivre' acha
    'verso_livre'; ver tags_equivalentes). Pelo índice (tag, criado_em, post_id):
    O(log R + offset + limit) a página e O(log R + p) o total, p = poemas da tag.
    Com mais de uma tag equivalente, um poema que tem as duas conta uma vez.
    """
    alvo = PostTag.tag.in_(tags_equivalentes(db, tag))
    ids = db.scalars(
        select(PostTag.post_id)
        .where(alvo)
        .group_by(PostTag.post_id, PostTag.criado_em)
        .order_by(PostTag.criado_em.desc(), PostTag.post_id.desc())
        .offset(offset)
        .limit(limit)
    )
    total = db.scalar(select(func.count(PostTag.post_id.distinct())).where(alvo)) or 0
    return list(ids), total


def trending(db: Session, desde: datetime, k: int = 5) -> list[tuple[str, int]]:
    """Top k tags dos poemas com criado_em >= desde: maior contagem, empate alfabético.

    O banco conta por tag só as w linhas da janela (índice em criado_em), e o
    heap do core escolhe as k: O(log R + w + m log k), m = tags na janela.
    """
    contagens = db.execute(
        select(PostTag.tag, func.count())
        .where(PostTag.criado_em >= utc_sem_fuso(desde))
        .group_by(PostTag.tag)
    )
    return core.top_k(((tag, n) for tag, n in contagens), k)


def representantes(db: Session, tags: list[str]) -> dict[str, int | None]:
    """Um poema diferente por tag (já normalizada), na ordem dada (ver core.representantes).

    Só os len(tags) poemas mais novos de cada tag vêm do banco (ROW_NUMBER por
    tag, pelo índice (tag, criado_em, post_id)): O(k²) linhas para k tags.
    """
    if not tags:
        return {}
    posicao = (
        func.row_number()
        .over(
            partition_by=PostTag.tag,
            order_by=(PostTag.criado_em.desc(), PostTag.post_id.desc()),
        )
        .label("posicao")
    )
    recentes = (
        select(PostTag.tag, PostTag.post_id, PostTag.criado_em, posicao)
        .where(PostTag.tag.in_(set(tags)))
        .subquery()
    )
    candidatos: dict[str, list[tuple[int, datetime]]] = defaultdict(list)
    for tag, post_id, criado_em in db.execute(
        select(recentes.c.tag, recentes.c.post_id, recentes.c.criado_em).where(
            recentes.c.posicao <= len(tags)
        )
    ):
        candidatos[tag].append((post_id, criado_em))
    return core.representantes(candidatos, tags)


def buscar(db: Session, prefixo: str, k: int = 5) -> list[tuple[str, int]]:
    """Até k tags que começam por `prefixo`, com quantos poemas cada uma tem.

    O "_" não conta ('versol' acha verso_livre; ver core.chave_da_tag). Mais
    poemas primeiro, empate alfabético; prefixo vazio (ou só com caracteres fora
    de uma tag) não acha nada. O LIKE 'prefixo%' conta as R' linhas das tags que
    casam, e o heap do core escolhe as k: O(R + T' log k), porque o LIKE sobre a
    tag sem o "_" não usa o índice.
    """
    termo = core.chave_da_tag(prefixo)
    if not termo:
        return []
    contagens = db.execute(
        select(PostTag.tag, func.count())
        .where(_sem_sublinhado().startswith(termo, autoescape=True))
        .group_by(PostTag.tag)
    )
    return core.top_k(((tag, n) for tag, n in contagens), k)
