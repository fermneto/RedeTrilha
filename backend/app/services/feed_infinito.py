"""O feed infinito, como no X: o Seguindo e o "Para você" nunca têm última folha.

Cada aba é uma corrente de trechos, lidos em ordem:

- **Seguindo:** o que é de quem a pessoa segue (e o dela, `services/feed.py`);
  depois, o "Para você" cronológico do topo, sem o que a sessão já recebeu;
  depois, a continuação;
- **Para você:** o "Para você" cronológico (`services/para_voce.py`), o trecho
  inédito; depois, a continuação.

A continuação (`core/continuacao.py`) mistura os poemas de consagrados (primeiro
os nunca vistos, numa fila pelas formas e escolas das preferências, depois a
língua de quem lê, depois os mais recentes; quando acabam, a fila recicla do topo,
com `subiu_por` "releitura") com os mais curtidos da comunidade (estes podem
repetir, e vêm com `subiu_por` "curtidas"). Ela só acaba com o banco sem poemas.
"Nunca visto" é o que não saiu nesta sessão (o cursor) nem em sessões anteriores
(`services/vistos_no_feed.py`).

O cursor diz em que trecho a leitura está (`services/cursor.py`): o de cada
trecho cronológico é o de sempre (posição e o que a sessão já viu, então o
inédito continua sem repetidos); o da continuação leva onde ela parou. O cursor
de antes, sem trecho, é o do primeiro trecho da aba e continua valendo.

Paginação: com cursor, a página enche passando de um trecho para o seguinte, e
`fim_em` marca onde acabou o primeiro (no front, a folha "você leu tudo de quem
segue" no Seguindo e "você está em dia" no "Para você"). Por offset (sem cursor), vale só o primeiro trecho, com o
`total` dele, como antes; no fim dele, o `proximo_cursor` já aponta o seguinte.

Custo da continuação, por página: a fila dos consagrados vem do banco já
ordenada e cortada (`ORDER BY ... LIMIT`, com o `NOT EXISTS` do já visto na chave
primária de `vistos_no_feed`), então só `limit` poemas saem do banco, e não os
11 mil; mais uma consulta agregada para os `MAIS_CURTIDOS` e a montagem O(limit)
de `montar_itens`. No banco do seed, a página da continuação caiu de 50 ms para
25 ms de mediana (a fila, de 35 ms para 6 ms).
"""

from collections.abc import Callable

from sqlalchemy import DateTime, case, func, literal, select, tuple_
from sqlalchemy.orm import Session

from app.core import continuacao as continuacao_core
from app.models.atributos_consagrado import AtributosConsagrado
from app.models.curtida import Curtida
from app.models.post import Post
from app.models.preferencia import Preferencia
from app.models.user import User
from app.schemas.feed import FeedPage, PoemaNoFeed
from app.schemas.post import PostOut
from app.schemas.user import UserOut
from app.services import bloqueios, para_voce, vistos_no_feed
from app.services.acervo import lingua_de_quem_ve
from app.services.cursor import (
    CursorDoFeed,
    Trecho,
    codificar_cursor_do_feed,
    ler_cursor_do_feed,
    utc_sem_fuso,
)
from app.services.feed import (
    Linha,
    Parte,
    chave_do_item,
    itens_dos_autores,
    linha_do_item,
    montar_itens,
    parte,
    poema_do_feed,
    posicao_do_item,
    recortar,
)
from app.services.follows import ids_seguidos

# Quantos dos mais curtidos da comunidade rodam na continuação.
MAIS_CURTIDOS = 50

# Um trecho cronológico: (de onde começa, offset, limit) → o que ele entregou.
LerTrecho = Callable[[CursorDoFeed | None, int, int], Parte]


def seguindo(
    db: Session,
    usuario: User,
    offset: int,
    limit: int,
    cursor: str | None = None,
    lingua: str | None = None,
) -> FeedPage:
    """`GET /feed`: quem a pessoa segue, depois o "Para você", depois a continuação."""
    autores = [*ids_seguidos(db, usuario.id), usuario.id]

    def seguidos(inicio: CursorDoFeed | None, offset: int, limit: int) -> Parte:
        recorte = recortar(
            itens_dos_autores(db, autores, usuario),
            posicao_do_item,
            chave_do_item,
            offset,
            limit,
            inicio,
        )
        return parte(db, usuario, recorte, "proprio", linha_do_item, poema_do_feed)

    trechos: list[tuple[Trecho, LerTrecho]] = [
        ("proprio", seguidos),
        ("para_voce", _ler_para_voce(db, usuario, lingua)),
    ]
    return _pagina(db, usuario, offset, limit, cursor, lingua, trechos)


def para_voce_infinito(
    db: Session,
    usuario: User,
    offset: int,
    limit: int,
    cursor: str | None = None,
    lingua: str | None = None,
) -> FeedPage:
    """`GET /feed/para-voce`: o "Para você" cronológico, depois a continuação."""
    trechos: list[tuple[Trecho, LerTrecho]] = [
        ("para_voce", _ler_para_voce(db, usuario, lingua)),
    ]
    return _pagina(db, usuario, offset, limit, cursor, lingua, trechos)


def _ler_para_voce(db: Session, usuario: User, lingua: str | None) -> LerTrecho:
    def ler(inicio: CursorDoFeed | None, offset: int, limit: int) -> Parte:
        return para_voce.parte(db, usuario, lingua, inicio, offset, limit)

    return ler


def _pagina(
    db: Session,
    usuario: User,
    offset: int,
    limit: int,
    cursor: str | None,
    lingua: str | None,
    trechos: list[tuple[Trecho, LerTrecho]],
) -> FeedPage:
    """A página da corrente de `trechos`, mais a continuação no fim (ver o docstring)."""
    inicio = ler_cursor_do_feed(cursor) if cursor is not None else None
    nomes = [nome for nome, _ in trechos]
    if inicio is None:
        indice = 0
    elif inicio.trecho == "continuacao":
        indice = len(trechos)
    else:
        # Sem marca ("proprio"), é o primeiro trecho da aba.
        indice = nomes.index(inicio.trecho) if inicio.trecho in nomes else 0

    itens: list = []
    fim_em: int | None = None
    total: int | None = None
    offset_da_pagina = offset
    primeira = True
    while True:
        if indice < len(trechos):
            lida = trechos[indice][1](inicio, offset, limit - len(itens))
        else:
            lida = _continuacao(db, usuario, lingua, inicio, limit - len(itens))
        if primeira:
            total, offset_da_pagina, primeira = lida.total, lida.offset, False
        itens += lida.itens
        if lida.proximo is not None or indice == len(trechos):
            proximo = lida.proximo
            break
        if indice == 0:
            fim_em = len(itens)
        indice += 1
        nome = nomes[indice] if indice < len(trechos) else "continuacao"
        seguinte = CursorDoFeed(nome, None, lida.vistos)
        # Por offset vale só o primeiro trecho; com a página cheia, para aqui.
        if cursor is None or len(itens) == limit:
            proximo = seguinte
            break
        inicio = seguinte

    return FeedPage(
        items=itens,
        total=total,
        offset=offset_da_pagina,
        limit=limit,
        proximo_cursor=codificar_cursor_do_feed(proximo) if proximo else None,
        fim_em=fim_em,
    )


def _continuacao(
    db: Session, usuario: User, lingua: str | None, inicio: CursorDoFeed, quantos: int
) -> Parte:
    """Os próximos `quantos` da continuação. O cursor seguinte só vem None quando
    ela não tem mais o que dar (o banco sem poemas)."""
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    estado = inicio.continuacao or continuacao_core.Estado()
    fila = _fila_de_consagrados(
        db, usuario, lingua_de_quem_ve(db, usuario, lingua), bloqueados, inicio.vistos, estado, quantos
    )
    escolhidos, estado = continuacao_core.intercalar(
        estado, quantos, fila, _mais_curtidos(db, bloqueados)
    )
    linhas = [Linha("poema", post_id, fonte, []) for fonte, post_id in escolhidos]
    return Parte(
        itens=montar_itens(db, usuario, linhas, _poema_da_continuacao),
        offset=0,
        total=None,
        proximo=(
            CursorDoFeed("continuacao", None, inicio.vistos, estado)
            if len(escolhidos) == quantos
            else None
        ),
        vistos=inicio.vistos,
    )


def _fila_de_consagrados(
    db: Session,
    usuario: User,
    lingua: str | None,
    bloqueados: set[int],
    vistos_na_sessao: frozenset[tuple[str, int]],
    estado: continuacao_core.Estado,
    quantos: int,
) -> list[continuacao_core.Candidato]:
    """Os próximos `quantos` consagrados da fila, a partir do `estado`, ordenados e
    cortados no banco (`_proximos_consagrados`). Quando a rodada acaba, começa a
    seguinte do topo (a reciclagem); para se não houver consagrado nenhum."""
    ordem = _ordem_dos_consagrados(db, usuario, lingua)
    sessao = [id_ for tipo, id_ in vistos_na_sessao if tipo == "poema"]
    fila: list[continuacao_core.Candidato] = []
    rodada, depois = estado.rodada, estado.ultimo_consagrado
    while len(fila) < quantos:
        falta = quantos - len(fila)
        lote = _proximos_consagrados(
            db, usuario.id, ordem, bloqueados, sessao, rodada == 0, depois, falta
        )
        fila += [continuacao_core.Candidato(post_id, rodada, posicao) for post_id, posicao in lote]
        if len(lote) == falta:
            break
        if rodada > 0 and depois is None and not lote:
            break  # nenhum consagrado no banco
        rodada, depois = rodada + 1, None
    return fila


def _ordem_dos_consagrados(db: Session, usuario: User, lingua: str | None) -> list:
    """As colunas da ordem da fila, em SQL: prioridade pelas preferências (1 pela
    forma, 1 pelas escolas do poeta), a língua de quem lê, a data e o id."""
    preferencia = db.get(Preferencia, usuario.id)
    formas = sorted(set(preferencia.formas or [])) if preferencia else []
    escolas = set(preferencia.escolas or []) if preferencia else set()
    poetas_das_escolas = sorted(
        user_id
        for user_id, lista in db.execute(
            select(AtributosConsagrado.user_id, AtributosConsagrado.escolas)
        )
        if escolas & set(lista or [])
    )
    pela_forma = case((Post.forma.in_(formas), 1), else_=0) if formas else literal(0)
    pelas_escolas = (
        case((Post.autor_id.in_(poetas_das_escolas), 1), else_=0)
        if poetas_das_escolas
        else literal(0)
    )
    pela_lingua = case((Post.idioma == lingua, 1), else_=0) if lingua else literal(0)
    return [pela_forma + pelas_escolas, pela_lingua, Post.created_at, Post.id]


def _proximos_consagrados(
    db: Session,
    user_id: int,
    ordem: list,
    bloqueados: set[int],
    vistos_na_sessao: list[int],
    so_ineditos: bool,
    depois: continuacao_core.PosicaoNaFila | None,
    quantos: int,
) -> list[tuple[int, continuacao_core.PosicaoNaFila]]:
    """Até `quantos` consagrados depois de `depois`, na ordem da fila, com
    `ORDER BY ... LIMIT` no banco (sem carregar os milhares de poemas). Na rodada
    inédita, fora o que a pessoa já viu, nesta sessão ou em outra."""
    prioridade, lingua, data, post_id = ordem
    consulta = (
        select(Post.id, prioridade, lingua, Post.created_at)
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro, User.consagrado, Post.autor_id.not_in(bloqueados))
    )
    if depois is not None:
        p, l_, d, i = depois
        consulta = consulta.where(
            tuple_(prioridade, lingua, data, post_id)
            < tuple_(literal(p), literal(l_), literal(d, DateTime()), literal(i))
        )
    if so_ineditos:
        consulta = consulta.where(
            Post.id.not_in(vistos_na_sessao), vistos_no_feed.nao_visto(user_id, "poema", Post.id)
        )
    linhas = db.execute(
        consulta.order_by(
            prioridade.desc(), lingua.desc(), data.desc(), post_id.desc()
        ).limit(quantos)
    )
    return [
        (id_, (int(p), int(l_), utc_sem_fuso(criado), id_)) for id_, p, l_, criado in linhas
    ]


def _mais_curtidos(db: Session, bloqueados: set[int]) -> list[int]:
    """Os `MAIS_CURTIDOS` poemas da comunidade com mais curtidas, o mais curtido
    primeiro. Sem poema da comunidade, valem os de qualquer conta (consagrados)."""

    def consulta(so_da_comunidade: bool):
        curtidas = func.count(Curtida.id)
        filtro = [~Post.repost_puro, Post.autor_id.not_in(bloqueados)]
        if so_da_comunidade:
            filtro.append(~User.consagrado)
        return (
            select(Post.id)
            .join(User, User.id == Post.autor_id)
            .outerjoin(Curtida, Curtida.post_id == Post.id)
            .where(*filtro)
            .group_by(Post.id)
            .order_by(curtidas.desc(), Post.id.desc())
            .limit(MAIS_CURTIDOS)
        )

    return list(db.scalars(consulta(True))) or list(db.scalars(consulta(False)))


# A fonte do item da continuação → o `subiu_por`; o que pode repetir vem marcado.
_SUBIU_POR = {"curtido": "curtidas", "releitura": "releitura"}


def _poema_da_continuacao(saida: PostOut, rotulo: list[UserOut], acao: str) -> PoemaNoFeed:
    """Sem rótulo de repost nem de comentário. O mais curtido vem com "curtidas" e
    o consagrado reciclado com "releitura": os dois podem repetir na sessão."""
    return PoemaNoFeed(
        **{**saida.model_dump(), "repostado_por": []},
        subiu_por=_SUBIU_POR.get(acao),
    )
