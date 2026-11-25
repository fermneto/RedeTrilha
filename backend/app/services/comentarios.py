"""Comentários em árvore nos poemas, carregados como no X.

Uma página traz as respostas diretas (ao poema ou a um comentário) em ordem
cronológica, paginadas por cursor, e abaixo de cada uma a prévia das primeiras
respostas; o resto se carrega em `GET /comentarios/{id}/respostas`. A
paginação, a prévia e o apagar são os mesmos dos comentários de renga e moram
em services/arvore_de_comentarios.py (queries por página e sem N+1 lá).

Bloqueio (services/bloqueios.py): os comentários de quem tem bloqueio com o autor
do poema ficam escondidos para todos, como se tivessem sido apagados: com
respostas, aparecem como "comentário removido" (sem texto, autor nem âncora);
sem respostas, somem, também das contagens e das marcas dos versos. É um filtro
na leitura (`ocultos`), sem mexer no banco: desbloquear os traz de volta.
"""

from fastapi import HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session
from sqlalchemy.sql import ColumnElement

from app.models.comentario import Comentario
from app.models.post import Post
from app.models.user import User
from app.schemas.comentario import (
    AncoraOut,
    ComentarioApagadoOut,
    ComentarioCreate,
    ComentarioOut,
    ComentarioPage,
    VersosComentadosOut,
)
from app.schemas.user import UserOut
from app.services import ancoras, avisos, bloqueios
from app.services import arvore_de_comentarios as arvore
from app.services.posts import buscar, original_de, original_para_interagir


def comentar(
    db: Session, autor: User, post_id: int, dados: ComentarioCreate
) -> ComentarioOut:
    """Comentário no poema ou resposta. Num repost puro, vai para o original, como no X.

    Pai inexistente, de outro poema ou removido dá 404. Com `ancora`, critica
    os versos escolhidos (ver `services/ancoras.py`); âncora inválida dá 422.
    """
    poema = original_para_interagir(db, autor, post_id)
    post_id = poema.id
    if dados.ancora is not None:
        ancoras.validar(poema.texto, dados.parent_id, dados.ancora)
    pai = None
    if dados.parent_id is not None:
        pai = db.get(Comentario, dados.parent_id)
        if pai is None or pai.post_id != post_id or pai.removido:
            raise HTTPException(status_code=404, detail="comentário pai não encontrado")
    comentario = Comentario(
        post_id=post_id, autor_id=autor.id, texto=dados.texto, parent_id=dados.parent_id
    )
    db.add(comentario)
    db.flush()
    if dados.ancora is not None:
        ancoras.ancorar(db, comentario.id, dados.ancora)
    avisos.avisar(
        db,
        autor,
        avisos.do_comentario(pai.autor_id if pai else None, [poema.autor_id], dados.ancora is not None),
        dono_id=poema.autor_id,
        post_id=post_id,
        comentario_id=comentario.id,
    )
    db.commit()
    db.refresh(comentario)
    ancora = (
        ancoras.saida(dados.ancora.verso_inicio, dados.ancora.verso_fim, poema.texto)
        if dados.ancora is not None
        else None
    )
    return _para_saida(comentario, 0, [], ancora)


def respostas_do_poema(
    db: Session, usuario: User, post_id: int, limit: int, cursor: str | None, verso: int | None = None
) -> ComentarioPage:
    """Num repost puro, a conversa do original, como no POST.

    Com `verso`, só as críticas cuja âncora cobre aquele verso. 404 para quem o
    autor do poema bloqueou.
    """
    poema, ocultos = _poema_visivel(db, usuario, original_de(db, post_id))
    filtro = and_(Comentario.post_id == poema.id, Comentario.parent_id.is_(None))
    if verso is not None:
        filtro = and_(filtro, Comentario.id.in_(ancoras.ids_no_verso(poema, verso, ocultos)))
    return _pagina(db, filtro, None, limit, cursor, ocultos)


def versos_comentados(db: Session, usuario: User, post_id: int) -> VersosComentadosOut:
    """As marcas no corpo do poema: quantas críticas cobrem cada verso."""
    poema, ocultos = _poema_visivel(db, usuario, original_de(db, post_id))
    return ancoras.versos_comentados(db, poema, ocultos)


def respostas_do_comentario(
    db: Session, usuario: User, comentario_id: int, limit: int, cursor: str | None
) -> ComentarioPage:
    comentario = _buscar(db, comentario_id)
    _, ocultos = _poema_visivel(db, usuario, buscar(db, comentario.post_id))
    if comentario.autor_id in ocultos and not comentario.removido:
        # Escondido sem respostas não existe; com respostas, elas continuam.
        arvore.buscar_visivel(db, Comentario, comentario_id, ocultos)
    filtro = Comentario.parent_id == comentario_id
    return _pagina(db, filtro, comentario_id, limit, cursor, ocultos)


def apagar(db: Session, usuario: User, comentario_id: int) -> ComentarioApagadoOut:
    """Só o autor; ver `arvore_de_comentarios.apagar`. Sem respostas, a âncora sai junto;
    nos dois casos, os avisos do comentário saem."""
    comentario = _buscar(db, comentario_id)
    return arvore.apagar(
        db,
        Comentario,
        usuario,
        comentario,
        lambda id_: ancoras.apagar(db, [id_]),
        lambda id_: avisos.apagar_do_comentario(db, id_, em_renga=False),
    )


def _buscar(db: Session, comentario_id: int) -> Comentario:
    comentario = db.get(Comentario, comentario_id)
    if comentario is None:
        raise HTTPException(status_code=404, detail="comentário não encontrado")
    return comentario


def _poema_visivel(db: Session, usuario: User, poema: Post) -> tuple[Post, set[int]]:
    """O poema (404 se o autor bloqueou quem vê) e quem tem os comentários escondidos nele."""
    bloqueios.garantir_que_ve(db, usuario.id, poema.autor_id, "poema não encontrado")
    return poema, bloqueios.ids_com_bloqueio(db, poema.autor_id)


def _pagina(
    db: Session,
    filtro: ColumnElement[bool],
    raiz: int | None,
    limit: int,
    cursor: str | None,
    ocultos: set[int],
) -> ComentarioPage:
    return arvore.pagina(
        db,
        Comentario,
        filtro,
        raiz,
        limit,
        cursor,
        ocultos,
        lambda carregados: ancoras.das_saidas(db, carregados),
        _para_saida,
        ComentarioPage,
    )


def _para_saida(
    comentario: Comentario,
    total_respostas: int,
    respostas: list[ComentarioOut],
    ancora: AncoraOut | None,
    escondido: bool = False,
) -> ComentarioOut:
    """`escondido` (bloqueio) sai como o marcador do comentário apagado."""
    removido = comentario.removido or escondido
    return ComentarioOut(
        id=comentario.id,
        post_id=comentario.post_id,
        texto="" if removido else comentario.texto,
        autor=None if removido else UserOut.model_validate(comentario.autor),
        parent_id=comentario.parent_id,
        created_at=comentario.created_at,
        removido=removido,
        total_respostas=total_respostas,
        respostas=respostas,
        ancora=ancora,
    )
