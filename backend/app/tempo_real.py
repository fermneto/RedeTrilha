"""Tempo real das mensagens: o stream SSE de cada pessoa e o fan-out entre workers.

O caminho de um evento ("mensagem nova na conversa 7"):

1. O service grava a mensagem e chama `avisar(db, para, evento)` antes do commit.
2. **Postgres (produção):** `avisar` faz um `pg_notify` na mesma transação. O
   Postgres só entrega o NOTIFY no commit (e o descarta no rollback) a todas as
   conexões em `LISTEN`: uma por worker, aberta por `OuvinteDoPostgres` fora do
   pool do SQLAlchemy, assíncrona e reconectando se cair. Cada worker entrega o
   evento aos streams que ele mesmo atende (`assinaturas`, core/assinaturas.py).
   Assim, a mensagem enviada a um worker chega ao stream aberto em outro, e a API
   continua sem estado: o evento só passa, nada fica guardado.
3. **SQLite (dev e testes):** não há LISTEN/NOTIFY. `CanalNaMemoria` guarda o
   aviso na sessão e, no commit, entrega direto às assinaturas deste processo.
   Só vale com um processo; com vários workers, o caminho é o Postgres.

O evento leva só o tipo e os ids (`{"tipo": "mensagem", "conversa_id": 7,
"mensagem_id": 31}`), nunca o texto. O cliente busca o conteúdo pelas rotas
normais, que conferem quem pode ler; as mesmas rotas, com `?depois=`, recuperam
o que se perdeu enquanto o stream esteve fora.
"""

import asyncio
import json
import logging
import signal
import threading
from collections.abc import AsyncIterator, Iterable

import psycopg
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.core.assinaturas import ENCERRAR, RESSINCRONIZAR, Assinaturas
from app.db import SessionLocal, engine

logger = logging.getLogger(__name__)

CANAL = "verso_mensagens"
# Comentário SSE a cada tanto, para proxies e o navegador não fecharem a conexão parada.
BATIDA_SEGUNDOS = 20.0
# Espera entre tentativas de reconectar o LISTEN, dobrando até o teto.
ESPERA_MINIMA = 1.0
ESPERA_MAXIMA = 30.0

CABECALHOS_DO_STREAM = {
    "Cache-Control": "no-cache",
    # Nginx e afins: não segurar a resposta em buffer.
    "X-Accel-Buffering": "no",
}

# Os streams abertos neste processo.
assinaturas = Assinaturas()


def avisar(db: Session, para: Iterable[int], evento: dict) -> None:
    """Avisa `para` (ids de usuário) quando a transação de `db` fizer commit."""
    canal.avisar(db, list(para), evento)


def formatar(evento: dict) -> str:
    """Um evento no formato SSE: `event: <tipo>` e o resto em JSON no `data:`."""
    dados = {chave: valor for chave, valor in evento.items() if chave != "tipo"}
    return f"event: {evento['tipo']}\ndata: {json.dumps(dados)}\n\n"


async def eventos(user_id: int) -> AsyncIterator[str]:
    """O corpo do stream: `pronto`, depois cada evento da pessoa e uma batida no silêncio.

    Quando o cliente desconecta, o Starlette cancela o gerador e o `finally`
    cancela a assinatura. Quando o processo vai desligar, o gerador termina
    sozinho (`fechar_streams_ao_desligar`).
    """
    fila = assinaturas.assinar(user_id)
    try:
        yield formatar({"tipo": "pronto"})
        while True:
            evento = await fila.proximo(BATIDA_SEGUNDOS)
            if evento is ENCERRAR:
                return
            yield ": batida\n\n" if evento is None else formatar(evento)
    finally:
        assinaturas.cancelar(fila)


SINAIS_DE_DESLIGAR = (signal.SIGTERM, signal.SIGINT)


def fechar_streams_ao_desligar() -> None:
    """No SIGTERM (docker stop, atualizar.sh), fecha os streams deste processo na hora.

    Sem isto, o uvicorn espera as conexões abertas até o TIMEOUT_GRACEFUL_SHUTDOWN
    (20 s), e um stream só fecha quando esse prazo acaba. Fechando no início, o
    desligamento leva o tempo das requisições curtas em voo, e o cliente reconecta
    noutra réplica, que o Caddy já escolhe (o uvicorn fecha a porta no mesmo sinal).

    Roda no startup, depois de o uvicorn instalar o handler dele, e o encadeia: o
    sinal segue para o uvicorn como antes. O handler só agenda o fechamento no
    event loop (`call_soon_threadsafe`), que é o seguro dentro de um handler de
    sinal. Fora da thread principal (o TestClient) não há sinais: não faz nada.
    """
    if threading.current_thread() is not threading.main_thread():
        return
    loop = asyncio.get_running_loop()
    for sinal in SINAIS_DE_DESLIGAR:
        anterior = signal.getsignal(sinal)

        def ao_sinal(numero, quadro, anterior=anterior):
            loop.call_soon_threadsafe(assinaturas.encerrar_todos)
            if callable(anterior):
                anterior(numero, quadro)
            else:
                # SIG_DFL ou SIG_IGN: devolve o comportamento original ao sinal.
                signal.signal(numero, anterior)
                signal.raise_signal(numero)

        signal.signal(sinal, ao_sinal)


def _entregar(texto: str) -> None:
    """Entrega aos streams deste processo um aviso que veio do NOTIFY."""
    try:
        evento = json.loads(texto)
        para = evento.pop("para")
    except (ValueError, KeyError, AttributeError):
        logger.warning("aviso de mensagem malformado: %r", texto)
        return
    assinaturas.publicar(para, evento)


class CanalNaMemoria:
    """SQLite: os avisos ficam na sessão e vão para as assinaturas no commit."""

    _CHAVE = "avisos_de_mensagem"

    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        event.listen(SessionLocal, "after_commit", self._depois_do_commit)
        event.listen(SessionLocal, "after_rollback", self._depois_do_rollback)

    def avisar(self, db: Session, para: list[int], evento: dict) -> None:
        db.info.setdefault(self._CHAVE, []).append(json.dumps({"para": para, **evento}))

    def _depois_do_commit(self, db: Session) -> None:
        avisos = db.info.pop(self._CHAVE, [])
        # O service roda numa thread do threadpool; as filas são do event loop.
        if self._loop is not None:
            for aviso in avisos:
                self._loop.call_soon_threadsafe(_entregar, aviso)

    def _depois_do_rollback(self, db: Session) -> None:
        db.info.pop(self._CHAVE, None)

    async def iniciar(self) -> None:
        self._loop = asyncio.get_running_loop()

    async def parar(self) -> None:
        self._loop = None


class OuvinteDoPostgres:
    """Postgres: NOTIFY na transação de quem envia e um LISTEN por worker."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._tarefa: asyncio.Task | None = None

    def avisar(self, db: Session, para: list[int], evento: dict) -> None:
        db.execute(select(func.pg_notify(CANAL, json.dumps({"para": para, **evento}))))

    async def iniciar(self) -> None:
        self._tarefa = asyncio.create_task(self._ouvir())

    async def parar(self) -> None:
        if self._tarefa is not None:
            self._tarefa.cancel()
            await asyncio.gather(self._tarefa, return_exceptions=True)
            self._tarefa = None

    async def _ouvir(self) -> None:
        espera = ESPERA_MINIMA
        reconectando = False
        while True:
            try:
                # Keepalive do TCP: um banco que sumiu sem fechar a conexão é
                # notado em cerca de um minuto, e o laço reconecta.
                async with await psycopg.AsyncConnection.connect(
                    self._url,
                    autocommit=True,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=3,
                ) as conexao:
                    await conexao.execute(f"LISTEN {CANAL}")
                    espera = ESPERA_MINIMA
                    if reconectando:
                        # Enquanto o LISTEN esteve fora, eventos se perderam.
                        assinaturas.publicar_para_todos(RESSINCRONIZAR)
                    async for aviso in conexao.notifies():
                        _entregar(aviso.payload)
            except (psycopg.Error, OSError) as erro:
                logger.warning("LISTEN das mensagens caiu (%s); nova tentativa em %.0f s", erro, espera)
            reconectando = True
            await asyncio.sleep(espera)
            espera = min(espera * 2, ESPERA_MAXIMA)


def _criar_canal() -> CanalNaMemoria | OuvinteDoPostgres:
    if engine.dialect.name == "postgresql":
        return OuvinteDoPostgres(engine.url.set(drivername="postgresql").render_as_string(hide_password=False))
    return CanalNaMemoria()


canal = _criar_canal()
