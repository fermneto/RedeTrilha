"""Feed "Para você", como a aba do X: a rede inteira, para o feed nunca começar vazio.

Mistura, de todos os poetas (seguidos ou não, inclusive a própria pessoa):

- poemas publicados (e citações) de quem não é consagrado;
- reposts puros, como no X: o poema sobe na data do repost mais recente, com
  "repostado por" (todos que repostaram, por último primeiro), uma vez só;
- reposts de renga (#171), abertas ou fechadas, do mesmo jeito: a renga sobe na
  data do repost mais recente, com "fulano repostou" (todos, por último primeiro);
- rengas abertas, na estrofe mais recente ("fulano abriu uma renga" /
  "fulano escreveu uma estrofe", como no feed Seguindo);
- poemas de consagrados, rareados, com os da língua de quem vê na frente (ver
  `JANELA_DO_CONSAGRADO`): a do navegador (`lingua`) ou, sem ela, a mais
  frequente nos poemas da própria pessoa, como nas sugestões;
- poemas que receberam comentário ou crítica: o poema sobe com o comentário
  mais recente e o rótulo "fulano comentou" ("subiu_por" e "comentado_por").

O rótulo é o da atividade mais recente: um poema que subiu por comentário mostra
quem comentou, e não quem repostou. Rascunhos não estão em `posts`, então
nunca entram.

A ordem é cronológica pela atividade, sem ranking por engajamento (decisão 3);
a mistura e o desempate ficam em `core/mistura.py`. A paginação é a do feed
Seguindo: `limit`, `offset` com `total`, ou um `cursor` opaco (data, chave) que
tem precedência sobre o offset e devolve `total` None.

Custo: O(n log n) com n = posts da rede (poemas e reposts puros) + um poema de
consagrado por janela + estrofes das rengas abertas + comentários, carregados só
com ids e datas (sem o texto). Os milhares de poemas de consagrados são cortados
no banco, com `row_number()` por janela sobre o índice `ix_posts_autorais`; depois a
mesma montagem O(limit) do feed Seguindo (`montar_pagina`, em `services/feed.py`).
"""

from datetime import timedelta

from sqlalchemy import Integer, case, cast, func, literal, select
from sqlalchemy.orm import Session, aliased

from app.core.mistura import Atividade, ItemMisturado, misturar, rarear_consagrados
from app.models.ancora_comentario import AncoraComentario
from app.models.comentario import Comentario
from app.models.post import Post
from app.models.renga import EstrofeRenga, Renga
from app.models.repost_renga import RepostRenga
from app.models.user import User
from app.schemas.feed import FeedPage, PoemaNoFeed
from app.schemas.post import PostOut
from app.schemas.user import UserOut
from app.services import bloqueios
from app.services.acervo import lingua_de_quem_ve
from app.services.cursor import utc_sem_fuso
from app.services.feed import Linha, montar_pagina, recortar

# Dos poemas de consagrados, entra só um de cada janela de 3 horas, uns 8 por
# dia, para os milhares de poemas do acervo não afogarem os poetas da rede: o
# mais recente na língua de quem vê, se a janela tiver algum, senão o mais
# recente. Comentário em poema de consagrado sobe o poema do mesmo jeito, fora
# dessa conta.
JANELA_DO_CONSAGRADO = timedelta(hours=3)


def feed(
    db: Session,
    usuario: User,
    offset: int,
    limit: int,
    cursor: str | None = None,
    lingua: str | None = None,
) -> FeedPage:
    lingua = lingua_de_quem_ve(db, usuario, lingua)
    segundos = int(JANELA_DO_CONSAGRADO.total_seconds())
    # Sem o que tem a ver com quem tem bloqueio com o usuário (services/bloqueios.py).
    atividades = rarear_consagrados(
        bloqueios.sem_bloqueados(
            db,
            usuario.id,
            [
                *_poemas(db),
                *_candidatos_dos_consagrados(db, segundos, lingua),
                *_reposts(db),
                *_reposts_de_renga(db),
                *_estrofes_abertas(db),
                *_comentarios(db),
            ],
        ),
        segundos,
        lingua,
    )
    recorte = recortar(
        misturar(atividades), lambda item: item.atividade.posicao, offset, limit, cursor
    )
    return montar_pagina(db, usuario, recorte, limit, _linha, _poema_do_feed)


def _linha(item: ItemMisturado) -> Linha:
    atividade = item.atividade
    return Linha(atividade.tipo, atividade.alvo_id, atividade.acao, item.por, atividade.posicao)


def _poemas(db: Session) -> list[Atividade]:
    """Poemas e citações de quem não é consagrado (reposts puros ficam fora)."""
    linhas = db.execute(
        select(Post.id, Post.autor_id, Post.created_at, Post.idioma)
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro, ~User.consagrado)
    )
    return [
        Atividade(
            "poema", "publicou", post_id, post_id, autor_id, utc_sem_fuso(criado), False, idioma
        )
        for post_id, autor_id, criado, idioma in linhas
    ]


def _candidatos_dos_consagrados(
    db: Session, segundos: int, lingua: str | None
) -> list[Atividade]:
    """Só o candidato de cada janela entre os poemas de consagrados, escolhido no banco.

    Desempenho: são milhares de poemas, e carregar todos para o `rarear_consagrados`
    descartar quase tudo custava uns 70 ms de CPU por requisição. A consulta faz a
    mesma escolha (a língua de quem vê primeiro, depois o mais recente, por
    `(created_at, id)`) com `row_number()` por janela, e o `rarear_consagrados`
    continua valendo por cima: a regra é a do core, o banco só corta o volume.
    """
    preferido = case((Post.idioma == lingua, 1), else_=0) if lingua else literal(0)
    posicao = func.row_number().over(
        partition_by=_janela_sql(db, segundos),
        order_by=(preferido.desc(), Post.created_at.desc(), Post.id.desc()),
    )
    ranking = (
        select(
            Post.id,
            Post.autor_id,
            Post.created_at,
            Post.idioma,
            posicao.label("posicao"),
        )
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro, User.consagrado)
        .subquery()
    )
    linhas = db.execute(
        select(ranking.c.id, ranking.c.autor_id, ranking.c.created_at, ranking.c.idioma).where(
            ranking.c.posicao == 1
        )
    )
    return [
        Atividade(
            "poema", "publicou", post_id, post_id, autor_id, utc_sem_fuso(criado), True, idioma
        )
        for post_id, autor_id, criado, idioma in linhas
    ]


def _janela_sql(db: Session, segundos: int):
    """O `janela_de` do core em SQL: segundos desde a época (UTC) divididos pela janela.

    As datas ficam sem fuso, em UTC, nos dois bancos (`core/datas.py`).
    """
    if db.get_bind().dialect.name == "sqlite":
        epoca = cast(func.strftime("%s", Post.created_at), Integer)
    else:
        epoca = cast(func.floor(func.extract("epoch", Post.created_at)), Integer)
    return epoca // segundos


def _reposts(db: Session) -> list[Atividade]:
    """Reposts puros cujo original ainda existe; o alvo é o original."""
    original = aliased(Post)
    linhas = db.execute(
        select(Post.id, Post.autor_id, Post.repost_de_id, Post.created_at)
        .join(original, original.id == Post.repost_de_id)
        .where(Post.repost_puro)
    )
    return [
        Atividade("poema", "repostou", post_id, original_id, autor_id, utc_sem_fuso(criado))
        for post_id, autor_id, original_id, criado in linhas
    ]


def _reposts_de_renga(db: Session) -> list[Atividade]:
    """Reposts de renga, como os reposts puros: o alvo é a renga."""
    linhas = db.execute(
        select(RepostRenga.id, RepostRenga.user_id, RepostRenga.renga_id, RepostRenga.created_at)
    )
    return [
        Atividade("renga", "repostou", repost_id, renga_id, user_id, utc_sem_fuso(criado))
        for repost_id, user_id, renga_id, criado in linhas
    ]


def _estrofes_abertas(db: Session) -> list[Atividade]:
    """Estrofes das rengas que ainda aceitam estrofe: do criador é "abriu"."""
    linhas = db.execute(
        select(
            EstrofeRenga.id,
            EstrofeRenga.autor_id,
            EstrofeRenga.renga_id,
            Renga.criador_id,
            EstrofeRenga.created_at,
        )
        .join(Renga, Renga.id == EstrofeRenga.renga_id)
        .where(Renga.fechada_em.is_(None))
    )
    return [
        Atividade(
            "renga",
            "abriu" if autor_id == criador_id else "escreveu",
            estrofe_id,
            renga_id,
            autor_id,
            utc_sem_fuso(criado),
        )
        for estrofe_id, autor_id, renga_id, criador_id, criado in linhas
    ]


def _comentarios(db: Session) -> list[Atividade]:
    """Comentários e respostas não removidos; com âncora nos versos, é crítica."""
    linhas = db.execute(
        select(
            Comentario.id,
            Comentario.post_id,
            Comentario.autor_id,
            Comentario.created_at,
            AncoraComentario.comentario_id.is_not(None),
        )
        .outerjoin(AncoraComentario, AncoraComentario.comentario_id == Comentario.id)
        .join(Post, Post.id == Comentario.post_id)
        # O comentário de quem tem bloqueio com o autor do poema está escondido para todos.
        .where(~Comentario.removido, ~bloqueios.ha_bloqueio(Comentario.autor_id, Post.autor_id))
    )
    return [
        Atividade(
            "poema",
            "criticou" if ancorado else "comentou",
            comentario_id,
            post_id,
            autor_id,
            utc_sem_fuso(criado),
        )
        for comentario_id, post_id, autor_id, criado, ancorado in linhas
    ]


# A ação do comentário que subiu o poema → o `subiu_por` da resposta.
_SUBIU_POR = {"comentou": "comentario", "criticou": "critica"}


def _poema_do_feed(saida: PostOut, rotulo: list[UserOut], acao: str) -> PoemaNoFeed:
    return PoemaNoFeed(
        **{**saida.model_dump(), "repostado_por": rotulo if acao == "repostou" else []},
        subiu_por=_SUBIU_POR.get(acao),
        comentado_por=rotulo if acao in _SUBIU_POR else [],
    )
