from fastapi import HTTPException
from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.user import User
from app.schemas.user import UserPage
from app.services import avisos, bloqueios
from app.services.users import buscar_por_username, visivel_por_username


def seguir(db: Session, seguidor: User, username: str) -> None:
    """Idempotente: seguir quem já segue não faz nada."""
    seguido = buscar_por_username(db, username)
    if seguido.id == seguidor.id:
        raise HTTPException(status_code=422, detail="não dá para seguir a si mesmo")
    bloqueios.garantir_interacao(db, seguidor.id, seguido.id, "usuário não encontrado")

    ja_segue = db.scalar(
        select(Follow).where(
            Follow.seguidor_id == seguidor.id, Follow.seguido_id == seguido.id
        )
    )
    if ja_segue is None:
        db.add(Follow(seguidor_id=seguidor.id, seguido_id=seguido.id))
        avisos.avisar(db, seguidor, [(seguido.id, "seguidor")])
        db.commit()


def deixar_de_seguir(db: Session, seguidor: User, username: str) -> None:
    """Idempotente: deixar de seguir quem não segue não faz nada."""
    seguido = buscar_por_username(db, username)
    db.execute(
        delete(Follow).where(
            Follow.seguidor_id == seguidor.id, Follow.seguido_id == seguido.id
        )
    )
    avisos.desfazer(db, "seguidor", seguidor.id, destinatario_id=seguido.id)
    db.commit()


def contar_seguidores(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Follow).where(Follow.seguido_id == user_id)
    ) or 0


def contar_seguindo(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Follow).where(Follow.seguidor_id == user_id)
    ) or 0


def seguidores_por_usuario():
    """Subquery (user_id, n) com os seguidores de cada um, para juntar numa listagem
    sem uma contagem por linha (N+1). Quem não tem seguidor não aparece: use coalesce."""
    return (
        select(Follow.seguido_id.label("user_id"), func.count().label("n"))
        .group_by(Follow.seguido_id)
        .subquery()
    )


def seguidos_entre(db: Session, user_id: int, ids: list[int]) -> set[int]:
    """Quais destes ids o usuário segue, numa consulta só (o `sigo` de uma página)."""
    if not ids:
        return set()
    return set(
        db.scalars(
            select(Follow.seguido_id).where(
                Follow.seguidor_id == user_id, Follow.seguido_id.in_(ids)
            )
        )
    )


def ids_seguidos(db: Session, user_id: int) -> list[int]:
    """Quem o usuário segue. Usado pelo feed."""
    return list(db.scalars(select(Follow.seguido_id).where(Follow.seguidor_id == user_id)))


def listar_seguidores(
    db: Session, usuario: User, username: str, offset: int, limit: int
) -> UserPage:
    user = visivel_por_username(db, usuario, username)
    filtro = _sem_bloqueados(db, usuario, Follow.seguido_id == user.id, Follow.seguidor_id)
    return _pagina(db, filtro, Follow.seguidor_id, offset, limit)


def listar_seguindo(db: Session, usuario: User, username: str, offset: int, limit: int) -> UserPage:
    user = visivel_por_username(db, usuario, username)
    filtro = _sem_bloqueados(db, usuario, Follow.seguidor_id == user.id, Follow.seguido_id)
    return _pagina(db, filtro, Follow.seguido_id, offset, limit)


def _sem_bloqueados(db: Session, usuario: User, filtro, coluna_outro):
    """Tira da lista quem tem bloqueio com quem vê."""
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    return and_(filtro, coluna_outro.not_in(bloqueados)) if bloqueados else filtro


def _pagina(db: Session, filtro, coluna_outro, offset: int, limit: int) -> UserPage:
    """Usuários do outro lado da relação, quem seguiu por último primeiro."""
    total = db.scalar(select(func.count()).select_from(Follow).where(filtro)) or 0
    users = list(
        db.scalars(
            select(User)
            .join(Follow, coluna_outro == User.id)
            .where(filtro)
            .order_by(Follow.created_at.desc(), Follow.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return UserPage(items=users, total=total, offset=offset, limit=limit)
