"""Feed "Para você", como a aba do X: a rede inteira, para o feed nunca começar vazio.

Mistura, de todos os poetas (seguidos ou não, inclusive a própria pessoa):

- poemas publicados (e citações) de quem não é consagrado;
- reposts puros, como no X: o poema sobe na data do repost mais recente, com
  "repostado por" (todos que repostaram, por último primeiro), uma vez só;
- rengas abertas, na estrofe mais recente ("fulano abriu uma renga" /
  "fulano escreveu uma estrofe", como no feed Seguindo);
- poemas de consagrados, rareados, com os em português na frente (ver
  `JANELA_DO_CONSAGRADO`);
- poemas que receberam comentário ou crítica: o poema sobe com o comentário
  mais recente e o rótulo "fulano comentou" ("subiu_por" e "comentado_por").

O rótulo é o da atividade mais recente: um poema que subiu por comentário mostra
quem comentou, e não quem repostou. Rascunhos não estão em `posts`, então
nunca entram.

A ordem é cronológica pela atividade, sem ranking por engajamento (decisão 3);
a mistura e o desempate ficam em `core/mistura.py`. A paginação é a do feed
Seguindo: `limit`, `offset` com `total`, ou um `cursor` opaco (data, chave) que
tem precedência sobre o offset e devolve `total` None.

Custo: O(n log n) com n = posts da rede (poemas e reposts puros) + estrofes das rengas
abertas + comentários, carregados só com ids e datas (sem o texto); depois a
mesma montagem O(limit) do feed Seguindo (`montar_pagina`, em `services/feed.py`).
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.core.mistura import Atividade, ItemMisturado, misturar, rarear_consagrados
from app.models.ancora_comentario import AncoraComentario
from app.models.comentario import Comentario
from app.models.post import Post
from app.models.renga import EstrofeRenga, Renga
from app.models.user import User
from app.schemas.feed import FeedPage, PoemaNoFeed
from app.schemas.post import PostOut
from app.schemas.user import UserOut
from app.services.cursor import utc_sem_fuso
from app.services.feed import Linha, montar_pagina, recortar

# PROVISÓRIO (o Neto decide o equilíbrio): dos poemas de consagrados, entra só um
# de cada janela de 3 horas, uns 8 por dia, para os milhares de poemas do acervo
# não afogarem os poetas da rede: o mais recente em português, se a janela tiver
# algum, senão o mais recente. Comentário em poema de consagrado sobe o poema do
# mesmo jeito, fora dessa conta.
JANELA_DO_CONSAGRADO = timedelta(hours=3)


def feed(
    db: Session, usuario: User, offset: int, limit: int, cursor: str | None = None
) -> FeedPage:
    atividades = rarear_consagrados(
        [*_poemas(db), *_reposts(db), *_estrofes_abertas(db), *_comentarios(db)],
        int(JANELA_DO_CONSAGRADO.total_seconds()),
    )
    recorte = recortar(
        misturar(atividades), lambda item: item.atividade.posicao, offset, limit, cursor
    )
    return montar_pagina(db, usuario, recorte, limit, _linha, _poema_do_feed)


def _linha(item: ItemMisturado) -> Linha:
    atividade = item.atividade
    return Linha(atividade.tipo, atividade.alvo_id, atividade.acao, item.por, atividade.posicao)


def _poemas(db: Session) -> list[Atividade]:
    """Poemas e citações da rede (reposts puros ficam fora)."""
    linhas = db.execute(
        select(Post.id, Post.autor_id, User.consagrado, Post.created_at, Post.idioma)
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro)
    )
    return [
        Atividade(
            "poema",
            "publicou",
            post_id,
            post_id,
            autor_id,
            utc_sem_fuso(criado),
            consagrado,
            idioma == "pt",
        )
        for post_id, autor_id, consagrado, criado, idioma in linhas
    ]


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
        .where(~Comentario.removido)
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
