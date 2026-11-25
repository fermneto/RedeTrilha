"""Mensagens diretas 1-para-1, como no X (decisão 13 do DECISIONS.md).

- **Caixa e pedidos:** a conversa cai na caixa de quem segue quem mandou; de
  quem a pessoa não segue, vira um pedido. Aceitar leva à caixa; recusar tira da
  lista dela para sempre (mensagens novas não a trazem de volta) e quem mandou
  não é avisado. Responder um pedido também o aceita. Só abrir a conversa de
  novo, de propósito, traz de volta uma recusada.
- **Consagrados** não mandam nem recebem: não têm login.
- **Bloqueio** (services/bloqueios.py): com bloqueio em qualquer direção, ninguém
  manda; quem foi bloqueado também não abre a conversa.
- **Privacidade:** só os dois participantes leem a conversa; para os outros,
  toda rota dá 404, como se ela não existisse.
- **Não lidas e visto** pelos ponteiros de `participantes_conversa`
  (core/caixa_de_entrada.py). Ler um pedido não dá "visto" a quem mandou.
- **Tempo real:** cada mudança avisa os envolvidos pelo `tempo_real.avisar`, que
  só entrega depois do commit (app/tempo_real.py).
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import tempo_real
from app.core.caixa_de_entrada import (
    CAIXA,
    PEDIDO,
    RECUSADA,
    avancar_leitura,
    situacao_de_quem_recebe,
)
from app.models.conversa import Conversa, ParticipanteConversa
from app.models.mensagem import Mensagem
from app.models.post import Post
from app.models.user import User
from app.schemas.mensagem import (
    MENSAGENS_POR_MINUTO,
    Aba,
    CaixaPage,
    ConversaDetalhe,
    ConversaOut,
    MensagemCreate,
    MensagemOut,
    MensagemPage,
    ResumoDeMensagens,
)
from app.schemas.user import UserOut
from app.services import bloqueios, follows
from app.services import posts as posts_service
from app.services.cursor import utc_sem_fuso
from app.services.users import buscar_por_username

JANELA_DO_LIMITE = timedelta(minutes=1)
SITUACAO_DA_ABA = {"conversas": CAIXA, "pedidos": PEDIDO}


# ---------- abrir e ler ----------


def abrir(db: Session, eu: User, username: str) -> ConversaDetalhe:
    """A conversa com `username`, criada se ainda não existe (uma só por par)."""
    outro = buscar_por_username(db, username)
    if outro.id == eu.id:
        raise HTTPException(status_code=422, detail="não dá para mandar mensagem para você mesmo")
    _recusar_consagrados(eu, outro)
    if bloqueios.bloqueou(db, outro.id, eu.id):
        raise HTTPException(status_code=403, detail=f"você não pode mandar mensagem para @{outro.username}")

    conversa = _conversa_do_par(db, eu.id, outro.id) or _criar(db, eu, outro)
    minha = db.get(ParticipanteConversa, (conversa.id, eu.id))
    if minha.situacao == RECUSADA:
        # Abrir de novo, de propósito, traz a conversa de volta para a caixa.
        minha.situacao = CAIXA
        tempo_real.avisar(db, [eu.id], {"tipo": "conversa", "conversa_id": conversa.id})
        db.commit()
    return detalhe(db, eu, conversa.id)


def detalhe(db: Session, eu: User, conversa_id: int) -> ConversaDetalhe:
    minha, outra = _os_dois_lados(db, eu, conversa_id)
    outro = db.get(User, outra.user_id)
    bloqueei = bloqueios.bloqueou(db, eu.id, outro.id)
    fui_bloqueado = bloqueios.bloqueou(db, outro.id, eu.id)
    motivo = None
    if bloqueei:
        motivo = f"Você bloqueou @{outro.username}. Desbloqueie para mandar mensagem."
    elif fui_bloqueado:
        motivo = f"Você não pode mandar mensagem para @{outro.username}."
    return ConversaDetalhe(
        id=conversa_id,
        outro=UserOut.model_validate(outro),
        situacao=minha.situacao,
        silenciada=minha.silenciada,
        bloqueei=bloqueei,
        pode_responder=motivo is None,
        motivo=motivo,
        ultima_lida_id=minha.ultima_lida_id,
        visto_ate=outra.ultima_lida_id if outra.situacao == CAIXA else None,
    )


def caixa(db: Session, eu: User, aba: Aba, cursor: str | None, limit: int) -> CaixaPage:
    """Conversas (ou pedidos) pela última mensagem, pelo índice da caixa.

    Conversa aberta sem nenhuma mensagem ainda não aparece. O cursor é o
    `ultima_mensagem_id` da última conversa da página.
    """
    consulta = select(ParticipanteConversa).where(
        ParticipanteConversa.user_id == eu.id,
        ParticipanteConversa.situacao == SITUACAO_DA_ABA[aba],
        ParticipanteConversa.ultima_mensagem_id.is_not(None),
    )
    if cursor is not None:
        consulta = consulta.where(ParticipanteConversa.ultima_mensagem_id < _ler_cursor(cursor))
    linhas = list(
        db.scalars(consulta.order_by(ParticipanteConversa.ultima_mensagem_id.desc()).limit(limit + 1))
    )
    pagina, mais = linhas[:limit], len(linhas) > limit
    ids = [p.conversa_id for p in pagina]

    outros = dict(
        db.execute(
            select(ParticipanteConversa.conversa_id, User)
            .join(User, User.id == ParticipanteConversa.user_id)
            .where(ParticipanteConversa.conversa_id.in_(ids), ParticipanteConversa.user_id != eu.id)
        ).all()
    )
    ultimas = {
        m.conversa_id: m
        for m in _saidas(
            db,
            eu,
            list(db.scalars(select(Mensagem).where(Mensagem.id.in_([p.ultima_mensagem_id for p in pagina])))),
        )
    }
    nao_lidas = _nao_lidas_por_conversa(db, eu, ids)
    return CaixaPage(
        items=[
            ConversaOut(
                id=p.conversa_id,
                outro=UserOut.model_validate(outros[p.conversa_id]),
                situacao=p.situacao,
                silenciada=p.silenciada,
                ultima_mensagem=ultimas.get(p.conversa_id),
                nao_lidas=nao_lidas.get(p.conversa_id, 0),
            )
            for p in pagina
        ],
        limit=limit,
        proximo_cursor=str(pagina[-1].ultima_mensagem_id) if mais else None,
    )


def resumo(db: Session, eu: User) -> ResumoDeMensagens:
    """Conversas da caixa com não lidas (sem as silenciadas) e pedidos com não lidas."""
    contagens = dict(
        db.execute(
            select(ParticipanteConversa.situacao, func.count())
            .where(
                ParticipanteConversa.user_id == eu.id,
                ParticipanteConversa.situacao.in_([CAIXA, PEDIDO]),
                ParticipanteConversa.ultima_mensagem_id > ParticipanteConversa.ultima_lida_id,
                or_(ParticipanteConversa.situacao == PEDIDO, ParticipanteConversa.silenciada.is_(False)),
            )
            .group_by(ParticipanteConversa.situacao)
        ).all()
    )
    return ResumoDeMensagens(nao_lidas=contagens.get(CAIXA, 0), pedidos=contagens.get(PEDIDO, 0))


def mensagens(
    db: Session, eu: User, conversa_id: int, antes: int | None, depois: int | None, limit: int
) -> MensagemPage:
    """Uma janela da conversa, sempre da mais antiga para a mais nova (ver MensagemPage)."""
    _os_dois_lados(db, eu, conversa_id)
    if antes is not None and depois is not None:
        raise HTTPException(status_code=422, detail="use `antes` ou `depois`, não os dois")
    consulta = select(Mensagem).where(Mensagem.conversa_id == conversa_id)
    if depois is not None:
        seguintes = list(db.scalars(consulta.where(Mensagem.id > depois).order_by(Mensagem.id).limit(limit + 1)))
        janela = seguintes[:limit]
        cursor = janela[-1].id if len(seguintes) > limit else None
    else:
        if antes is not None:
            consulta = consulta.where(Mensagem.id < antes)
        anteriores = list(db.scalars(consulta.order_by(Mensagem.id.desc()).limit(limit + 1)))
        janela = anteriores[:limit][::-1]
        cursor = janela[0].id if len(anteriores) > limit else None
    return MensagemPage(
        items=_saidas(db, eu, janela),
        limit=limit,
        proximo_cursor=str(cursor) if cursor is not None else None,
    )


# ---------- escrever ----------


def enviar(db: Session, eu: User, conversa_id: int, dados: MensagemCreate) -> MensagemOut:
    minha, outra = _os_dois_lados(db, eu, conversa_id)
    outro = db.get(User, outra.user_id)
    _recusar_consagrados(eu, outro)
    if bloqueios.bloqueou(db, eu.id, outro.id):
        raise HTTPException(
            status_code=403, detail=f"você bloqueou @{outro.username}; desbloqueie para mandar mensagem"
        )
    if bloqueios.bloqueou(db, outro.id, eu.id):
        raise HTTPException(status_code=403, detail=f"você não pode mandar mensagem para @{outro.username}")
    if _enviadas_no_ultimo_minuto(db, eu.id) >= MENSAGENS_POR_MINUTO:
        raise HTTPException(
            status_code=429, detail="você mandou muitas mensagens em pouco tempo; espere um minuto"
        )
    post_id = posts_service.original_de(db, dados.post_id).id if dados.post_id is not None else None

    mensagem = Mensagem(conversa_id=conversa_id, autor_id=eu.id, texto=dados.texto, post_id=post_id)
    db.add(mensagem)
    db.flush()
    # Quem manda leu tudo até aqui; responder um pedido (ou uma recusada) o aceita.
    minha.ultima_mensagem_id = minha.ultima_lida_id = mensagem.id
    minha.situacao = CAIXA
    outra.ultima_mensagem_id = mensagem.id
    aviso = {"conversa_id": conversa_id, "mensagem_id": mensagem.id}
    tempo_real.avisar(db, [eu.id], {"tipo": "mensagem", **aviso})
    if outra.situacao != RECUSADA:
        tipo = "pedido" if outra.situacao == PEDIDO else "mensagem"
        tempo_real.avisar(db, [outro.id], {"tipo": tipo, **aviso})
    db.commit()
    return _saidas(db, eu, [mensagem])[0]


def marcar_lida(db: Session, eu: User, conversa_id: int, ate: int | None) -> None:
    minha, outra = _os_dois_lados(db, eu, conversa_id)
    nova = avancar_leitura(minha.ultima_lida_id, ate, minha.ultima_mensagem_id)
    if nova == minha.ultima_lida_id:
        return
    minha.ultima_lida_id = nova
    # Os outros dispositivos de quem leu atualizam o contador; o outro lado vê o
    # "visto", menos num pedido (ler um pedido não avisa quem mandou).
    para = [eu.id, outra.user_id] if minha.situacao == CAIXA else [eu.id]
    tempo_real.avisar(
        db, para, {"tipo": "lida", "conversa_id": conversa_id, "leitor_id": eu.id, "ultima_lida_id": nova}
    )
    db.commit()


def aceitar(db: Session, eu: User, conversa_id: int) -> None:
    """Idempotente. Leva o pedido (ou uma recusada aberta de novo) para a caixa."""
    minha, outra = _os_dois_lados(db, eu, conversa_id)
    if minha.situacao != CAIXA:
        minha.situacao = CAIXA
        # Quem mandou passa a ver o "visto" do que já foi lido.
        tempo_real.avisar(
            db,
            [outra.user_id],
            {
                "tipo": "lida",
                "conversa_id": conversa_id,
                "leitor_id": eu.id,
                "ultima_lida_id": minha.ultima_lida_id,
            },
        )
        _mudou_para_mim(db, eu, conversa_id)


def recusar(db: Session, eu: User, conversa_id: int) -> None:
    """Só um pedido se recusa (idempotente). Quem mandou não é avisado."""
    minha, _ = _os_dois_lados(db, eu, conversa_id)
    if minha.situacao == CAIXA:
        raise HTTPException(status_code=409, detail="só um pedido pode ser recusado")
    if minha.situacao != RECUSADA:
        minha.situacao = RECUSADA
        _mudou_para_mim(db, eu, conversa_id)


def silenciar(db: Session, eu: User, conversa_id: int, silenciada: bool) -> None:
    """Idempotente. A conversa silenciada não conta no contador de não lidas."""
    minha, _ = _os_dois_lados(db, eu, conversa_id)
    if minha.silenciada != silenciada:
        minha.silenciada = silenciada
        _mudou_para_mim(db, eu, conversa_id)


# ---------- internos ----------


def _recusar_consagrados(eu: User, outro: User) -> None:
    if eu.consagrado:
        raise HTTPException(status_code=403, detail="consagrados não mandam mensagens")
    if outro.consagrado:
        raise HTTPException(
            status_code=422, detail="consagrados não recebem mensagens: são contas sem login"
        )


def _conversa_do_par(db: Session, a: int, b: int) -> Conversa | None:
    menor, maior = sorted((a, b))
    return db.scalar(select(Conversa).where(Conversa.menor_id == menor, Conversa.maior_id == maior))


def _criar(db: Session, eu: User, outro: User) -> Conversa:
    """Nova conversa: na caixa de quem abre; na do outro, caixa se ele segue quem abriu."""
    menor, maior = sorted((eu.id, outro.id))
    conversa = Conversa(menor_id=menor, maior_id=maior)
    db.add(conversa)
    db.flush()
    segue = eu.id in follows.seguidos_entre(db, outro.id, [eu.id])
    db.add_all(
        [
            ParticipanteConversa(conversa_id=conversa.id, user_id=eu.id, situacao=CAIXA),
            ParticipanteConversa(
                conversa_id=conversa.id, user_id=outro.id, situacao=situacao_de_quem_recebe(segue)
            ),
        ]
    )
    try:
        db.commit()
    except IntegrityError:
        # Os dois abriram ao mesmo tempo: fica a conversa que o outro gravou.
        db.rollback()
        return _conversa_do_par(db, eu.id, outro.id)
    return conversa


def _os_dois_lados(
    db: Session, eu: User, conversa_id: int
) -> tuple[ParticipanteConversa, ParticipanteConversa]:
    """Minha participação e a do outro; 404 para quem não está na conversa."""
    lados = list(db.scalars(select(ParticipanteConversa).where(ParticipanteConversa.conversa_id == conversa_id)))
    minha = next((p for p in lados if p.user_id == eu.id), None)
    outra = next((p for p in lados if p.user_id != eu.id), None)
    if minha is None or outra is None:
        raise HTTPException(status_code=404, detail="conversa não encontrada")
    return minha, outra


def _mudou_para_mim(db: Session, eu: User, conversa_id: int) -> None:
    tempo_real.avisar(db, [eu.id], {"tipo": "conversa", "conversa_id": conversa_id})
    db.commit()


def _nao_lidas_por_conversa(db: Session, eu: User, conversa_ids: list[int]) -> dict[int, int]:
    """Mensagens depois da minha última lida, por conversa, pelo índice (conversa_id, id)."""
    if not conversa_ids:
        return {}
    return dict(
        db.execute(
            select(Mensagem.conversa_id, func.count())
            .join(
                ParticipanteConversa,
                (ParticipanteConversa.conversa_id == Mensagem.conversa_id)
                & (ParticipanteConversa.user_id == eu.id),
            )
            .where(
                Mensagem.conversa_id.in_(conversa_ids),
                Mensagem.id > ParticipanteConversa.ultima_lida_id,
                Mensagem.autor_id != eu.id,
            )
            .group_by(Mensagem.conversa_id)
        ).all()
    )


def _enviadas_no_ultimo_minuto(db: Session, autor_id: int) -> int:
    inicio = utc_sem_fuso(datetime.now(UTC) - JANELA_DO_LIMITE)
    return db.scalar(
        select(func.count())
        .select_from(Mensagem)
        .where(Mensagem.autor_id == autor_id, Mensagem.created_at > inicio)
    ) or 0


def _saidas(db: Session, eu: User, lista: list[Mensagem]) -> list[MensagemOut]:
    """MensagemOut de uma lista, com os poemas compartilhados numa consulta só."""
    ids = {m.post_id for m in lista if m.post_id is not None}
    poemas = list(db.scalars(select(Post).where(Post.id.in_(ids)))) if ids else []
    saidas = {p.id: p for p in posts_service.para_saidas(db, poemas, eu)}
    return [
        MensagemOut(
            id=m.id,
            conversa_id=m.conversa_id,
            autor_id=m.autor_id,
            texto=m.texto,
            post=saidas.get(m.post_id) if m.post_id is not None else None,
            post_removido=m.post_removido,
            created_at=m.created_at,
        )
        for m in lista
    ]


def _ler_cursor(cursor: str) -> int:
    if not cursor.isascii() or not cursor.isdigit():
        raise HTTPException(status_code=422, detail="cursor inválido")
    return int(cursor)
