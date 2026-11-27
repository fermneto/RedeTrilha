import os
from collections.abc import Iterator
from contextlib import asynccontextmanager, contextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import DataError

from app.db import POOL, Base, SessionLocal, engine
from app.erros import dado_recusado_pelo_banco, erro_de_validacao
from app.limite_do_banco import LimiteDeConexoes
from app.models.user import User
from app.observabilidade import erro_interno, iniciar_sentry
from app.routers import (
    acervo,
    antologias,
    auth,
    avisos,
    bloqueios,
    cartoes,
    comentarios,
    comentarios_renga,
    curtidas,
    curtidas_renga,
    dicas,
    feed,
    follows,
    mensagens,
    oficina,
    poema_do_dia,
    posts,
    preferencias,
    rascunhos,
    rengas,
    repercussao,
    reposts,
    reposts_renga,
    saude,
    sugestoes,
    tags,
    traducao,
    users,
)
from app.services import indice_tags
from app.tempo_real import canal, fechar_streams_ao_desligar

# Número arbitrário e fixo do advisory lock do preparo do banco (ver _trava_do_preparo).
_CHAVE_DO_PREPARO = 7_302_019


def _banco_vazio() -> bool:
    with SessionLocal() as db:
        return db.scalar(select(User.id).limit(1)) is None


def preparar_banco() -> None:
    """Cria as tabelas e os índices que faltam, roda o seed (com SEED_ON_BOOT=true, num
    banco SEM usuários) e põe em dia um banco de antes do índice de tags no banco.

    Deploy: o seed só roda no primeiro boot, com o banco vazio; nos reinícios
    seguintes os dados criados na URL pública ficam. Com vários workers (Oracle,
    docs/deploy-oracle.md), quem chama isto é o serviço `seed` do compose, uma vez,
    antes da API: cada worker rodando o seed ao mesmo tempo duplicaria os dados.
    Import aqui dentro: fora do deploy, o script nem é carregado.

    Banco antigo: o `create_all` cria a tabela nova `post_tags` vazia, mas não
    cria índice novo em tabela que já existe. Por isso, ainda dentro da trava,
    `criar_indices_que_faltam` cria os índices dos models que faltarem (o do
    limite de tradução e os de desempenho) e o índice de tags é populado a
    partir dos posts se estiver vazio. Num banco
    novo ou já em dia, isso custa uma checagem por índice e duas consultas
    com LIMIT 1.
    """
    with _trava_do_preparo():
        Base.metadata.create_all(engine)
        criar_indices_que_faltam()
        if os.environ.get("SEED_ON_BOOT") == "true" and _banco_vazio():
            from scripts.seed import main as rodar_seed

            rodar_seed()
        with SessionLocal() as db:
            indice_tags.popular_se_vazio(db)


def criar_indices_que_faltam() -> list[str]:
    """Cria os índices dos models que faltam em tabelas que já existiam; devolve os nomes.

    O `create_all` cria a tabela nova com os índices, mas não acrescenta índice em
    tabela que já existe: o banco do deploy anterior ficaria sem os índices de
    desempenho (docs/deploy.md, "Índices"). Índice não é coluna: criar não muda dado.
    """
    existentes = inspect(engine)
    criados = []
    for tabela in Base.metadata.sorted_tables:
        nomes = {i["name"] for i in existentes.get_indexes(tabela.name)}
        for indice in tabela.indexes:
            if indice.name not in nomes:
                indice.create(engine, checkfirst=True)
                criados.append(indice.name)
    return criados


@contextmanager
def _trava_do_preparo() -> Iterator[None]:
    """No Postgres, um advisory lock: dois processos que preparam juntos fazem fila.

    Rede de segurança para quem subir vários workers com SEED_ON_BOOT=true: o
    segundo espera o primeiro terminar e já encontra o banco com usuários.
    """
    if engine.dialect.name != "postgresql":
        yield
        return
    with engine.connect() as conexao:
        conexao.execute(text("SELECT pg_advisory_lock(:chave)"), {"chave": _CHAVE_DO_PREPARO})
        try:
            yield
        finally:
            conexao.execute(text("SELECT pg_advisory_unlock(:chave)"), {"chave": _CHAVE_DO_PREPARO})


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nada a reconstruir: o índice de tags e o limite de tradução moram no banco
    # (core/README.md), então o boot é rápido e vale para vários workers.
    preparar_banco()
    # O tempo real das mensagens: no Postgres, o LISTEN deste worker (app/tempo_real.py).
    await canal.iniciar()
    # No SIGTERM, os streams abertos fecham logo e reconectam noutra réplica.
    fechar_streams_ao_desligar()
    yield
    await canal.parar()


def origens_permitidas() -> list[str]:
    """Origens do CORS, de CORS_ORIGINS separadas por vírgula (no deploy, a URL da Vercel)."""
    valor = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    # rstrip("/"): o navegador manda a Origin sem a barra que vem ao copiar a URL.
    return [origem.strip().rstrip("/") for origem in valor.split(",") if origem.strip()]


# Sentry só com SENTRY_DSN; antes do app, para a integração do FastAPI se instalar.
iniciar_sentry()
app = FastAPI(title="Rede Social da Trilha", lifespan=lifespan)
# 422 em português em toda a API (ver app/erros.py).
app.add_exception_handler(RequestValidationError, erro_de_validacao)
# 422 também para o valor que o banco recusa (rede de segurança, ver app/erros.py).
app.add_exception_handler(DataError, dado_recusado_pelo_banco)
# 500: uma linha JSON no log por erro não tratado (ver app/observabilidade.py).
app.add_exception_handler(Exception, erro_interno)

# A ordem de fora para dentro é a inversa da de registro: CORS, gzip, fila do banco.
# Fila: no máximo POOL.maximo requisições com conexão ao mesmo tempo (app/limite_do_banco.py).
app.add_middleware(LimiteDeConexoes, maximo=POOL.maximo)
# Poemas e feeds são JSON de texto: o gzip corta ~70% dos bytes. Abaixo de 1 KB não compensa.
# O stream de mensagens (text/event-stream) fica fora: o Starlette não comprime esse
# tipo, porque comprimir seguraria os eventos em buffer (tests/test_mensagens_stream.py).
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_permitidas(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1 linha por feature — registre o seu router aqui.
app.include_router(users.router)
app.include_router(follows.router)
app.include_router(posts.router)
app.include_router(tags.router)
app.include_router(auth.router)
app.include_router(curtidas.router)
app.include_router(feed.router)
app.include_router(reposts.router)
app.include_router(antologias.router)
app.include_router(comentarios.router)
app.include_router(poema_do_dia.router)
app.include_router(traducao.router)
app.include_router(saude.router)
app.include_router(acervo.router)
app.include_router(rengas.router)
app.include_router(comentarios_renga.router)
app.include_router(curtidas_renga.router)
app.include_router(reposts_renga.router)
app.include_router(oficina.router)
app.include_router(rascunhos.router)
app.include_router(sugestoes.router)
app.include_router(preferencias.router)
app.include_router(dicas.router)
app.include_router(mensagens.router)
app.include_router(bloqueios.router)
app.include_router(avisos.router)
app.include_router(cartoes.router)
app.include_router(repercussao.router)
