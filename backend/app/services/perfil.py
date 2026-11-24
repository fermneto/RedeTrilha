"""Perfil do poeta (P4): contagens, edição do próprio perfil e a lista de poemas.

Fica fora de services/users.py porque usa services/follows.py, que importa
users.py (o import seria circular).
"""

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.post import Post
from app.models.renga import EstrofeRenga
from app.models.user import User
from app.schemas.feed import FeedPage
from app.schemas.user import PerfilOut, PerfilUpdate, UserOut
from app.services.feed import pagina_dos_autores
from app.services.follows import contar_seguidores, contar_seguindo
from app.services.users import buscar_por_username


def perfil(db: Session, username: str, usuario: User) -> PerfilOut:
    pessoa = buscar_por_username(db, username)
    return _montar(db, pessoa, usuario)


def editar(db: Session, usuario: User, dados: PerfilUpdate) -> PerfilOut:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    return _montar(db, usuario, usuario)


def poemas(
    db: Session, username: str, usuario: User, offset: int, limit: int, cursor: str | None
) -> FeedPage:
    """Como no X: poemas, citações, reposts puros e rengas da pessoa, mais novo primeiro.
    O repost puro aparece como o original com `repostado_por` = [a pessoa]; a renga,
    na estrofe mais recente dela, como um repost."""
    pessoa = buscar_por_username(db, username)
    # O encerramento sobe a renga no feed, mas no perfil vale a estrofe mais recente.
    return pagina_dos_autores(
        db, [pessoa.id], usuario, offset, limit, cursor, com_encerramentos=False
    )


def poemas_por_autor():
    """Subquery (user_id, n) com os poemas autorais de cada autor (a mesma regra do
    `_contar_poemas`), para juntar numa listagem sem N+1. Use coalesce para quem tem 0."""
    posts = select(Post.autor_id.label("user_id"), func.count().label("n")).where(
        ~Post.repost_puro
    ).group_by(Post.autor_id)
    rengas = select(
        EstrofeRenga.autor_id.label("user_id"),
        func.count(func.distinct(EstrofeRenga.renga_id)).label("n"),
    ).group_by(EstrofeRenga.autor_id)
    juntos = posts.union_all(rengas).subquery()
    # cast: no Postgres, o sum de count vem como numeric.
    return (
        select(juntos.c.user_id, cast(func.sum(juntos.c.n), Integer).label("n"))
        .group_by(juntos.c.user_id)
        .subquery()
    )


def _contar_poemas(db: Session, user_id: int) -> int:
    """Poemas autorais: tudo o que a pessoa escreveu, menos os reposts puros, mais
    uma por renga de que participou (criou ou escreveu estrofe; quem cria escreve a 1ª)."""
    posts = db.scalar(
        select(func.count())
        .select_from(Post)
        .where(Post.autor_id == user_id, ~Post.repost_puro)
    ) or 0
    rengas = db.scalar(
        select(func.count(func.distinct(EstrofeRenga.renga_id))).where(
            EstrofeRenga.autor_id == user_id
        )
    ) or 0
    return posts + rengas


def _montar(db: Session, pessoa: User, usuario: User) -> PerfilOut:
    sigo = db.scalar(
        select(Follow.id).where(
            Follow.seguidor_id == usuario.id, Follow.seguido_id == pessoa.id
        )
    )
    return PerfilOut(
        **UserOut.model_validate(pessoa).model_dump(),
        seguidores=contar_seguidores(db, pessoa.id),
        seguindo=contar_seguindo(db, pessoa.id),
        poemas=_contar_poemas(db, pessoa.id),
        sigo=sigo is not None,
    )
