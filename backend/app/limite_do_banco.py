"""Fila na porta da API: no máximo `POOL.maximo` requisições usando o banco ao mesmo tempo.

Por quê. As rotas são síncronas e rodam no threadpool do AnyIO (40 threads). A
sessão do `get_db` pega uma conexão na primeira consulta (já no
`get_current_user`) e só a devolve no fim da requisição, que também precisa de
uma thread. Com mais requisições em voo do que conexões no pool, as threads
ficam todas presas esperando conexão, e as conexões estão com requisições que
esperam thread: ninguém anda até o `pool_timeout`, e aí sai 500. Medido com 100
usuários simultâneos no Postgres: quase todas as requisições davam
`QueuePool limit ... reached` depois de 30 s.

Com a fila, cada requisição em voo tem a conexão garantida (cada uma usa uma
só) e as outras esperam no event loop, sem thread e sem conexão, na ordem em
que chegaram. O `/saude` fica fora: não usa o banco e é o health check.
"""

import asyncio
import weakref

from starlette.types import ASGIApp, Receive, Scope, Send

SEM_BANCO = frozenset({"/saude"})
STREAMS = frozenset({"/mensagens/stream"})


class LimiteDeConexoes:
    def __init__(self, app: ASGIApp, maximo: int) -> None:
        self.app = app
        self.maximo = maximo
        # Um semáforo por event loop: o TestClient abre um loop novo a cada `with`.
        self._por_loop: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore] = (
            weakref.WeakKeyDictionary()
        )

    def _semaforo(self) -> asyncio.Semaphore:
        loop = asyncio.get_running_loop()
        semaforo = self._por_loop.get(loop)
        if semaforo is None:
            semaforo = self._por_loop[loop] = asyncio.Semaphore(self.maximo)
        return semaforo

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] in SEM_BANCO:
            await self.app(scope, receive, send)
            return
        if scope["path"] in STREAMS:
            scope.setdefault("state", {})["vaga_do_banco"] = self._semaforo()
            await self.app(scope, receive, send)
            return
        async with self._semaforo():
            await self.app(scope, receive, send)
