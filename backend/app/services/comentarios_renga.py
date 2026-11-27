"""Comentários e crítica ancorada no verso nas rengas, abertas ou fechadas.

As mesmas regras dos comentários de poema (services/comentarios.py): árvore com
prévia das respostas e paginação por cursor (services/arvore_de_comentarios.py),
âncora só no 1º nível e validada contra o texto (services/ancoras.py), só o
autor apaga, e o marcador "comentário removido" quando há respostas.

O texto é o da renga (`rengas.texto_de`): as estrofes em ordem, separadas por
uma linha em branco. A renga aberta cresce só no fim, então um verso já
comentado não muda de número; a âncora pode cobrir qualquer verso que já
existe quando o comentário é feito.

Bloqueio: vale o criador, como na leitura da renga (`rengas.detalhar`). Quem o
criador bloqueou não vê a renga nem os comentários (404); quem bloqueou o
criador lê, mas não comenta (403); os comentários de quem tem bloqueio com o
criador ficam escondidos para todos, como nos poemas.
"""

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import ColumnElement

from app.models.comentario_renga import ComentarioRenga
from app.models.renga import Renga
from app.models.user import User
from app.schemas.comentario import (
    AncoraOut,
    ComentarioApagadoOut,
    ComentarioCreate,
    ComentarioRengaOut,
    ComentarioRengaPage,
    VersosComentadosOut,
)
from app.schemas.user import UserOut
from app.core.avisos import estrofes_tocadas
from app.services import ancoras, avisos, bloqueios
from app.services import arvore_de_comentarios as arvore
from app.services import rengas


def comentar(
    db: Session, autor: User, renga_id: int, dados: ComentarioCreate
) -> ComentarioRengaOut:
    """Comentário na renga ou resposta. Pai inexistente, de outra renga ou removido
    dá 404; âncora inválida (ou em resposta) dá 422."""
    renga = rengas.para_interagir(db, autor, renga_id)
    texto = rengas.texto(db, renga.id) if dados.ancora is not None else None
    if dados.ancora is not None:
        ancoras.validar(texto, dados.parent_id, dados.ancora, alvo="texto da renga")
    pai = None
    if dados.parent_id is not None:
        pai = db.get(ComentarioRenga, dados.parent_id)
        if pai is None or pai.renga_id != renga.id or pai.removido:
            raise HTTPException(status_code=404, detail="comentário pai não encontrado")
    comentario = ComentarioRenga(
        renga_id=renga.id,
        autor_id=autor.id,
        texto=dados.texto,
        parent_id=dados.parent_id,
        verso_inicio=dados.ancora.verso_inicio if dados.ancora else None,
        verso_fim=dados.ancora.verso_fim if dados.ancora else None,
    )
    db.add(comentario)
    db.flush()
    avisos.avisar(
        db,
        autor,
        avisos.do_comentario(
            pai.autor_id if pai else None, _donos(db, renga, pai, dados), dados.ancora is not None
        ),
        dono_id=renga.criador_id,
        renga_id=renga.id,
        comentario_id=comentario.id,
    )
    db.commit()
    db.refresh(comentario)
    ancora = (
        ancoras.saida(dados.ancora.verso_inicio, dados.ancora.verso_fim, texto)
        if dados.ancora is not None
        else None
    )
    return _para_saida(comentario, 0, [], ancora)


def respostas_da_renga(
    db: Session,
    usuario: User,
    renga_id: int,
    limit: int,
    cursor: str | None,
    verso: int | None = None,
) -> ComentarioRengaPage:
    """As raízes; com `verso`, só as críticas cuja âncora cobre aquele verso."""
    renga, ocultos = _renga_visivel(db, usuario, renga_id)
    filtro = and_(ComentarioRenga.renga_id == renga.id, ComentarioRenga.parent_id.is_(None))
    if verso is not None:
        filtro = and_(
            filtro,
            ComentarioRenga.verso_inicio <= verso,
            ComentarioRenga.verso_fim >= verso,
            ComentarioRenga.autor_id.not_in(ocultos),
        )
    return _pagina(db, renga.id, filtro, None, limit, cursor, ocultos)


def versos_comentados(db: Session, usuario: User, renga_id: int) -> VersosComentadosOut:
    """As marcas no corpo da renga: quantas críticas cobrem cada verso."""
    renga, ocultos = _renga_visivel(db, usuario, renga_id)
    intervalos = db.execute(
        select(ComentarioRenga.verso_inicio, ComentarioRenga.verso_fim).where(
            ComentarioRenga.renga_id == renga.id,
            ComentarioRenga.verso_inicio.is_not(None),
            ComentarioRenga.autor_id.not_in(ocultos),
        )
    )
    return ancoras.contar_versos(intervalos)


def respostas_do_comentario(
    db: Session, usuario: User, renga_id: int, comentario_id: int, limit: int, cursor: str | None
) -> ComentarioRengaPage:
    renga, ocultos = _renga_visivel(db, usuario, renga_id)
    comentario = _buscar(db, renga.id, comentario_id)
    if comentario.autor_id in ocultos and not comentario.removido:
        # Escondido sem respostas não existe; com respostas, elas continuam.
        arvore.buscar_visivel(db, ComentarioRenga, comentario_id, ocultos)
    filtro = ComentarioRenga.parent_id == comentario_id
    return _pagina(db, renga.id, filtro, comentario_id, limit, cursor, ocultos)


def apagar(
    db: Session, usuario: User, renga_id: int, comentario_id: int
) -> ComentarioApagadoOut:
    """Só o autor do comentário; ver `arvore_de_comentarios.apagar`."""
    comentario = _buscar(db, renga_id, comentario_id)
    return arvore.apagar(
        db,
        ComentarioRenga,
        usuario,
        comentario,
        ao_tirar=lambda id_: avisos.apagar_do_comentario(db, id_, em_renga=True),
    )


def _donos(
    db: Session, renga: Renga, pai: ComentarioRenga | None, dados: ComentarioCreate
) -> list[int]:
    """Quem, além do autor do comentário respondido, é avisado: o criador sempre; no
    comentário geral, todos os autores de estrofe; na crítica, os autores das
    estrofes que os versos tocam; na resposta, só o criador."""
    if pai is not None:
        return [renga.criador_id]
    estrofes = rengas.estrofes(db, renga.id)
    if dados.ancora is None:
        return [renga.criador_id, *(e.autor_id for e in estrofes)]
    tocadas = estrofes_tocadas(
        [e.texto for e in estrofes], dados.ancora.verso_inicio, dados.ancora.verso_fim
    )
    return [renga.criador_id, *(estrofes[i].autor_id for i in tocadas)]


def _renga_visivel(db: Session, usuario: User, renga_id: int) -> tuple[Renga, set[int]]:
    """A renga (`rengas.visivel`: 404 se o criador bloqueou quem vê) e quem tem os
    comentários escondidos nela."""
    renga = rengas.visivel(db, usuario, renga_id)
    return renga, bloqueios.ids_com_bloqueio(db, renga.criador_id)


def _buscar(db: Session, renga_id: int, comentario_id: int) -> ComentarioRenga:
    comentario = db.get(ComentarioRenga, comentario_id)
    if comentario is None or comentario.renga_id != renga_id:
        raise HTTPException(status_code=404, detail="comentário não encontrado")
    return comentario


def _pagina(
    db: Session,
    renga_id: int,
    filtro: ColumnElement[bool],
    raiz: int | None,
    limit: int,
    cursor: str | None,
    ocultos: set[int],
) -> ComentarioRengaPage:
    def ancoras_de(carregados: list[ComentarioRenga]) -> dict[int, AncoraOut]:
        com_ancora = [c for c in carregados if c.verso_inicio is not None]
        if not com_ancora:
            return {}
        # O texto só é lido quando a página tem crítica ancorada.
        texto = rengas.texto(db, renga_id)
        return {c.id: ancoras.saida(c.verso_inicio, c.verso_fim, texto) for c in com_ancora}

    return arvore.pagina(
        db,
        ComentarioRenga,
        filtro,
        raiz,
        limit,
        cursor,
        ocultos,
        ancoras_de,
        _para_saida,
        ComentarioRengaPage,
    )


def _para_saida(
    comentario: ComentarioRenga,
    total_respostas: int,
    respostas: list[ComentarioRengaOut],
    ancora: AncoraOut | None,
    escondido: bool = False,
) -> ComentarioRengaOut:
    """`escondido` (bloqueio) sai como o marcador do comentário apagado. O
    marcador continua com a âncora, como nos poemas."""
    removido = comentario.removido or escondido
    return ComentarioRengaOut(
        id=comentario.id,
        renga_id=comentario.renga_id,
        texto="" if removido else comentario.texto,
        autor=None if removido else UserOut.model_validate(comentario.autor),
        parent_id=comentario.parent_id,
        created_at=comentario.created_at,
        removido=removido,
        total_respostas=total_respostas,
        respostas=respostas,
        ancora=ancora,
    )
