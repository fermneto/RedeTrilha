"""A paginação e o apagar dos comentários em árvore, comuns a poemas e rengas.

Os comentários de poema (`models/comentario.py`) e os de renga
(`models/comentario_renga.py`) moram em tabelas diferentes com as mesmas
colunas de árvore (`id`, `parent_id`, `autor_id`, `texto`, `removido`,
`created_at`). Aqui fica o que não depende de qual das duas é: o `modelo` é a
classe da tabela, e quem chama (services/comentarios.py,
services/comentarios_renga.py) diz como sai cada comentário e de onde vêm as
âncoras.

Uma página traz as respostas diretas (ao alvo ou a um comentário) em ordem
cronológica, paginadas por cursor, e abaixo de cada uma as primeiras
`PREVIA_RESPOSTAS` respostas, recursivamente com o mesmo corte. Queries por
página: uma para a página, uma para o total, uma por nível da prévia
(ROW_NUMBER por pai, até 3 por pai), uma para os totais de respostas de tudo o
que foi carregado e as das âncoras. Nenhuma por comentário (sem N+1).

`ocultos` (bloqueio, services/bloqueios.py): os comentários de quem tem
bloqueio com o dono do alvo ficam escondidos para todos, como se tivessem sido
apagados: com respostas, aparecem como o marcador; sem respostas, somem.
"""

from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import HTTPException
from sqlalchemy import and_, delete, exists, func, or_, select, true
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql import ColumnElement

from app.core import arvore_comentarios
from app.models.user import User
from app.schemas.comentario import AncoraOut, ComentarioApagadoOut
from app.services.cursor import codificar_cursor, ler_cursor

PREVIA_RESPOSTAS = 3

Saida = TypeVar("Saida")
# (comentário, total de respostas, respostas já convertidas, âncora, escondido) -> saída.
MontarSaida = Callable[[Any, int, list, AncoraOut | None, bool], Any]


def visivel(modelo: type, ocultos: set[int]) -> ColumnElement[bool]:
    """O comentário aparece: não é de `ocultos` ou tem respostas (aí vira o marcador)."""
    if not ocultos:
        return true()
    resposta = aliased(modelo)
    return or_(
        modelo.autor_id.not_in(ocultos),
        exists().where(resposta.parent_id == modelo.id),
    )


def buscar_visivel(db: Session, modelo: type, comentario_id: int, ocultos: set[int]):
    comentario = db.scalar(
        select(modelo).where(modelo.id == comentario_id, visivel(modelo, ocultos))
    )
    if comentario is None:
        raise HTTPException(status_code=404, detail="comentário não encontrado")
    return comentario


def pagina(
    db: Session,
    modelo: type,
    filtro: ColumnElement[bool],
    raiz: int | None,
    limit: int,
    cursor: str | None,
    ocultos: set[int],
    ancoras_de: Callable[[list], dict[int, AncoraOut]],
    saida: MontarSaida,
    classe_da_pagina: type[Saida],
) -> Saida:
    """Respostas diretas que casam com `filtro`, mais antigas primeiro, e as prévias."""
    filtro = and_(filtro, visivel(modelo, ocultos))
    consulta = select(modelo).where(filtro)
    if cursor is not None:
        data, id_ = ler_cursor(cursor)
        consulta = consulta.where(
            or_(
                modelo.created_at > data,
                and_(modelo.created_at == data, modelo.id > id_),
            )
        )
    linhas = list(db.scalars(consulta.order_by(modelo.created_at, modelo.id).limit(limit + 1)))
    da_pagina, tem_mais = linhas[:limit], len(linhas) > limit
    carregados = da_pagina + _previas(db, modelo, [c.id for c in da_pagina], ocultos)
    totais = _totais_de_respostas(db, modelo, [c.id for c in carregados], ocultos)
    ancoras = ancoras_de(carregados)
    nos = arvore_comentarios.montar(
        [(c.id, c.parent_id, c.created_at, c) for c in carregados], raiz=raiz
    )
    ultimo = da_pagina[-1] if da_pagina else None
    return classe_da_pagina(
        items=[_saida_do_no(no, totais, ancoras, ocultos, saida) for no in nos],
        total=db.scalar(select(func.count()).select_from(modelo).where(filtro)) or 0,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(ultimo.created_at, ultimo.id) if ultimo and tem_mais else None
        ),
    )


def apagar(
    db: Session,
    modelo: type,
    usuario: User,
    comentario,
    antes_de_sair: Callable[[int], None] | None = None,
    ao_tirar: Callable[[int], None] | None = None,
) -> ComentarioApagadoOut:
    """Só o autor. Com respostas, vira marcador (texto vazio, `removido`).

    Sem respostas, sai do banco (`antes_de_sair` apaga o que depende dele, como a
    âncora dos poemas). Nos dois casos, `ao_tirar` roda antes do commit (saem os
    avisos do comentário: o texto não está mais lá). Devolve qual dos dois
    aconteceu e o total de respostas, que pode ser maior que o da tela (alguém respondeu depois). Um marcador já
    removido continua como marcador para sempre (decisão do Neto): apagar de
    novo não faz nada.
    """
    if comentario.autor_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o autor pode apagar o comentário")
    total = db.scalar(
        select(func.count()).select_from(modelo).where(modelo.parent_id == comentario.id)
    )
    if comentario.removido:
        return ComentarioApagadoOut(resultado="removido", total_respostas=total)
    if total == 0:
        if antes_de_sair is not None:
            antes_de_sair(comentario.id)
        db.execute(delete(modelo).where(modelo.id == comentario.id))
        resultado = "apagado"
    else:
        comentario.texto = ""
        comentario.removido = True
        resultado = "removido"
    if ao_tirar is not None:
        ao_tirar(comentario.id)
    db.commit()
    return ComentarioApagadoOut(resultado=resultado, total_respostas=total)


def _previas(db: Session, modelo: type, pais: list[int], ocultos: set[int]) -> list:
    """As primeiras PREVIA_RESPOSTAS respostas de cada pai, uma query por nível."""
    carregados: list = []
    while pais:
        posicao = (
            func.row_number()
            .over(partition_by=modelo.parent_id, order_by=(modelo.created_at, modelo.id))
            .label("posicao")
        )
        primeiras = (
            select(modelo.id, posicao)
            .where(modelo.parent_id.in_(pais), visivel(modelo, ocultos))
            .subquery()
        )
        nivel = list(
            db.scalars(
                select(modelo)
                .join(primeiras, primeiras.c.id == modelo.id)
                .where(primeiras.c.posicao <= PREVIA_RESPOSTAS)
            )
        )
        carregados += nivel
        pais = [c.id for c in nivel]
    return carregados


def _totais_de_respostas(
    db: Session, modelo: type, ids: list[int], ocultos: set[int]
) -> dict[int, int]:
    if not ids:
        return {}
    linhas = db.execute(
        select(modelo.parent_id, func.count())
        .where(modelo.parent_id.in_(ids), visivel(modelo, ocultos))
        .group_by(modelo.parent_id)
    )
    return dict(linhas.all())


def _saida_do_no(
    no: arvore_comentarios.No,
    totais: dict[int, int],
    ancoras: dict[int, AncoraOut],
    ocultos: set[int],
    saida: MontarSaida,
):
    respostas = [_saida_do_no(filho, totais, ancoras, ocultos, saida) for filho in no.respostas]
    escondido = no.payload.autor_id in ocultos
    return saida(
        no.payload,
        totais.get(no.id, 0),
        respostas,
        None if escondido else ancoras.get(no.id),
        escondido,
    )
