"""Renga: o poema colaborativo.

Quem cria abre com a 1ª estrofe; os participantes permitidos acrescentam as
seguintes, mas ninguém escreve duas seguidas. A renga fecha ao atingir o
limite de estrofes ou quando o criador a encerra.

Concorrência. Acrescentar trava a linha da renga (`SELECT ... FOR UPDATE` no
Postgres; o SQLite ignora e já serializa as escritas) e a posição da estrofe é
única por renga: se duas pessoas leem a mesma última estrofe e gravam ao mesmo
tempo, só uma grava a posição, e a outra recebe 409. Assim o limite não estoura
e a regra da vez não quebra.
"""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.renga import ConviteRenga, EstrofeRenga, Renga
from app.models.user import User
from app.schemas.renga import (
    EstrofeOut,
    RengaCreate,
    RengaDetalhe,
    RengaOut,
    RengaPage,
)
from app.schemas.user import UserOut
from app.services import bloqueios

MSG_FECHADA = "a renga está fechada: não aceita mais estrofes"
MSG_NAO_CONVIDADO = "só os convidados escrevem nesta renga"
MSG_NAO_E_A_VEZ = "não é a sua vez: ninguém escreve duas estrofes seguidas"
MSG_CORRIDA = "outra pessoa acrescentou uma estrofe agora; recarregue a renga"


def criar(db: Session, criador: User, dados: RengaCreate) -> RengaDetalhe:
    convidados = _resolver_convidados(db, criador, dados.convidados)
    renga = Renga(
        criador_id=criador.id, titulo=dados.titulo, modo=dados.modo, limite=dados.limite
    )
    db.add(renga)
    db.flush()
    db.add(
        EstrofeRenga(
            renga_id=renga.id, autor_id=criador.id, posicao=1, texto=dados.primeira_estrofe
        )
    )
    db.add_all(ConviteRenga(renga_id=renga.id, user_id=u.id) for u in convidados)
    db.commit()
    return detalhar(db, criador, renga.id)


def listar(
    db: Session, usuario: User, situacao: str | None, offset: int, limit: int
) -> RengaPage:
    """As rengas de todo mundo, a mais nova primeiro; `situacao` filtra aberta/fechada.
    Ficam fora as criadas por quem tem bloqueio com o usuário."""
    filtros = []
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    if bloqueados:
        filtros.append(Renga.criador_id.not_in(bloqueados))
    if situacao == "aberta":
        filtros.append(Renga.fechada_em.is_(None))
    elif situacao == "fechada":
        filtros.append(Renga.fechada_em.is_not(None))
    total = db.scalar(select(func.count()).select_from(Renga).where(*filtros)) or 0
    rengas = list(
        db.scalars(
            select(Renga)
            .where(*filtros)
            .order_by(Renga.created_at.desc(), Renga.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    autores = _autores_por_renga(db, [r.id for r in rengas])
    items = [_para_saida(r, *autores.get(r.id, (0, []))) for r in rengas]
    return RengaPage(items=items, total=total, offset=offset, limit=limit)


def detalhar(db: Session, usuario: User, renga_id: int) -> RengaDetalhe:
    renga = _buscar(db, renga_id)
    bloqueios.garantir_que_ve(db, usuario.id, renga.criador_id, "renga não encontrada")
    return _detalhe(renga, _estrofes(db, renga.id), _convidados(db, renga.id), usuario)


def detalhar_varias(db: Session, usuario: User, renga_ids: list[int]) -> dict[int, RengaDetalhe]:
    """O `detalhar` de várias rengas (as de uma página do feed) em três queries, sem N+1."""
    if not renga_ids:
        return {}
    rengas = list(db.scalars(select(Renga).where(Renga.id.in_(renga_ids))))
    estrofes: dict[int, list[EstrofeRenga]] = {}
    for estrofe in db.scalars(
        select(EstrofeRenga)
        .where(EstrofeRenga.renga_id.in_(renga_ids))
        .order_by(EstrofeRenga.renga_id, EstrofeRenga.posicao)
    ):
        estrofes.setdefault(estrofe.renga_id, []).append(estrofe)
    convidados: dict[int, list[User]] = {}
    for renga_id, convidado in db.execute(
        select(ConviteRenga.renga_id, User)
        .join(User, User.id == ConviteRenga.user_id)
        .where(ConviteRenga.renga_id.in_(renga_ids))
        .order_by(ConviteRenga.id)
    ):
        convidados.setdefault(renga_id, []).append(convidado)
    return {
        r.id: _detalhe(r, estrofes.get(r.id, []), convidados.get(r.id, []), usuario)
        for r in rengas
    }


def _detalhe(
    renga: Renga, estrofes: list[EstrofeRenga], convidados: list[User], usuario: User
) -> RengaDetalhe:
    ultimo_autor = estrofes[-1].autor_id if estrofes else None
    impedimento = _impedimento(renga, usuario, {u.id for u in convidados}, ultimo_autor)
    return RengaDetalhe(
        **_para_saida(renga, len(estrofes), _autores_em_ordem(estrofes)).model_dump(),
        estrofes=[
            EstrofeOut(
                id=e.id,
                posicao=e.posicao,
                texto=e.texto,
                autor=UserOut.model_validate(e.autor),
                created_at=e.created_at,
            )
            for e in estrofes
        ],
        convidados=[UserOut.model_validate(u) for u in convidados],
        posso_escrever=impedimento is None,
        motivo=impedimento[1] if impedimento else None,
    )


def acrescentar(db: Session, usuario: User, renga_id: int, texto: str) -> RengaDetalhe:
    """A próxima estrofe. 409 se fechada ou se não é a vez; 403 se não pode escrever."""
    renga = _buscar(db, renga_id, travar=True)
    try:
        bloqueios.garantir_interacao(db, usuario.id, renga.criador_id, "renga não encontrada")
    except HTTPException:
        db.rollback()
        raise
    ultima = db.scalar(
        select(EstrofeRenga)
        .where(EstrofeRenga.renga_id == renga.id)
        .order_by(EstrofeRenga.posicao.desc())
        .limit(1)
    )
    convidados = {u.id for u in _convidados(db, renga.id)}
    impedimento = _impedimento(renga, usuario, convidados, ultima.autor_id if ultima else None)
    if impedimento is not None:
        db.rollback()
        raise HTTPException(status_code=impedimento[0], detail=impedimento[1])

    posicao = (ultima.posicao if ultima else 0) + 1
    db.add(EstrofeRenga(renga_id=renga.id, autor_id=usuario.id, posicao=posicao, texto=texto))
    if posicao >= renga.limite:
        renga.fechada_em = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=MSG_CORRIDA) from None
    return detalhar(db, usuario, renga.id)


def encerrar(db: Session, usuario: User, renga_id: int) -> RengaDetalhe:
    """Só o criador. Idempotente: encerrar uma renga já fechada não muda nada.

    `encerrada_em` marca o encerramento pelo criador, que sobe a renga no feed;
    a renga fechada pelo limite não o tem.
    """
    renga = _buscar(db, renga_id, travar=True)
    if renga.criador_id != usuario.id:
        db.rollback()
        raise HTTPException(status_code=403, detail="só quem criou a renga pode encerrá-la")
    if renga.fechada_em is None:
        renga.fechada_em = renga.encerrada_em = datetime.now(UTC)
    db.commit()
    return detalhar(db, usuario, renga.id)


def convidar(db: Session, usuario: User, renga_id: int, usernames: list[str]) -> RengaDetalhe:
    """Só o criador, só no modo convidados e com a renga aberta. Convidar de novo não duplica."""
    renga = _buscar(db, renga_id)
    if renga.criador_id != usuario.id:
        raise HTTPException(status_code=403, detail="só quem criou a renga pode convidar")
    if renga.modo != "convidados":
        raise HTTPException(
            status_code=409, detail="a renga é aberta: qualquer pessoa já pode escrever"
        )
    if renga.fechada_em is not None:
        raise HTTPException(status_code=409, detail=MSG_FECHADA)
    ja_convidados = {u.id for u in _convidados(db, renga.id)}
    for convidado in _resolver_convidados(db, usuario, usernames):
        if convidado.id not in ja_convidados:
            db.add(ConviteRenga(renga_id=renga.id, user_id=convidado.id))
    try:
        db.commit()
    except IntegrityError:
        # Dois convites iguais ao mesmo tempo: o outro já gravou, dá no mesmo.
        db.rollback()
    return detalhar(db, usuario, renga.id)


def _impedimento(
    renga: Renga, usuario: User, convidados: set[int], ultimo_autor_id: int | None
) -> tuple[int, str] | None:
    """(status, motivo) se o usuário não pode escrever a próxima estrofe; None se pode.

    A ordem importa: fechada vale para todos, depois quem pode participar, depois a vez.
    """
    if renga.fechada_em is not None:
        return 409, MSG_FECHADA
    if (
        renga.modo == "convidados"
        and usuario.id != renga.criador_id
        and usuario.id not in convidados
    ):
        return 403, MSG_NAO_CONVIDADO
    if ultimo_autor_id == usuario.id:
        return 409, MSG_NAO_E_A_VEZ
    return None


def _resolver_convidados(db: Session, criador: User, usernames: list[str]) -> list[User]:
    """Usuários dos usernames, sem repetir e sem o criador. 422 se não existe ou é consagrado."""
    pedidos = list(dict.fromkeys(u for u in usernames if u != criador.username))
    if not pedidos:
        return []
    encontrados = {
        u.username: u for u in db.scalars(select(User).where(User.username.in_(pedidos)))
    }
    faltando = [u for u in pedidos if u not in encontrados]
    if faltando:
        raise HTTPException(
            status_code=422, detail=f"usuário não encontrado: {', '.join(faltando)}"
        )
    consagrados = [u for u in pedidos if encontrados[u].consagrado]
    if consagrados:
        raise HTTPException(
            status_code=422,
            detail=f"consagrados não podem ser convidados (não têm login): {', '.join(consagrados)}",
        )
    bloqueados = bloqueios.ids_com_bloqueio(db, criador.id)
    com_bloqueio = [u for u in pedidos if encontrados[u].id in bloqueados]
    if com_bloqueio:
        raise HTTPException(
            status_code=422,
            detail=f"não dá para convidar quem tem bloqueio com você: {', '.join(com_bloqueio)}",
        )
    return [encontrados[u] for u in pedidos]


def _buscar(db: Session, renga_id: int, travar: bool = False) -> Renga:
    consulta = select(Renga).where(Renga.id == renga_id)
    if travar:
        # `of=Renga`: o Postgres não trava o lado nulo do join do criador.
        consulta = consulta.with_for_update(of=Renga)
    renga = db.scalar(consulta)
    if renga is None:
        raise HTTPException(status_code=404, detail="renga não encontrada")
    return renga


def _estrofes(db: Session, renga_id: int) -> list[EstrofeRenga]:
    return list(
        db.scalars(
            select(EstrofeRenga)
            .where(EstrofeRenga.renga_id == renga_id)
            .order_by(EstrofeRenga.posicao)
        )
    )


def _convidados(db: Session, renga_id: int) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(ConviteRenga, ConviteRenga.user_id == User.id)
            .where(ConviteRenga.renga_id == renga_id)
            .order_by(ConviteRenga.id)
        )
    )


def _autores_em_ordem(estrofes: list[EstrofeRenga]) -> list[User]:
    """Cada autor uma vez, na ordem da primeira estrofe dele."""
    vistos: dict[int, User] = {}
    for estrofe in estrofes:
        vistos.setdefault(estrofe.autor_id, estrofe.autor)
    return list(vistos.values())


def _autores_por_renga(
    db: Session, renga_ids: list[int]
) -> dict[int, tuple[int, list[User]]]:
    """(qtd de estrofes, autores em ordem) de cada renga da página, numa query só."""
    if not renga_ids:
        return {}
    estrofes = db.scalars(
        select(EstrofeRenga)
        .where(EstrofeRenga.renga_id.in_(renga_ids))
        .order_by(EstrofeRenga.renga_id, EstrofeRenga.posicao)
    )
    por_renga: dict[int, list[EstrofeRenga]] = {}
    for estrofe in estrofes:
        por_renga.setdefault(estrofe.renga_id, []).append(estrofe)
    return {rid: (len(lista), _autores_em_ordem(lista)) for rid, lista in por_renga.items()}


def _para_saida(renga: Renga, qtd_estrofes: int, autores: list[User]) -> RengaOut:
    return RengaOut(
        id=renga.id,
        titulo=renga.titulo,
        modo=renga.modo,
        limite=renga.limite,
        criador=UserOut.model_validate(renga.criador),
        fechada=renga.fechada_em is not None,
        fechada_em=renga.fechada_em,
        created_at=renga.created_at,
        qtd_estrofes=qtd_estrofes,
        autores=[UserOut.model_validate(u) for u in autores],
    )
