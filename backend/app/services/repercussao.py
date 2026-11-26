"""A repercussão de um poema ou de uma renga, na página da publicação: quem curtiu,
quem repostou e as publicações que a citaram.

Vale o que já vale na leitura: repost puro mostra a repercussão do original
(é para onde vão a curtida, o repost e a citação); 404 se o autor (na renga, o
criador) bloqueou quem vê; e quem tem bloqueio com quem vê fica fora das listas,
como nos seguidores (services/follows.py). As listas vêm da ação mais recente
para a mais antiga.
"""

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.citacao_renga import CitacaoRenga
from app.models.curtida import Curtida
from app.models.curtida_renga import CurtidaRenga
from app.models.post import Post
from app.models.repost_renga import RepostRenga
from app.models.user import User
from app.schemas.post import PostPage
from app.schemas.user import UserPage
from app.services import bloqueios, posts, rengas


def curtidas_do_poema(db: Session, usuario: User, post_id: int, offset: int, limit: int) -> UserPage:
    poema = _poema(db, usuario, post_id)
    consulta = (
        select(User)
        .join(Curtida, Curtida.user_id == User.id)
        .where(Curtida.post_id == poema.id)
        .order_by(Curtida.created_at.desc(), Curtida.id.desc())
    )
    return _pessoas(db, usuario, consulta, offset, limit)


def reposts_do_poema(db: Session, usuario: User, post_id: int, offset: int, limit: int) -> UserPage:
    """Quem fez repost puro; quem citou está nas citações."""
    poema = _poema(db, usuario, post_id)
    consulta = (
        select(User)
        .join(Post, Post.autor_id == User.id)
        .where(Post.repost_de_id == poema.id, Post.repost_puro)
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    return _pessoas(db, usuario, consulta, offset, limit)


def citacoes_do_poema(db: Session, usuario: User, post_id: int, offset: int, limit: int) -> PostPage:
    poema = _poema(db, usuario, post_id)
    consulta = select(Post).where(Post.repost_de_id == poema.id, ~Post.repost_puro)
    return _citacoes(db, usuario, consulta, offset, limit)


def curtidas_da_renga(db: Session, usuario: User, renga_id: int, offset: int, limit: int) -> UserPage:
    renga = _renga(db, usuario, renga_id)
    consulta = (
        select(User)
        .join(CurtidaRenga, CurtidaRenga.user_id == User.id)
        .where(CurtidaRenga.renga_id == renga.id)
        .order_by(CurtidaRenga.created_at.desc(), CurtidaRenga.id.desc())
    )
    return _pessoas(db, usuario, consulta, offset, limit)


def reposts_da_renga(db: Session, usuario: User, renga_id: int, offset: int, limit: int) -> UserPage:
    renga = _renga(db, usuario, renga_id)
    consulta = (
        select(User)
        .join(RepostRenga, RepostRenga.user_id == User.id)
        .where(RepostRenga.renga_id == renga.id)
        .order_by(RepostRenga.created_at.desc(), RepostRenga.id.desc())
    )
    return _pessoas(db, usuario, consulta, offset, limit)


def citacoes_da_renga(db: Session, usuario: User, renga_id: int, offset: int, limit: int) -> PostPage:
    renga = _renga(db, usuario, renga_id)
    consulta = (
        select(Post)
        .join(CitacaoRenga, CitacaoRenga.post_id == Post.id)
        .where(CitacaoRenga.renga_id == renga.id)
    )
    return _citacoes(db, usuario, consulta, offset, limit)


def _poema(db: Session, usuario: User, post_id: int) -> Post:
    """O original (repost puro → o poema repostado), se quem pede pode vê-lo."""
    original = posts.original_de(db, post_id)
    bloqueios.garantir_que_ve(db, usuario.id, original.autor_id, "poema não encontrado")
    return original


def _renga(db: Session, usuario: User, renga_id: int):
    renga = rengas.buscar(db, renga_id)
    bloqueios.garantir_que_ve(db, usuario.id, renga.criador_id, "renga não encontrada")
    return renga


def _pessoas(db: Session, usuario: User, consulta: Select, offset: int, limit: int) -> UserPage:
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    if bloqueados:
        consulta = consulta.where(User.id.not_in(bloqueados))
    total = db.scalar(select(func.count()).select_from(consulta.order_by(None).subquery())) or 0
    items = list(db.scalars(consulta.offset(offset).limit(limit)))
    return UserPage(items=items, total=total, offset=offset, limit=limit)


def _citacoes(db: Session, usuario: User, consulta: Select, offset: int, limit: int) -> PostPage:
    """As citações, a mais nova primeiro, sem as de quem tem bloqueio com quem vê."""
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    if bloqueados:
        consulta = consulta.where(Post.autor_id.not_in(bloqueados))
    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
    pagina = list(
        db.scalars(consulta.order_by(Post.created_at.desc(), Post.id.desc()).offset(offset).limit(limit))
    )
    return PostPage(items=posts.para_saidas(db, pagina, usuario), total=total, offset=offset, limit=limit)
