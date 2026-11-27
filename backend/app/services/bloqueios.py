"""Bloquear alguém, como no X: vale para a rede inteira (decisão 13).

A regra mora aqui, para não se espalhar pelos services:

- **Quem foi bloqueado não vê** os poemas, as rengas e o perfil de quem o
  bloqueou: para ele, dão 404, como se não existissem (`garantir_que_ve`).
- **Nenhum dos dois interage com o outro:** curtir, comentar, repostar, citar,
  escrever na renga, seguir e mandar mensagem. Quem foi bloqueado recebe 404
  (não vê); quem bloqueou recebe 403, com o motivo (`garantir_interacao`).
- **Bloquear desfaz os follows** entre os dois, nos dois sentidos.
- **Nenhum dos dois vê o outro** nos feeds (Seguindo e Para você), nas tags e no
  Explorar, nas rengas e nas sugestões (`ids_com_bloqueio`, `sem_bloqueados`).
- **Comentários de um nos poemas do outro somem para todos** (services/comentarios.py),
  como os apagados: com respostas, viram "comentário removido"; sem, somem. É um
  filtro na leitura, então desbloquear os traz de volta.
- **Citação de terceiros:** o original de quem bloqueou aparece para o bloqueado
  como "poema indisponível" (services/posts.para_saidas).
- **Acervo, seguidores/seguindo e convites de renga** também tiram o outro.
- Desbloquear desfaz o bloqueio (os follows não voltam). A conversa de mensagens fica.

Custo: `ids_com_bloqueio` são duas buscas nos índices de `bloqueios`, um em cada
sentido; sem bloqueio nenhum (o caso comum), os feeds não fazem mais nada.
"""

from typing import Protocol, TypeVar

from fastapi import HTTPException
from sqlalchemy import ColumnElement, and_, delete, exists, or_, select, union
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.bloqueio import Bloqueio
from app.models.follow import Follow
from app.models.post import Post
from app.models.renga import Renga
from app.models.user import User
# O módulo, e não a função: users.py importa este arquivo (o import seria circular).
from app.services import users

MSG_BLOQUEEI = "você bloqueou esta pessoa; desbloqueie para interagir"


def bloquear(db: Session, eu: User, username: str) -> None:
    """Idempotente: bloquear de novo não faz nada."""
    outro = users.buscar_por_username(db, username)
    if outro.id == eu.id:
        raise HTTPException(status_code=422, detail="não dá para bloquear a si mesmo")
    if bloqueou(db, eu.id, outro.id):
        return
    db.add(Bloqueio(bloqueador_id=eu.id, bloqueado_id=outro.id))
    db.execute(
        delete(Follow).where(
            or_(
                (Follow.seguidor_id == eu.id) & (Follow.seguido_id == outro.id),
                (Follow.seguidor_id == outro.id) & (Follow.seguido_id == eu.id),
            )
        )
    )
    try:
        db.commit()
    except IntegrityError:
        # Dois cliques ao mesmo tempo: o outro já gravou o mesmo bloqueio.
        db.rollback()


def desbloquear(db: Session, eu: User, username: str) -> None:
    """Idempotente: desbloquear quem não está bloqueado não faz nada."""
    outro = users.buscar_por_username(db, username)
    db.execute(
        delete(Bloqueio).where(Bloqueio.bloqueador_id == eu.id, Bloqueio.bloqueado_id == outro.id)
    )
    db.commit()


def bloqueou(db: Session, quem_id: int, outro_id: int) -> bool:
    """`quem_id` bloqueou `outro_id`? Uma busca pelo par único."""
    return (
        db.scalar(
            select(Bloqueio.id).where(
                Bloqueio.bloqueador_id == quem_id, Bloqueio.bloqueado_id == outro_id
            )
        )
        is not None
    )


def eu_bloqueei(db: Session, eu: User, username: str) -> bool:
    """Para o perfil mostrar "Desbloquear". 404 se a pessoa não existe ou me bloqueou."""
    outro = users.buscar_por_username(db, username)
    garantir_que_ve(db, eu.id, outro.id, "usuário não encontrado")
    return bloqueou(db, eu.id, outro.id)


def ids_com_bloqueio(db: Session, user_id: int) -> set[int]:
    """Quem bloqueou `user_id` ou foi bloqueado por ele: os dois índices de `bloqueios`."""
    return set(
        db.scalars(
            union(
                select(Bloqueio.bloqueado_id).where(Bloqueio.bloqueador_id == user_id),
                select(Bloqueio.bloqueador_id).where(Bloqueio.bloqueado_id == user_id),
            )
        )
    )


def quem_bloqueou(db: Session, user_id: int) -> set[int]:
    """Quem bloqueou `user_id` (o índice `(bloqueado_id, bloqueador_id)`)."""
    return set(db.scalars(select(Bloqueio.bloqueador_id).where(Bloqueio.bloqueado_id == user_id)))


def ha_bloqueio(a, b) -> ColumnElement[bool]:
    """Expressão SQL: há bloqueio, em qualquer sentido, entre as colunas (ou ids) `a` e `b`."""
    return exists().where(
        or_(
            and_(Bloqueio.bloqueador_id == a, Bloqueio.bloqueado_id == b),
            and_(Bloqueio.bloqueador_id == b, Bloqueio.bloqueado_id == a),
        )
    )


def garantir_que_ve(db: Session, quem_ve_id: int, dono_id: int, nao_encontrado: str) -> None:
    """404 (com a mensagem do "não encontrado" de sempre) se o dono bloqueou quem vê."""
    if quem_ve_id != dono_id and bloqueou(db, dono_id, quem_ve_id):
        raise HTTPException(status_code=404, detail=nao_encontrado)


def garantir_interacao(db: Session, quem_id: int, dono_id: int, nao_encontrado: str) -> None:
    """404 se o dono bloqueou quem age; 403 se quem age bloqueou o dono."""
    garantir_que_ve(db, quem_id, dono_id, nao_encontrado)
    if quem_id != dono_id and bloqueou(db, quem_id, dono_id):
        raise HTTPException(status_code=403, detail=MSG_BLOQUEEI)


class _Atividade(Protocol):
    tipo: str
    alvo_id: int
    autor_id: int


A = TypeVar("A", bound=_Atividade)


def sem_bloqueados(db: Session, user_id: int, atividades: list[A]) -> list[A]:
    """Tira de um feed o que tem a ver com quem tem bloqueio com `user_id`: as
    atividades dessas pessoas (poema, repost, estrofe, comentário) e as de outros
    sobre os poemas e as rengas delas. Sem bloqueio, devolve a lista como veio."""
    bloqueados = ids_com_bloqueio(db, user_id)
    if not bloqueados:
        return atividades
    poemas = set(db.scalars(select(Post.id).where(Post.autor_id.in_(bloqueados))))
    rengas = set(db.scalars(select(Renga.id).where(Renga.criador_id.in_(bloqueados))))
    fora = {"poema": poemas, "renga": rengas}
    return [a for a in atividades if a.autor_id not in bloqueados and a.alvo_id not in fora[a.tipo]]
