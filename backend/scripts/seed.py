"""Seed do Verso: poetas fictícios de vários lugares e idades, os poemas deles e os consagrados.

`seed_fake(db)` cria os poetas de `seed_conteudo.py`, publica os poemas e monta a rede em volta deles: follows, curtidas,
comentários em árvore (com dois removidos que têm respostas), reposts puros,
citações, antologias e rengas. Rode com: make seed (ou make reset, do zero).

Interações pelos services. Poemas, curtidas, reposts, comentários, follows e
antologias passam pelas mesmas funções que a API usa, então valem as mesmas
regras: citar ou curtir um repost puro vai no original, o poema entra no índice
de tags, apagar um comentário com respostas deixa o marcador. Só os usuários
são criados direto pelo model: `auth.registrar` faz um bcrypt por usuário
(quase um segundo para todos) e não grava bio. O seed valida cada um com o
`UserCreate` (padrão e usernames reservados), gera um hash só da senha com
`gerar_hash`, como o registro faria.

Datas. Os services gravam a hora atual; o seed reescreve o `created_at` com
datas espalhadas pelos últimos 14 dias, parte nas últimas 24 h (para o
trending ter dados), sorteadas por um `random.Random` de semente fixa: o mesmo
seed gera a mesma rede, só ancorada no `agora` de cada execução.

Índice de tags. O índice mora no banco (`post_tags`). O `posts.criar` indexa
cada poema na mesma transação, e o seed reindexa com a data reescrita. A API
lê dali: rodou o seed com ela de pé, as tags já aparecem, sem restart.
"""

import random
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models.antologia import Antologia
from app.models.comentario import Comentario
from app.models.curtida import Curtida
from app.models.follow import Follow
from app.models.post import Post
from app.models.renga import Renga
from app.models.user import User
from app.schemas.antologia import AntologiaCreate
from app.schemas.comentario import ComentarioCreate
from app.schemas.post import PostCreate
from app.schemas.renga import RengaCreate
from app.schemas.user import UserCreate
from app.services import antologias as antologias_service
from app.services import comentarios as comentarios_service
from app.services import curtidas as curtidas_service
from app.services import follows as follows_service
from app.services import indice_tags
from app.services import posts as posts_service
from app.services import rengas as rengas_service
from app.services import reposts as reposts_service
from app.services.auth import gerar_hash
from scripts import importar_consagrados
from scripts.seed_conteudo import (
    ANTOLOGIAS,
    CITACAO_DE_CONSAGRADO,
    CITACOES,
    CONTA_DEMO,
    CONVERSAS,
    EM_ALTA,
    POEMAS,
    POETAS,
    RENGAS,
    Conversa,
)

# Todo usuário de exemplo entra com esta senha (README, "Como começar").
# Consagrados não passam por aqui: ficam com password_hash=None, sem login.
SENHA_SEED = "verso123"
SEMENTE = 2026
JANELA = timedelta(days=14)
FRACAO_RECENTE = 0.25
REPOSTS_PUROS = 14
CONSAGRADOS_SEGUIDOS = 3
CONSAGRADOS_DA_DEMO = 8


def seed_fake(db: Session, agora: datetime | None = None) -> bool:
    """Popula a rede. Idempotente: se algum usuário do seed já existe, não faz nada.

    Devolve se criou. Grava numa transação só (ver `_transacao_unica`) e, ao
    fim, liga os poetas do seed aos consagrados, se já houver algum no banco.
    """
    if db.scalar(select(User.id).where(User.username.in_([p.username for p in POETAS]))):
        return False
    agora = agora or datetime.now(UTC)
    with _transacao_unica(db) as sessao:
        _popular(sessao, agora)
        _interagir_com_consagrados(sessao, agora)
    return True


def interagir_com_consagrados(db: Session, agora: datetime | None = None) -> None:
    """Liga os poetas do seed aos consagrados, se houver: follows, curtidas, um repost e uma citação.

    Roda depois da importação (no `main`) e no fim do `seed_fake`. Idempotente:
    seguir, curtir e repostar já são; a citação só é feita uma vez.
    """
    with _transacao_unica(db) as sessao:
        _interagir_com_consagrados(sessao, agora or datetime.now(UTC))


@contextmanager
def _transacao_unica(db: Session) -> Iterator[Session]:
    """Uma sessão cujos commits só fazem flush; o banco grava uma vez, no fim.

    Os services dão commit a cada passo, e no SQLite cada commit é um fsync:
    com quase mil deles, o seed levava uns 15 s. Presa a uma transação externa
    com `join_transaction_mode="rollback_only"`, a sessão não propaga o commit,
    e o seed fica também tudo ou nada: um erro no meio desfaz a rede inteira.
    """
    with (
        db.get_bind().connect() as conexao,
        conexao.begin(),
        Session(
            bind=conexao,
            join_transaction_mode="rollback_only",
            autoflush=False,
            expire_on_commit=False,
        ) as sessao,
    ):
        yield sessao


def _popular(db: Session, agora: datetime) -> None:
    rng = random.Random(SEMENTE)
    usuarios = _criar_usuarios(db, rng, agora)
    poetas = [usuarios[p.username] for p in POETAS]
    datas: dict[int, datetime] = {}
    poemas = _publicar_poemas(db, rng, usuarios, datas, agora)
    _citar(db, rng, usuarios, poemas, datas, agora)
    _seguir(db, rng, poetas, agora)
    reposts = _repostar(db, rng, poetas, poemas, datas, agora)
    _curtir(db, rng, list(usuarios.values()), poemas, reposts, datas, agora)
    _comentar(db, usuarios, poemas, datas, agora)
    _montar_antologias(db, usuarios, poemas)
    _escrever_rengas(db, usuarios)


def _interagir_com_consagrados(db: Session, agora: datetime) -> None:
    consagrados = list(
        db.scalars(select(User).where(User.consagrado.is_(True)).order_by(User.id))
    )
    poetas = list(
        db.scalars(
            select(User)
            .where(User.username.in_([p.username for p in POETAS]))
            .order_by(User.id)
        )
    )
    if not consagrados or not poetas:
        return
    rng = random.Random(SEMENTE + 1)
    for leitor in poetas:
        quantos = CONSAGRADOS_DA_DEMO if leitor.username == CONTA_DEMO else CONSAGRADOS_SEGUIDOS
        for poeta in rng.sample(consagrados, min(quantos, len(consagrados))):
            follows_service.seguir(db, leitor, poeta.username)

    classicos = list(
        db.scalars(
            select(Post)
            .where(
                Post.autor_id.in_([c.id for c in consagrados]),
                Post.repost_de_id.is_(None),
            )
            .order_by(Post.id)
        )
    )
    if not classicos:
        return
    for leitor in poetas:
        for poema in rng.sample(classicos, min(2, len(classicos))):
            curtidas_service.curtir(db, leitor, poema.id)
    por_username = {u.username: u for u in poetas}
    reposts_service.repostar(db, por_username["thiago_hist"], classicos[0].id)

    citante = por_username[CITACAO_DE_CONSAGRADO.autor]
    ja_citou = db.scalar(
        select(Post.id).where(
            Post.autor_id == citante.id,
            Post.repost_de_id.in_([p.id for p in classicos]),
            Post.texto != "",
        )
    )
    if ja_citou is None:
        citado = classicos[0]
        _publicar(
            db,
            citante,
            agora - timedelta(hours=3),
            PostCreate(
                texto=CITACAO_DE_CONSAGRADO.texto.format(nome=citado.autor.name),
                forma="verso_livre",
                repost_de_id=citado.id,
            ),
        )


def _criar_usuarios(db: Session, rng: random.Random, agora: datetime) -> dict[str, User]:
    senha = gerar_hash(SENHA_SEED)
    usuarios = {}
    for poeta in POETAS:
        dados = UserCreate(username=poeta.username, name=poeta.name, bio=poeta.bio)
        user = User(
            **dados.model_dump(),
            password_hash=senha,
            created_at=agora - JANELA - timedelta(days=rng.uniform(1, 60)),
        )
        db.add(user)
        usuarios[user.username] = user
    db.commit()
    return usuarios


def _publicar(db: Session, autor: User, momento: datetime, dados: PostCreate) -> Post:
    """Cria pelo service e reescreve a data, reindexando o poema com ela."""
    post = posts_service.criar(db, autor, dados)
    post.created_at = post.updated_at = momento
    indice_tags.indexar(db, post)
    db.commit()
    return post


def _publicar_poemas(
    db: Session,
    rng: random.Random,
    usuarios: dict[str, User],
    datas: dict[int, datetime],
    agora: datetime,
) -> dict[str, Post]:
    """Publica em ordem cronológica, para os ids crescerem com o tempo."""
    agendados = []
    for poema in POEMAS:
        if rng.random() < FRACAO_RECENTE:
            atras = timedelta(hours=rng.uniform(0.5, 23))
        else:
            atras = timedelta(hours=rng.uniform(25, JANELA.total_seconds() / 3600 - 1))
        agendados.append((agora - atras, poema))
    agendados.sort(key=lambda par: par[0])

    poemas = {}
    for momento, poema in agendados:
        post = _publicar(
            db,
            usuarios[poema.autor],
            momento,
            PostCreate(titulo=poema.titulo, texto=poema.texto, forma=poema.forma),
        )
        poemas[poema.chave] = post
        datas[post.id] = momento
    return poemas


def _depois(rng: random.Random, inicio: datetime, agora: datetime, de=0.1, ate=0.95) -> datetime:
    """Um momento entre `inicio` e `agora`, na fração sorteada do intervalo."""
    return inicio + (agora - inicio) * rng.uniform(de, ate)


def _citar(
    db: Session,
    rng: random.Random,
    usuarios: dict[str, User],
    poemas: dict[str, Post],
    datas: dict[int, datetime],
    agora: datetime,
) -> None:
    for citacao in CITACOES:
        original = poemas[citacao.original]
        momento = _depois(rng, datas[original.id], agora)
        post = _publicar(
            db,
            usuarios[citacao.autor],
            momento,
            PostCreate(texto=citacao.texto, forma="verso_livre", repost_de_id=original.id),
        )
        poemas[f"citacao_{citacao.autor}_{citacao.original}"] = post
        datas[post.id] = momento


def _seguir(db: Session, rng: random.Random, poetas: list[User], agora: datetime) -> None:
    """Denso entre os poetas do seed: cada um segue de 8 a 15 colegas."""
    for leitor in poetas:
        outros = [u for u in poetas if u is not leitor]
        for seguido in rng.sample(outros, rng.randint(8, 15)):
            follows_service.seguir(db, leitor, seguido.username)
    for follow in db.scalars(select(Follow).order_by(Follow.id)):
        follow.created_at = agora - JANELA * rng.uniform(0.5, 1)
    db.commit()


def _repostar(
    db: Session,
    rng: random.Random,
    poetas: list[User],
    poemas: dict[str, Post],
    datas: dict[int, datetime],
    agora: datetime,
) -> list[Post]:
    originais = [p for p in poemas.values() if p.repost_de_id is None]
    reposts = []
    while len(reposts) < REPOSTS_PUROS:
        leitor, original = rng.choice(poetas), rng.choice(originais)
        if leitor.id == original.autor_id or any(
            r.autor_id == leitor.id and r.repost_de_id == original.id for r in reposts
        ):
            continue
        reposts_service.repostar(db, leitor, original.id)
        repost = db.scalar(
            select(Post).where(
                Post.autor_id == leitor.id,
                Post.repost_de_id == original.id,
                Post.texto == "",
            )
        )
        repost.created_at = repost.updated_at = _depois(rng, datas[original.id], agora)
        datas[repost.id] = repost.created_at
        reposts.append(repost)
    db.commit()
    return reposts


def _curtir(
    db: Session,
    rng: random.Random,
    todos: list[User],
    poemas: dict[str, Post],
    reposts: list[Post],
    datas: dict[int, datetime],
    agora: datetime,
) -> None:
    """Concentradas: os EM_ALTA levam 14 a 22, uns 15 levam 5 a 10, o resto 0 a 4.

    Algumas curtidas são dadas no repost puro: o service as leva ao original.
    """
    em_alta = [poemas[chave] for chave in EM_ALTA]
    resto = [p for p in poemas.values() if p not in em_alta]
    rng.shuffle(resto)
    for posicao, post in enumerate(em_alta + resto):
        if posicao < len(em_alta):
            quantas = rng.randint(14, 22)
        elif posicao < len(em_alta) + 15:
            quantas = rng.randint(5, 10)
        else:
            quantas = rng.randint(0, 4)
        leitores = [u for u in todos if u.id != post.autor_id]
        for leitor in rng.sample(leitores, min(quantas, len(leitores))):
            curtidas_service.curtir(db, leitor, post.id)
    for repost in reposts[:5]:
        autores = (repost.autor_id, repost.repost_de.autor_id)
        leitor = rng.choice([u for u in todos if u.id not in autores])
        curtidas_service.curtir(db, leitor, repost.id)
    for curtida in db.scalars(select(Curtida).order_by(Curtida.id)):
        curtida.created_at = _depois(rng, datas[curtida.post_id], agora, 0.02, 0.98)
    db.commit()


def _comentar(
    db: Session,
    usuarios: dict[str, User],
    poemas: dict[str, Post],
    datas: dict[int, datetime],
    agora: datetime,
) -> None:
    """Cria cada conversa em profundidade (o pai antes das respostas), com datas crescentes.

    Os marcados com `apagar` são apagados pelo autor depois das respostas: viram marcador.
    """
    for chave, conversas in CONVERSAS.items():
        post = poemas[chave]
        fila = list(_em_profundidade(conversas))
        passo = (agora - datas[post.id]) / (len(fila) + 1)
        ids: list[int] = []
        a_apagar: list[tuple[User, int]] = []
        for ordem, (conversa, pai) in enumerate(fila, start=1):
            autor = usuarios[conversa.autor]
            parent_id = None if pai is None else ids[pai]
            saida = comentarios_service.comentar(
                db, autor, post.id, ComentarioCreate(texto=conversa.texto, parent_id=parent_id)
            )
            db.get(Comentario, saida.id).created_at = datas[post.id] + passo * ordem
            ids.append(saida.id)
            if conversa.apagar:
                a_apagar.append((autor, saida.id))
        db.commit()
        for autor, comentario_id in a_apagar:
            comentarios_service.apagar(db, autor, comentario_id)


def _em_profundidade(
    conversas: tuple[Conversa, ...], pai: int | None = None, inicio: int = 0
) -> Iterator[tuple[Conversa, int | None]]:
    """(conversa, posição do pai na fila) em profundidade: o pai sempre vem antes."""
    posicao = inicio
    for conversa in conversas:
        yield conversa, pai
        propria = posicao
        posicao += 1
        for item in _em_profundidade(conversa.respostas, propria, posicao):
            yield item
            posicao += 1


def _montar_antologias(
    db: Session, usuarios: dict[str, User], poemas: dict[str, Post]
) -> None:
    for antologia in ANTOLOGIAS:
        dono = usuarios[antologia.dono]
        criada = antologias_service.criar(
            db,
            dono,
            AntologiaCreate(
                nome=antologia.nome, descricao=antologia.descricao, publica=antologia.publica
            ),
        )
        for chave in antologia.poemas:
            antologias_service.adicionar_poema(db, dono, criada.id, poemas[chave].id)


def _escrever_rengas(db: Session, usuarios: dict[str, User]) -> None:
    """Pelo service, estrofe a estrofe: valem a regra da vez e o fechamento pelo limite."""
    for renga in RENGAS:
        (criador, primeira), *seguintes = renga.estrofes
        criada = rengas_service.criar(
            db,
            usuarios[criador],
            RengaCreate(
                titulo=renga.titulo,
                primeira_estrofe=primeira,
                modo=renga.modo,
                limite=renga.limite,
                convidados=list(renga.convidados),
            ),
        )
        for autor, texto in seguintes:
            rengas_service.acrescentar(db, usuarios[autor], criada.id, texto)


def contagens(db: Session) -> dict[str, int]:
    """Quantas linhas há em cada tabela da rede (o `main` imprime ao fim)."""
    modelos = {
        "usuarios": User,
        "poemas": Post,
        "follows": Follow,
        "curtidas": Curtida,
        "comentarios": Comentario,
        "antologias": Antologia,
        "rengas": Renga,
    }
    return {
        nome: db.scalar(select(func.count()).select_from(modelo)) or 0
        for nome, modelo in modelos.items()
    }


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not seed_fake(db):
            print("seed fake já aplicado — pulado")
    # A importação é idempotente: roda sempre, sem duplicar.
    importar_consagrados.main()
    with SessionLocal() as db:
        interagir_com_consagrados(db)
        print("seed ok: " + ", ".join(f"{n} {nome}" for nome, n in contagens(db).items()))


if __name__ == "__main__":
    main()
