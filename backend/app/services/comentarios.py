"""Comentários em árvore, carregados como no X.

Uma página traz as respostas diretas (ao poema ou a um comentário) em ordem
cronológica, paginadas por cursor, e abaixo de cada uma as primeiras
`PREVIA_RESPOSTAS` respostas, recursivamente com o mesmo corte. O resto se
carrega em `GET /comentarios/{id}/respostas`.

Queries por página: uma para a página, uma para o total, uma por nível da
prévia (ROW_NUMBER por pai, até 3 por pai) e uma para os totais de respostas
de tudo o que foi carregado. Nenhuma por comentário (sem N+1).

Bloqueio (services/bloqueios.py): os comentários de quem tem bloqueio com o autor
do poema ficam escondidos para todos, como se tivessem sido apagados: com
respostas, aparecem como "comentário removido" (sem texto, autor nem âncora);
sem respostas, somem, também das contagens e das marcas dos versos. É um filtro
na leitura (`ocultos`), sem mexer no banco: desbloquear os traz de volta.
"""

from fastapi import HTTPException
from sqlalchemy import and_, delete, exists, func, or_, select, true
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql import ColumnElement

from app.core import arvore_comentarios
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
from app.services import ancoras, bloqueios
from app.services.cursor import codificar_cursor, ler_cursor
from app.services.posts import buscar, original_de, original_para_interagir

PREVIA_RESPOSTAS = 3


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
        _buscar_visivel(db, comentario_id, ocultos)
    filtro = Comentario.parent_id == comentario_id
    return _pagina(db, filtro, comentario_id, limit, cursor, ocultos)


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


def _poema_visivel(db: Session, usuario: User, poema: Post) -> tuple[Post, set[int]]:
    """O poema (404 se o autor bloqueou quem vê) e quem tem os comentários escondidos nele."""
    bloqueios.garantir_que_ve(db, usuario.id, poema.autor_id, "poema não encontrado")
    return poema, bloqueios.ids_com_bloqueio(db, poema.autor_id)


def _visivel(ocultos: set[int]) -> ColumnElement[bool]:
    """O comentário aparece: não é de `ocultos` ou tem respostas (aí vira o marcador)."""
    if not ocultos:
        return true()
    resposta = aliased(Comentario)
    return or_(
        Comentario.autor_id.not_in(ocultos),
        exists().where(resposta.parent_id == Comentario.id),
    )


def _buscar_visivel(db: Session, comentario_id: int, ocultos: set[int]) -> Comentario:
    comentario = db.scalar(select(Comentario).where(Comentario.id == comentario_id, _visivel(ocultos)))
    if comentario is None:
        raise HTTPException(status_code=404, detail="comentário não encontrado")
    return comentario


def _pagina(
    db: Session,
    filtro: ColumnElement[bool],
    raiz: int | None,
    limit: int,
    cursor: str | None,
    ocultos: set[int],
) -> ComentarioPage:
    """Respostas diretas que casam com `filtro`, mais antigas primeiro, e as prévias."""
    filtro = and_(filtro, _visivel(ocultos))
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
    carregados = pagina + _previas(db, [c.id for c in pagina], ocultos)
    totais = _totais_de_respostas(db, [c.id for c in carregados], ocultos)
    ancoras_da_pagina = ancoras.das_saidas(db, carregados)
    nos = arvore_comentarios.montar(
        [(c.id, c.parent_id, c.created_at, c) for c in carregados], raiz=raiz
    )
    ultimo = pagina[-1] if pagina else None
    return ComentarioPage(
        items=[_saida_do_no(no, totais, ancoras_da_pagina, ocultos) for no in nos],
        total=db.scalar(select(func.count()).select_from(Comentario).where(filtro)) or 0,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(ultimo.created_at, ultimo.id) if ultimo and tem_mais else None
        ),
    )


def _previas(db: Session, pais: list[int], ocultos: set[int]) -> list[Comentario]:
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
            select(Comentario.id, posicao)
            .where(Comentario.parent_id.in_(pais), _visivel(ocultos))
            .subquery()
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


def _totais_de_respostas(db: Session, ids: list[int], ocultos: set[int]) -> dict[int, int]:
    if not ids:
        return {}
    linhas = db.execute(
        select(Comentario.parent_id, func.count())
        .where(Comentario.parent_id.in_(ids), _visivel(ocultos))
        .group_by(Comentario.parent_id)
    )
    return dict(linhas.all())


def _saida_do_no(
    no: arvore_comentarios.No,
    totais: dict[int, int],
    ancoras_da_pagina: dict[int, AncoraOut],
    ocultos: set[int],
) -> ComentarioOut:
    respostas = [_saida_do_no(filho, totais, ancoras_da_pagina, ocultos) for filho in no.respostas]
    escondido = no.payload.autor_id in ocultos
    return _para_saida(
        no.payload,
        totais.get(no.id, 0),
        respostas,
        None if escondido else ancoras_da_pagina.get(no.id),
        escondido,
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
