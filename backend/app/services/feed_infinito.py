"""O feed infinito, como no X: o Seguindo e o "Para você" nunca têm última folha.

Cada aba é uma corrente de trechos, lidos em ordem:

- **Seguindo:** o que é de quem a pessoa segue (e o dela, `services/feed.py`);
  depois, o "Para você" cronológico do topo, sem o que a sessão já recebeu;
  depois, a continuação;
- **Para você:** o "Para você" cronológico (`services/para_voce.py`), o trecho
  inédito; depois, a continuação.

A continuação (`core/continuacao.py`) mistura os poemas de consagrados que a
sessão ainda não recebeu, primeiro os das formas e escolas das preferências da
pessoa, com os mais curtidos da comunidade (estes podem repetir, e vêm com
`subiu_por` "curtidas"). Ela só acaba com o banco sem poemas.

O cursor diz em que trecho a leitura está (`services/cursor.py`): o de cada
trecho cronológico é o de sempre (posição e o que a sessão já viu, então o
inédito continua sem repetidos); o da continuação leva onde ela parou. O cursor
de antes, sem trecho, é o do primeiro trecho da aba e continua valendo.

Paginação: com cursor, a página enche passando de um trecho para o seguinte, e
`fim_em` marca onde acabou o primeiro (no Seguindo, a folha "você leu tudo de
quem segue" do front). Por offset (sem cursor), vale só o primeiro trecho, com o
`total` dele, como antes; no fim dele, o `proximo_cursor` já aponta o seguinte.

Custo da continuação: uma consulta com os poemas de consagrados (só ids, datas,
autor e forma, sem o texto), a fila de `core/continuacao.proximos` em
O(m log m), uma consulta agregada para os `MAIS_CURTIDOS` e a montagem O(limit)
de `montar_itens`.
"""

from collections.abc import Callable

from sqlalchemy import func, select
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
from app.services import bloqueios, para_voce
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
    return _pagina(db, usuario, offset, limit, cursor, trechos)


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
    return _pagina(db, usuario, offset, limit, cursor, trechos)


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
            lida = _continuacao(db, usuario, inicio, limit - len(itens))
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


def _continuacao(db: Session, usuario: User, inicio: CursorDoFeed, quantos: int) -> Parte:
    """Os próximos `quantos` da continuação. O cursor seguinte só vem None quando
    ela não tem mais o que dar (o banco sem poemas)."""
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    ja_vistos = {id_ for tipo, id_ in inicio.vistos if tipo == "poema"}
    escolhidos, estado = continuacao_core.proximos(
        _consagrados(db, usuario, bloqueados),
        _mais_curtidos(db, bloqueados),
        ja_vistos,
        inicio.continuacao or continuacao_core.Estado(),
        quantos,
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


def _consagrados(
    db: Session, usuario: User, bloqueados: set[int]
) -> list[continuacao_core.Consagrado]:
    """Os poemas de consagrados (sem o texto), com a prioridade pelas preferências."""
    preferencia = db.get(Preferencia, usuario.id)
    formas = set(preferencia.formas or []) if preferencia else set()
    escolas = set(preferencia.escolas or []) if preferencia else set()
    escolas_do_poeta: dict[int, list[str]] = {
        user_id: lista or []
        for user_id, lista in db.execute(
            select(AtributosConsagrado.user_id, AtributosConsagrado.escolas)
        )
    }
    linhas = db.execute(
        select(Post.id, Post.autor_id, Post.forma, Post.created_at)
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro, User.consagrado)
    )
    return [
        continuacao_core.Consagrado(
            post_id,
            utc_sem_fuso(criado),
            continuacao_core.prioridade(
                forma, escolas_do_poeta.get(autor_id, []), formas, escolas
            ),
        )
        for post_id, autor_id, forma, criado in linhas
        if autor_id not in bloqueados
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


def _poema_da_continuacao(saida: PostOut, rotulo: list[UserOut], acao: str) -> PoemaNoFeed:
    """Sem rótulo de repost nem de comentário; o mais curtido vem com "curtidas"."""
    return PoemaNoFeed(
        **{**saida.model_dump(), "repostado_por": []},
        subiu_por="curtidas" if acao == "curtido" else None,
    )
