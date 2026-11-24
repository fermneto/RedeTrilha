"""Comentários em árvore, carregados como no X.

Uma página traz as respostas diretas (ao poema ou a um comentário) em ordem
cronológica, paginadas por cursor, e abaixo de cada uma as primeiras
`PREVIA_RESPOSTAS` respostas, recursivamente com o mesmo corte. O resto se
carrega em `GET /comentarios/{id}/respostas`.

Queries por página: uma para a página, uma para o total, uma por nível da
prévia (ROW_NUMBER por pai, até 3 por pai) e uma para os totais de respostas
de tudo o que foi carregado. Nenhuma por comentário (sem N+1).
"""

from fastapi import HTTPException
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import ColumnElement

from app.core import arvore_comentarios
from app.models.comentario import Comentario
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
from app.services import ancoras
from app.services.cursor import codificar_cursor, ler_cursor
from app.services.posts import original_de

PREVIA_RESPOSTAS = 3


def comentar(
    db: Session, autor: User, post_id: int, dados: ComentarioCreate
) -> ComentarioOut:
    """Comentário no poema ou resposta. Num repost puro, vai para o original, como no X.

    Pai inexistente, de outro poema ou removido dá 404. Com `ancora`, critica
    os versos escolhidos (ver `services/ancoras.py`); âncora inválida dá 422.
    """
    poema = original_de(db, post_id)
    post_id = poema.id
    trecho = (
        ancoras.validar(poema.texto, dados.parent_id, dados.ancora)
        if dados.ancora is not None
        else None
    )
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
        ancoras.ancorar(db, comentario.id, dados.ancora, trecho)
    db.commit()
    db.refresh(comentario)
    ancora = (
        AncoraOut(**dados.ancora.model_dump(), trecho=trecho, atual=True)
        if dados.ancora is not None
        else None
    )
    return _para_saida(comentario, 0, [], ancora)


def respostas_do_poema(
    db: Session, post_id: int, limit: int, cursor: str | None, verso: int | None = None
) -> ComentarioPage:
    """Num repost puro, a conversa do original, como no POST.

    Com `verso`, só as críticas cuja âncora atual cobre aquele verso.
    """
    poema = original_de(db, post_id)
    filtro = and_(Comentario.post_id == poema.id, Comentario.parent_id.is_(None))
    if verso is not None:
        filtro = and_(filtro, Comentario.id.in_(ancoras.comentarios_no_verso(db, poema, verso)))
    return _pagina(db, filtro, None, limit, cursor)


def versos_comentados(db: Session, post_id: int) -> VersosComentadosOut:
    """As marcas no corpo do poema: quantas críticas cobrem cada verso."""
    return ancoras.versos_comentados(db, original_de(db, post_id))


def respostas_do_comentario(
    db: Session, comentario_id: int, limit: int, cursor: str | None
) -> ComentarioPage:
    _buscar(db, comentario_id)
    return _pagina(db, Comentario.parent_id == comentario_id, comentario_id, limit, cursor)


def apagar(db: Session, usuario: User, comentario_id: int) -> ComentarioApagadoOut:
    """Só o autor. Com respostas, vira marcador (texto vazio, `removido`).

    Sem respostas, sai do banco. Devolve qual dos dois aconteceu e o total de
    respostas, que pode ser maior que o da tela (alguém respondeu depois).
    Um marcador já removido continua como marcador para sempre (decisão do
    Neto): apagar de novo não faz nada.
    """
    comentario = _buscar(db, comentario_id)
    if comentario.autor_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o autor pode apagar o comentário")
    total = db.scalar(
        select(func.count()).select_from(Comentario).where(Comentario.parent_id == comentario_id)
    )
    if comentario.removido:
        return ComentarioApagadoOut(resultado="removido", total_respostas=total)
    if total == 0:
        ancoras.apagar(db, [comentario_id])
        db.execute(delete(Comentario).where(Comentario.id == comentario_id))
        resultado = "apagado"
    else:
        comentario.texto = ""
        comentario.removido = True
        resultado = "removido"
    db.commit()
    return ComentarioApagadoOut(resultado=resultado, total_respostas=total)


def _buscar(db: Session, comentario_id: int) -> Comentario:
    comentario = db.get(Comentario, comentario_id)
    if comentario is None:
        raise HTTPException(status_code=404, detail="comentário não encontrado")
    return comentario


def _pagina(
    db: Session,
    filtro: ColumnElement[bool],
    raiz: int | None,
    limit: int,
    cursor: str | None,
) -> ComentarioPage:
    """Respostas diretas que casam com `filtro`, mais antigas primeiro, e as prévias."""
    consulta = select(Comentario).where(filtro)
    if cursor is not None:
        data, id_ = ler_cursor(cursor)
        consulta = consulta.where(
            or_(
                Comentario.created_at > data,
                and_(Comentario.created_at == data, Comentario.id > id_),
            )
        )
    linhas = list(
        db.scalars(consulta.order_by(Comentario.created_at, Comentario.id).limit(limit + 1))
    )
    pagina, tem_mais = linhas[:limit], len(linhas) > limit
    carregados = pagina + _previas(db, [c.id for c in pagina])
    totais = _totais_de_respostas(db, [c.id for c in carregados])
    ancoras_da_pagina = ancoras.das_saidas(db, carregados)
    nos = arvore_comentarios.montar(
        [(c.id, c.parent_id, c.created_at, c) for c in carregados], raiz=raiz
    )
    ultimo = pagina[-1] if pagina else None
    return ComentarioPage(
        items=[_saida_do_no(no, totais, ancoras_da_pagina) for no in nos],
        total=db.scalar(select(func.count()).select_from(Comentario).where(filtro)) or 0,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(ultimo.created_at, ultimo.id) if ultimo and tem_mais else None
        ),
    )


def _previas(db: Session, pais: list[int]) -> list[Comentario]:
    """As primeiras PREVIA_RESPOSTAS respostas de cada pai, uma query por nível."""
    carregados: list[Comentario] = []
    while pais:
        posicao = (
            func.row_number()
            .over(
                partition_by=Comentario.parent_id,
                order_by=(Comentario.created_at, Comentario.id),
            )
            .label("posicao")
        )
        primeiras = (
            select(Comentario.id, posicao).where(Comentario.parent_id.in_(pais)).subquery()
        )
        nivel = list(
            db.scalars(
                select(Comentario)
                .join(primeiras, primeiras.c.id == Comentario.id)
                .where(primeiras.c.posicao <= PREVIA_RESPOSTAS)
            )
        )
        carregados += nivel
        pais = [c.id for c in nivel]
    return carregados


def _totais_de_respostas(db: Session, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    linhas = db.execute(
        select(Comentario.parent_id, func.count())
        .where(Comentario.parent_id.in_(ids))
        .group_by(Comentario.parent_id)
    )
    return dict(linhas.all())


def _saida_do_no(
    no: arvore_comentarios.No, totais: dict[int, int], ancoras_da_pagina: dict[int, AncoraOut]
) -> ComentarioOut:
    respostas = [_saida_do_no(filho, totais, ancoras_da_pagina) for filho in no.respostas]
    return _para_saida(
        no.payload, totais.get(no.id, 0), respostas, ancoras_da_pagina.get(no.id)
    )


def _para_saida(
    comentario: Comentario,
    total_respostas: int,
    respostas: list[ComentarioOut],
    ancora: AncoraOut | None,
) -> ComentarioOut:
    return ComentarioOut(
        id=comentario.id,
        post_id=comentario.post_id,
        texto="" if comentario.removido else comentario.texto,
        autor=None if comentario.removido else UserOut.model_validate(comentario.autor),
        parent_id=comentario.parent_id,
        created_at=comentario.created_at,
        removido=comentario.removido,
        total_respostas=total_respostas,
        respostas=respostas,
        ancora=ancora,
    )
