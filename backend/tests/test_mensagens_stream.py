"""O stream SSE das mensagens, contra um uvicorn de verdade (o TestClient junta a
resposta inteira antes de devolver, e o stream não acaba).

- recebe o evento da mensagem nova e o heartbeat;
- não vem comprimido (o gzip seguraria os eventos);
- 100 streams abertos não seguram conexão do pool nem travam as outras rotas;
- com Postgres (TEST_POSTGRES_URL), o evento enviado a um processo chega ao
  stream aberto em outro, pelo LISTEN/NOTIFY.
"""

import asyncio
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import httpx
import pytest
import uvicorn

from app.core.assinaturas import Assinaturas, Fila
from conftest import SENHA_PADRAO

BACKEND = Path(__file__).resolve().parents[1]


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture()
def servidor():
    """Um uvicorn numa thread, com o app e o banco de teste zerado; devolve a URL."""
    from app.db import Base, engine
    from app.main import app

    Base.metadata.drop_all(engine)
    porta = porta_livre()
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=porta, log_level="warning", timeout_graceful_shutdown=1)
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.02)
    yield f"http://127.0.0.1:{porta}"
    server.should_exit = True
    thread.join(10)


def entrar(url: str, username: str) -> dict:
    with httpx.Client(base_url=url) as c:
        c.post("/auth/registro", json={"username": username, "name": username, "password": SENHA_PADRAO})
        r = c.post("/auth/login", json={"username": username, "password": SENHA_PADRAO})
        return {"Authorization": f"Bearer {r.json()['token']}"}


async def ler_eventos(linhas, ate: str, prazo: float = 5) -> list[tuple[str, str]]:
    """(tipo, dados) de cada evento até chegar um do tipo `ate`; comentários viram ("", texto).

    `linhas` é o `aiter_lines()` da resposta, criado uma vez só por stream."""
    eventos: list[tuple[str, str]] = []
    tipo = ""

    async def ler():
        nonlocal tipo
        async for linha in linhas:
            if linha.startswith(":"):
                eventos.append(("", linha))
                if ate == "":
                    return
            elif linha.startswith("event: "):
                tipo = linha.removeprefix("event: ")
            elif linha.startswith("data: "):
                eventos.append((tipo, linha.removeprefix("data: ")))
                if tipo == ate:
                    return

    await asyncio.wait_for(ler(), prazo)
    return eventos


def abrir_e_enviar(url: str, quem: dict, com: str, texto: str) -> dict:
    with httpx.Client(base_url=url, headers=quem) as c:
        conversa = c.post("/mensagens/conversas", json={"username": com}).json()
        r = c.post(f"/mensagens/conversas/{conversa['id']}/mensagens", json={"texto": texto})
        assert r.status_code == 201, r.text
        return r.json()


# ---------- core ----------


def test_assinaturas_entregam_so_aos_destinatarios():
    async def cenario():
        assinaturas = Assinaturas()
        ana, ana_outra_aba, bia = assinaturas.assinar(1), assinaturas.assinar(1), assinaturas.assinar(2)
        assert len(assinaturas) == 3
        assert assinaturas.publicar([1, 1, 3], {"tipo": "mensagem"}) == 2
        assert await ana.proximo(0.1) == await ana_outra_aba.proximo(0.1) == {"tipo": "mensagem"}
        assert await bia.proximo(0.05) is None
        assinaturas.cancelar(ana)
        assinaturas.cancelar(ana_outra_aba)
        assert assinaturas.publicar([1], {"tipo": "x"}) == 0
        assert assinaturas.publicar_para_todos({"tipo": "ressincronizar"}) == 1

    asyncio.run(cenario())


def test_fila_cheia_descarta_e_pede_ressincronizar():
    async def cenario():
        fila = Fila(1, limite=2)
        for i in range(3):
            fila.por({"tipo": "mensagem", "i": i})
        assert await fila.proximo(0.1) == {"tipo": "ressincronizar"}
        assert await fila.proximo(0.05) is None

    asyncio.run(cenario())


# ---------- stream ----------


def test_stream_recebe_mensagem_nova_e_batida(servidor, monkeypatch):
    from app import tempo_real

    monkeypatch.setattr(tempo_real, "BATIDA_SEGUNDOS", 0.2)
    ana, bia = entrar(servidor, "ana"), entrar(servidor, "bia")

    async def cenario():
        async with httpx.AsyncClient(base_url=servidor, timeout=10) as c:
            async with c.stream("GET", "/mensagens/stream", headers={**bia, "Accept-Encoding": "gzip"}) as r:
                assert r.status_code == 200
                assert r.headers["content-type"].startswith("text/event-stream")
                assert "content-encoding" not in r.headers
                linhas = r.aiter_lines()
                assert await ler_eventos(linhas, "pronto") == [("pronto", "{}")]
                enviada = await asyncio.to_thread(abrir_e_enviar, servidor, ana, "bia", "chegou?")
                eventos = await ler_eventos(linhas, "pedido")
                dados = json.loads(eventos[-1][1])
                assert dados == {"conversa_id": enviada["conversa_id"], "mensagem_id": enviada["id"]}
                assert ("", ": batida") in await ler_eventos(linhas, "", prazo=2)

    asyncio.run(cenario())


def test_cem_streams_nao_seguram_o_pool_nem_travam_as_rotas(servidor):
    from app.db import engine

    ana = entrar(servidor, "ana")

    async def cenario():
        limites = httpx.Limits(max_connections=200, max_keepalive_connections=200)
        async with httpx.AsyncClient(base_url=servidor, timeout=20, limits=limites) as c:
            async def um_stream(pronto: asyncio.Event, sair: asyncio.Event):
                async with c.stream("GET", "/mensagens/stream", headers=ana) as r:
                    await ler_eventos(r.aiter_lines(), "pronto")
                    pronto.set()
                    await sair.wait()

            sair = asyncio.Event()
            prontos = [asyncio.Event() for _ in range(100)]
            tarefas = [asyncio.create_task(um_stream(p, sair)) for p in prontos]
            await asyncio.wait_for(asyncio.gather(*(p.wait() for p in prontos)), 20)

            assert engine.pool.checkedout() == 0
            inicio = time.monotonic()
            respostas = await asyncio.gather(*(c.get("/mensagens/resumo", headers=ana) for _ in range(30)))
            assert [r.status_code for r in respostas] == [200] * 30
            assert time.monotonic() - inicio < 5
            sair.set()
            await asyncio.gather(*tarefas)

    asyncio.run(cenario())


# ---------- dois processos, Postgres ----------


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="defina TEST_POSTGRES_URL para rodar")
def test_evento_atravessa_processos_pelo_notify(client):
    """A mensagem entra pelo processo B e o stream aberto no processo A recebe o evento."""
    portas = [porta_livre(), porta_livre()]
    processos = [
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(p), "--log-level", "warning"],
            cwd=BACKEND,
            env={**os.environ, "DATABASE_URL": os.environ["TEST_POSTGRES_URL"]},
        )
        for p in portas
    ]
    url_a, url_b = (f"http://127.0.0.1:{p}" for p in portas)
    try:
        for url in (url_a, url_b):
            for _ in range(100):
                try:
                    if httpx.get(f"{url}/saude").status_code == 200:
                        break
                except httpx.HTTPError:
                    time.sleep(0.1)
        ana, bia = entrar(url_b, "ana"), entrar(url_a, "bia")

        async def cenario():
            async with httpx.AsyncClient(base_url=url_a, timeout=10) as c:
                async with c.stream("GET", "/mensagens/stream", headers=bia) as r:
                    linhas = r.aiter_lines()
                    await ler_eventos(linhas, "pronto")
                    # O LISTEN de cada processo sobe junto com ele; dá um instante.
                    await asyncio.sleep(1)
                    enviada = await asyncio.to_thread(abrir_e_enviar, url_b, ana, "bia", "do outro lado")
                    eventos = await ler_eventos(linhas, "pedido")
                    assert json.loads(eventos[-1][1])["mensagem_id"] == enviada["id"]

        asyncio.run(cenario())
    finally:
        for processo in processos:
            processo.terminate()
            processo.wait(10)


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="defina TEST_POSTGRES_URL para rodar")
def test_listen_que_cai_reconecta_e_pede_para_ressincronizar(servidor):
    """O Postgres derruba a conexão do LISTEN; o worker reconecta e avisa os streams."""
    from sqlalchemy import text

    from app.db import engine

    bia = entrar(servidor, "bia")

    async def cenario():
        async with httpx.AsyncClient(base_url=servidor, timeout=10) as c:
            async with c.stream("GET", "/mensagens/stream", headers=bia) as r:
                linhas = r.aiter_lines()
                await ler_eventos(linhas, "pronto")
                with engine.begin() as conexao:
                    derrubadas = conexao.scalar(
                        text(
                            "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity "
                            "WHERE query LIKE 'LISTEN verso_mensagens%'"
                        )
                    )
                assert derrubadas >= 1
                assert (await ler_eventos(linhas, "ressincronizar", prazo=10))[-1][0] == "ressincronizar"

    asyncio.run(cenario())
