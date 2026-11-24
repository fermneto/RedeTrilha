"""Perfil do poeta (P4): contagens, edição do próprio perfil e a lista de poemas.

Fica fora de services/users.py porque usa services/follows.py, que importa
users.py (o import seria circular).
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.post import Post
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
    """Como no X: poemas, citações e reposts puros da pessoa, mais novo primeiro.
    O repost puro aparece como o original com `repostado_por` = [a pessoa]."""
    pessoa = buscar_por_username(db, username)
    return pagina_dos_autores(db, [pessoa.id], usuario, offset, limit, cursor)


def poemas_por_autor():
    """Subquery (user_id, n) com os poemas autorais de cada autor (a mesma regra do
    `_contar_poemas`), para juntar numa listagem sem N+1. Use coalesce para quem tem 0."""
    return (
        select(Post.autor_id.label("user_id"), func.count().label("n"))
        .where(~Post.repost_puro)
        .group_by(Post.autor_id)
        .subquery()
    )


def _contar_poemas(db: Session, user_id: int) -> int:
    """Poemas autorais: tudo o que a pessoa escreveu, menos os reposts puros."""
    return db.scalar(
        select(func.count())
        .select_from(Post)
        .where(Post.autor_id == user_id, ~Post.repost_puro)
    ) or 0


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
