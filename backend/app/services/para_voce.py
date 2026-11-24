"""Feed "Para você", como a aba do X: a rede inteira, para o feed nunca começar vazio.

Mistura, de todos os poetas (seguidos ou não, inclusive a própria pessoa):

- poemas publicados (e citações) de quem não é consagrado;
- rengas abertas, na estrofe mais recente ("fulano abriu uma renga" /
  "fulano escreveu uma estrofe", como no feed Seguindo);
- poemas de consagrados, rareados (ver `JANELA_DO_CONSAGRADO`);
- poemas que receberam comentário ou crítica: o poema sobe com o comentário
  mais recente e o rótulo "fulano comentou" ("subiu_por" e "comentado_por").

Reposts puros ficam de fora: o "Para você" mostra o poema, e quem repostou só
importa a quem segue (o feed Seguindo). Rascunhos não estão em `posts`, então
nunca entram.

A ordem é cronológica pela atividade, sem ranking por engajamento (decisão 3);
a mistura e o desempate ficam em `core/mistura.py`. A paginação é a do feed
Seguindo: `limit`, `offset` com `total`, ou um `cursor` opaco (data, chave) que
tem precedência sobre o offset e devolve `total` None.

Custo: O(n log n) com n = poemas não repostados da rede + estrofes das rengas
abertas + comentários, carregados só com ids e datas (sem o texto); depois as
mesmas queries O(limit) do feed Seguindo para montar a página.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.mistura import Atividade, ItemMisturado, misturar, rarear_consagrados
from app.models.ancora_comentario import AncoraComentario
from app.models.comentario import Comentario
from app.models.post import Post
from app.models.renga import EstrofeRenga, Renga
from app.models.user import User
from app.schemas.feed import FeedPage, PoemaNoFeed, RengaNoFeed
from app.schemas.user import UserOut
from app.services import rengas as rengas_service
from app.services.cursor import codificar_cursor, ler_cursor, utc_sem_fuso
from app.services.posts import para_saidas

# PROVISÓRIO (o Neto decide o equilíbrio): dos poemas de consagrados, entra só o
# mais recente de cada janela de 3 horas, uns 8 por dia, para os milhares de
# poemas do acervo não afogarem os poetas da rede. Comentário em poema de
# consagrado sobe o poema do mesmo jeito, fora dessa conta.
JANELA_DO_CONSAGRADO = timedelta(hours=3)


def feed(
    db: Session, usuario: User, offset: int, limit: int, cursor: str | None = None
) -> FeedPage:
    atividades = rarear_consagrados(
        [*_poemas(db), *_estrofes_abertas(db), *_comentarios(db)],
        int(JANELA_DO_CONSAGRADO.total_seconds()),
    )
    itens = misturar(atividades)
    if cursor is not None:
        depois = ler_cursor(cursor)
        offset = next(
            (i for i, item in enumerate(itens) if item.atividade.posicao < depois), len(itens)
        )
    pagina = itens[offset : offset + limit]
    tem_mais = offset + limit < len(itens)
    return FeedPage(
        items=_montar(db, pagina, usuario),
        total=None if cursor is not None else len(itens),
        offset=offset,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(*pagina[-1].atividade.posicao) if pagina and tem_mais else None
        ),
    )


def _poemas(db: Session) -> list[Atividade]:
    """Poemas e citações da rede (reposts puros ficam fora)."""
    linhas = db.execute(
        select(Post.id, Post.autor_id, User.consagrado, Post.created_at)
        .join(User, User.id == Post.autor_id)
        .where(~Post.repost_puro)
    )
    return [
        Atividade("poema", "publicou", post_id, post_id, autor_id, utc_sem_fuso(criado), consagrado)
        for post_id, autor_id, consagrado, criado in linhas
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


def _montar(
    db: Session, pagina: list[ItemMisturado], usuario: User
) -> list[PoemaNoFeed | RengaNoFeed]:
    poemas = [item for item in pagina if item.atividade.tipo == "poema"]
    ids = {item.atividade.alvo_id for item in poemas}
    por_id = {post.id: post for post in db.scalars(select(Post).where(Post.id.in_(ids)))}
    ids_do_rotulo = {autor_id for item in pagina for autor_id in item.por}
    usuarios = {
        user.id: UserOut.model_validate(user)
        for user in db.scalars(select(User).where(User.id.in_(ids_do_rotulo)))
    }
    saidas = iter(para_saidas(db, [por_id[item.atividade.alvo_id] for item in poemas], usuario))

    itens: list[PoemaNoFeed | RengaNoFeed] = []
    for item in pagina:
        rotulo = [usuarios[autor_id] for autor_id in item.por]
        acao = item.atividade.acao
        if item.atividade.tipo == "poema":
            itens.append(
                PoemaNoFeed(
                    **next(saidas).model_dump(),
                    subiu_por={"comentou": "comentario", "criticou": "critica"}.get(acao),
                    comentado_por=rotulo,
                )
            )
        else:
            itens.append(
                RengaNoFeed(
                    renga=rengas_service.detalhar(db, usuario, item.atividade.alvo_id),
                    atividade=acao,
                    por=rotulo,
                )
            )
    return itens
