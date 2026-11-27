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

from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.citacao_renga import CitacaoRenga
from app.models.comentario_renga import ComentarioRenga
from app.models.curtida_renga import CurtidaRenga
from app.models.renga import ConviteRenga, EstrofeRenga, Renga
from app.models.repost_renga import RepostRenga
from app.models.user import User
from app.schemas.renga import (
    EstrofeOut,
    RengaCreate,
    RengaDetalhe,
    RengaOut,
    RengaPage,
)
from app.schemas.user import UserOut
from app.services import avisos, bloqueios

MSG_FECHADA = "a renga está fechada: não aceita mais estrofes"
MSG_NAO_CONVIDADO = "só os convidados escrevem nesta renga"
MSG_NAO_E_A_VEZ = "não é a sua vez: ninguém escreve duas estrofes seguidas"
MSG_CORRIDA = "outra pessoa acrescentou uma estrofe agora; recarregue a renga"


def texto_de(estrofes: list[str]) -> str:
    """O texto da renga, cujos versos os comentários contam: as estrofes em ordem,
    separadas por uma linha em branco, cada uma como foi escrita.

    Como estrofe só se acrescenta no fim (nunca se edita, apaga nem reordena), os
    números dos versos já escritos não mudam quando a renga cresce. O front monta
    o mesmo texto (`textoDaRenga` em lib/api.ts).
    """
    return "\n\n".join(estrofes)


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
    avisos.avisar(db, criador, [(u.id, "convite") for u in convidados], renga_id=renga.id)
    db.commit()
    return detalhar(db, criador, renga.id)


def listar(
    db: Session,
    usuario: User,
    situacao: str | None,
    offset: int,
    limit: int,
    minhas: bool = False,
) -> RengaPage:
    """As rengas de todo mundo, a mais nova primeiro; `situacao` filtra aberta/fechada.
    Com `minhas`, só as do usuário: as que criou, em que escreveu uma estrofe ou para
    as quais foi convidado. Ficam fora as criadas por quem tem bloqueio com o usuário."""
    filtros = []
    if minhas:
        filtros.append(
            or_(
                Renga.criador_id == usuario.id,
                exists().where(EstrofeRenga.renga_id == Renga.id, EstrofeRenga.autor_id == usuario.id),
                exists().where(ConviteRenga.renga_id == Renga.id, ConviteRenga.user_id == usuario.id),
            )
        )
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
    ids = [r.id for r in rengas]
    autores = _autores_por_renga(db, ids)
    contagens = contar(db, ids, usuario)
    items = [_para_saida(r, *autores.get(r.id, (0, [])), contagens) for r in rengas]
    return RengaPage(items=items, total=total, offset=offset, limit=limit)


def detalhar(db: Session, usuario: User, renga_id: int) -> RengaDetalhe:
    renga = visivel(db, usuario, renga_id)
    return _detalhe(
        renga, _estrofes(db, renga.id), _convidados(db, renga.id), usuario, contar(db, [renga.id], usuario)
    )


def detalhar_varias(db: Session, usuario: User, renga_ids: list[int]) -> dict[int, RengaDetalhe]:
    """O `detalhar` de várias rengas (as de uma página do feed) em oito queries, sem N+1."""
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
    contagens = contar(db, renga_ids, usuario)
    return {
        r.id: _detalhe(r, estrofes.get(r.id, []), convidados.get(r.id, []), usuario, contagens)
        for r in rengas
    }


@dataclass
class Contagens:
    """As contagens de uma página de rengas, como as dos poemas (services/posts.py)."""

    comentarios: dict[int, int] = field(default_factory=dict)
    curtidas: dict[int, int] = field(default_factory=dict)
    curtidas_minhas: set[int] = field(default_factory=set)
    reposts: dict[int, int] = field(default_factory=dict)
    repostadas: set[int] = field(default_factory=set)


def contar(db: Session, renga_ids: list[int], usuario: User) -> Contagens:
    """Seis queries para a página toda: comentários, curtidas e reposts por renga
    (os reposts puros mais os poemas que citam a renga, como nos poemas) e quais o
    usuário curtiu e repostou."""
    if not renga_ids:
        return Contagens()

    def por_renga(coluna) -> dict[int, int]:
        return dict(
            db.execute(
                select(coluna, func.count()).where(coluna.in_(renga_ids)).group_by(coluna)
            ).all()
        )

    def do_usuario(modelo) -> set[int]:
        return set(
            db.scalars(
                select(modelo.renga_id).where(
                    modelo.renga_id.in_(renga_ids), modelo.user_id == usuario.id
                )
            )
        )

    reposts = por_renga(RepostRenga.renga_id)
    for renga_id, citacoes in por_renga(CitacaoRenga.renga_id).items():
        reposts[renga_id] = reposts.get(renga_id, 0) + citacoes
    return Contagens(
        comentarios=contar_comentarios(db, renga_ids),
        curtidas=por_renga(CurtidaRenga.renga_id),
        curtidas_minhas=do_usuario(CurtidaRenga),
        reposts=reposts,
        repostadas=do_usuario(RepostRenga),
    )


def contar_comentarios(db: Session, renga_ids: list[int]) -> dict[int, int]:
    """Comentários (e respostas, marcadores incluídos) de cada renga, numa query,
    como o `comentarios` dos poemas (services/posts.py)."""
    if not renga_ids:
        return {}
    linhas = db.execute(
        select(ComentarioRenga.renga_id, func.count())
        .where(ComentarioRenga.renga_id.in_(renga_ids))
        .group_by(ComentarioRenga.renga_id)
    )
    return dict(linhas.all())


def _detalhe(
    renga: Renga,
    estrofes: list[EstrofeRenga],
    convidados: list[User],
    usuario: User,
    contagens: Contagens,
) -> RengaDetalhe:
    ultimo_autor = estrofes[-1].autor_id if estrofes else None
    impedimento = _impedimento(renga, usuario, {u.id for u in convidados}, ultimo_autor)
    return RengaDetalhe(
        **_para_saida(renga, len(estrofes), _autores_em_ordem(estrofes), contagens).model_dump(),
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
    estrofe = EstrofeRenga(renga_id=renga.id, autor_id=usuario.id, posicao=posicao, texto=texto)
    db.add(estrofe)
    if posicao >= renga.limite:
        renga.fechada_em = datetime.now(UTC)
    try:
        db.flush()
        # O criador e quem já escreveu uma estrofe ficam sabendo da nova.
        autores = db.scalars(
            select(EstrofeRenga.autor_id)
            .where(EstrofeRenga.renga_id == renga.id)
            .order_by(EstrofeRenga.posicao)
        )
        avisos.avisar(
            db,
            usuario,
            [(pessoa, "estrofe") for pessoa in [renga.criador_id, *autores]],
            dono_id=renga.criador_id,
            renga_id=renga.id,
            estrofe_id=estrofe.id,
        )
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
    novos = [
        c for c in _resolver_convidados(db, usuario, usernames) if c.id not in ja_convidados
    ]
    db.add_all(ConviteRenga(renga_id=renga.id, user_id=c.id) for c in novos)
    avisos.avisar(db, usuario, [(c.id, "convite") for c in novos], renga_id=renga.id)
    try:
        db.commit()
    except IntegrityError:
        # Dois convites iguais ao mesmo tempo: o outro já gravou, dá no mesmo.
        db.rollback()
    return detalhar(db, usuario, renga.id)


def buscar(db: Session, renga_id: int) -> Renga:
    """A renga; 404 se não existe. Público para as antologias, o cartão e os comentários."""
    return _buscar(db, renga_id)


def visivel(db: Session, usuario: User, renga_id: int) -> Renga:
    """A renga, se quem pede pode vê-la, como o `posts.visivel`: vale o criador (404
    também se ele bloqueou quem pede)."""
    renga = _buscar(db, renga_id)
    bloqueios.garantir_que_ve(db, usuario.id, renga.criador_id, "renga não encontrada")
    return renga


def para_interagir(db: Session, usuario: User, renga_id: int) -> Renga:
    """A renga para curtir, repostar, citar ou mandar por mensagem, como o
    `posts.original_para_interagir`: vale o criador, como na leitura (404 se ele
    bloqueou quem age, 403 se quem age o bloqueou)."""
    renga = _buscar(db, renga_id)
    bloqueios.garantir_interacao(db, usuario.id, renga.criador_id, "renga não encontrada")
    return renga


def ids_dos_autores(db: Session, renga_id: int) -> list[int]:
    """Quem escreveu ao menos uma estrofe (o criador escreveu a 1ª), cada um uma vez,
    na ordem da primeira estrofe: os autores que a curtida, o repost e a citação avisam."""
    autores = db.scalars(
        select(EstrofeRenga.autor_id)
        .where(EstrofeRenga.renga_id == renga_id)
        .order_by(EstrofeRenga.posicao)
    )
    return list(dict.fromkeys(autores))


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


def _para_saida(
    renga: Renga, qtd_estrofes: int, autores: list[User], contagens: Contagens
) -> RengaOut:
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
        comentarios=contagens.comentarios.get(renga.id, 0),
        curtidas=contagens.curtidas.get(renga.id, 0),
        reposts=contagens.reposts.get(renga.id, 0),
        curti=renga.id in contagens.curtidas_minhas,
        repostei=renga.id in contagens.repostadas,
    )
