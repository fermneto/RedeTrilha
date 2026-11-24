"""Sugestões de quem seguir: a tela depois do cadastro (e o link no Descobrir).

PROVISÓRIO (o Neto decide quais contas e em que ordem): entram todas as contas
com pelo menos um poema (a conta do perfil: poemas, citações e rengas), menos a
própria pessoa e quem ela já segue. Poetas da rede e consagrados vêm
intercalados, um de cada (`core/mistura.intercalar`), cada grupo do poema mais
recente para o mais antigo, sem ranking por seguidores ou curtidas (decisão 3).
Sem a intercalação, os consagrados, com milhares de poemas espalhados pelos
últimos 30 dias, ocupariam a página toda.

Custo: uma query agregada com (id, consagrado, data do último poema) de todas
as contas com poema, O(u log u) para ordenar as u contas, e depois três
queries O(limit) para a página (usuários, contagens e o último poema de cada).
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.mistura import intercalar
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User
from app.schemas.sugestao import SugestaoOut, SugestaoPage
from app.schemas.user import UserOut
from app.services.perfil import poemas_por_autor

# PROVISÓRIO: quantos versos do último poema vão no card.
VERSOS_NO_TRECHO = 2


def sugestoes(db: Session, usuario: User, offset: int, limit: int) -> SugestaoPage:
    ordem = _ordem(db, usuario)
    ids = ordem[offset : offset + limit]
    return SugestaoPage(items=_montar(db, ids), total=len(ordem), offset=offset, limit=limit)


def _ordem(db: Session, usuario: User) -> list[int]:
    """Ids das contas sugeridas, na ordem da tela."""
    poemas = poemas_por_autor()
    ultimo = (
        select(Post.autor_id.label("user_id"), func.max(Post.created_at).label("em"))
        .where(~Post.repost_puro)
        .group_by(Post.autor_id)
        .subquery()
    )
    seguidos = select(Follow.seguido_id).where(Follow.seguidor_id == usuario.id)
    linhas = db.execute(
        select(User.id, User.consagrado, ultimo.c.em)
        .join(poemas, poemas.c.user_id == User.id)
        .outerjoin(ultimo, ultimo.c.user_id == User.id)
        .where(poemas.c.n > 0, User.id != usuario.id, User.id.not_in(seguidos))
    ).all()
    # Quem só escreveu em rengas (sem data de poema) vai para o fim do grupo.
    linhas.sort(key=lambda linha: (linha.em is not None, linha.em or 0, linha.id), reverse=True)
    comuns = [linha.id for linha in linhas if not linha.consagrado]
    consagrados = [linha.id for linha in linhas if linha.consagrado]
    return intercalar(comuns, consagrados)


def _montar(db: Session, ids: list[int]) -> list[SugestaoOut]:
    if not ids:
        return []
    usuarios = {user.id: user for user in db.scalars(select(User).where(User.id.in_(ids)))}
    poemas = poemas_por_autor()
    contagens = dict(
        db.execute(select(poemas.c.user_id, poemas.c.n).where(poemas.c.user_id.in_(ids))).all()
    )
    trechos = _trechos(db, ids)
    return [
        SugestaoOut(
            **UserOut.model_validate(usuarios[user_id]).model_dump(),
            poemas=contagens.get(user_id, 0),
            trecho=trechos.get(user_id),
        )
        for user_id in ids
    ]


def _trechos(db: Session, ids: list[int]) -> dict[int, str]:
    """Os primeiros versos do poema mais recente de cada conta, numa query só."""
    numerados = (
        select(
            Post.autor_id,
            Post.texto,
            func.row_number()
            .over(partition_by=Post.autor_id, order_by=(Post.created_at.desc(), Post.id.desc()))
            .label("ordem"),
        )
        .where(Post.autor_id.in_(ids), ~Post.repost_puro)
        .subquery()
    )
    linhas = db.execute(
        select(numerados.c.autor_id, numerados.c.texto).where(numerados.c.ordem == 1)
    )
    # As linhas saem como estão gravadas: sem strip, os recuos são do poema.
    return {
        autor_id: "\n".join(texto.split("\n")[:VERSOS_NO_TRECHO]) for autor_id, texto in linhas
    }
