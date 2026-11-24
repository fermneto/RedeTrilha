"""Desempenho do deploy: cache HTTP, gzip, pool de conexões, fila do banco e N+1."""

import asyncio

import httpx
from sqlalchemy import event
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from app.db import ConfigDoPool, criar_engine, engine
from app.limite_do_banco import LimiteDeConexoes

# ---------- cache HTTP ----------


def test_rotas_iguais_para_todos_tem_cache_privado(client, como):
    for rota, segundos in [
        ("/tags/trending", 60),
        ("/tags/busca?q=ma", 60),
        ("/acervo/filtros", 300),
        ("/preferencias/opcoes", 3600),
    ]:
        r = client.get(rota, headers=como("ana"))
        assert r.status_code == 200, rota
        assert r.headers["cache-control"] == f"private, max-age={segundos}", rota
        assert "Authorization" in r.headers["vary"], rota


def test_lista_de_usuarios_sem_login_tem_cache_publico(client, como):
    r = client.get("/usuarios")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=60"


def test_rotas_com_dado_de_quem_pede_ficam_sem_cache(client, como):
    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.user import User

    with SessionLocal() as db:
        bilac = User(username="bilac", name="Olavo Bilac", consagrado=True)
        db.add(bilac)
        db.flush()
        db.add(Post(autor_id=bilac.id, texto="Ora (direis) ouvir estrelas!"))
        db.commit()
    post_id = client.post("/posts", json={"texto": "mar"}, headers=como("bia")).json()["id"]
    # curti, repostei, sigo, posso_escrever: o navegador não pode guardar.
    for rota in [
        "/feed",
        "/feed/para-voce",
        "/poemas/do-dia",
        f"/posts/{post_id}",
        "/usuarios/bilac",
        "/usuarios/bilac/posts",
        "/explorar",
        "/acervo",
        "/sugestoes",
        "/rengas",
    ]:
        r = client.get(rota, headers=como("ana"))
        assert r.status_code == 200, rota
        assert "cache-control" not in r.headers, rota


def test_erro_nao_leva_o_cache(client):
    r = client.get("/tags/trending")
    assert r.status_code == 401
    assert "cache-control" not in r.headers


# ---------- gzip ----------


def test_resposta_grande_vem_comprimida(client, como):
    for i in range(10):
        client.post("/posts", json={"texto": f"verso {i}\n" * 40}, headers=como("bia"))
    r = client.get("/explorar", headers={**como("ana"), "Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers["content-encoding"] == "gzip"
    assert "Accept-Encoding" in r.headers["vary"]
    # O httpx descomprime: o corpo continua o JSON de sempre.
    assert len(r.json()["items"]) == 10


def test_resposta_pequena_e_sem_gzip_no_pedido_vem_crua(client, como):
    assert "content-encoding" not in client.get("/saude").headers
    r = client.get("/explorar", headers={**como("ana"), "Accept-Encoding": "identity"})
    assert "content-encoding" not in r.headers


# ---------- pool de conexões ----------


def test_pool_vem_do_ambiente(monkeypatch):
    monkeypatch.setenv("DB_POOL_SIZE", "3")
    monkeypatch.setenv("DB_MAX_OVERFLOW", "2")
    monkeypatch.setenv("DB_POOL_TIMEOUT", "7")
    monkeypatch.setenv("DB_POOL_RECYCLE", "120")
    pool = ConfigDoPool.do_ambiente()
    valores = (pool.pool_size, pool.max_overflow, pool.pool_timeout, pool.pool_recycle)
    assert valores == (3, 2, 7, 120)
    assert pool.maximo == 5

    # create_engine não conecta: dá para conferir sem um Postgres.
    pg = criar_engine("postgres://u:s@localhost:5432/postgres", pool)
    assert pg.pool.size() == 3
    assert pg.pool._max_overflow == 2
    assert pg.pool._timeout == 7
    assert pg.pool._recycle == 120


def test_pool_padrao_cabe_no_pooler_do_supabase(monkeypatch):
    for nome in ("DB_POOL_SIZE", "DB_MAX_OVERFLOW", "DB_POOL_TIMEOUT", "DB_POOL_RECYCLE"):
        monkeypatch.delenv(nome, raising=False)
    pool = ConfigDoPool.do_ambiente()
    # docs/deploy.md: o pool do Supabase free é 15; um worker usa no máximo 10.
    assert pool.maximo == 10
    assert pool.pool_recycle < 30 * 60


# ---------- fila do banco ----------


def test_fila_deixa_no_maximo_n_requisicoes_ao_mesmo_tempo():
    em_voo = 0
    pico = 0

    async def lenta(request):
        nonlocal em_voo, pico
        em_voo += 1
        pico = max(pico, em_voo)
        await asyncio.sleep(0.02)
        em_voo -= 1
        return PlainTextResponse("ok")

    app = LimiteDeConexoes(Starlette(routes=[Route("/x", lenta), Route("/saude", lenta)]), 3)

    async def disparar(rota: str, n: int) -> list[int]:
        transporte = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transporte, base_url="http://t") as c:
            respostas = await asyncio.gather(*(c.get(rota) for _ in range(n)))
        return [r.status_code for r in respostas]

    assert asyncio.run(disparar("/x", 20)) == [200] * 20
    assert pico == 3
    # O health check não entra na fila.
    pico = 0
    assert asyncio.run(disparar("/saude", 10)) == [200] * 10
    assert pico == 10


# ---------- N+1 ----------


def _contar_queries(funcao) -> int:
    contagem = 0

    def contar(*_):
        nonlocal contagem
        contagem += 1

    event.listen(engine, "before_cursor_execute", contar)
    try:
        funcao()
    finally:
        event.remove(engine, "before_cursor_execute", contar)
    return contagem


def _citar(client, como, quantas: int) -> None:
    for i in range(quantas):
        original = client.post("/posts", json={"texto": f"original {i}"}, headers=como("bia"))
        corpo = {"texto": f"citação {i}", "repost_de_id": original.json()["id"]}
        assert client.post("/posts", json=corpo, headers=como("caio")).status_code == 201


def test_citacoes_nao_fazem_uma_query_cada(client, como):
    # A ana segue só o caio: no feed dela vêm as citações, e os originais (da bia),
    # que não estão na página, chegam numa query só.
    client.post("/usuarios/caio/follow", headers=como("ana"))
    _citar(client, como, 1)
    uma = _contar_queries(lambda: client.get("/feed", headers=como("ana")))
    _citar(client, como, 9)
    dez = _contar_queries(lambda: client.get("/feed", headers=como("ana")))
    assert dez == uma


def test_rengas_do_feed_nao_fazem_tres_queries_cada(client, como):
    client.post("/usuarios/bia/follow", headers=como("ana"))

    def renga(i: int) -> None:
        corpo = {"titulo": f"Renga {i}", "primeira_estrofe": "fila do RU"}
        assert client.post("/rengas", json=corpo, headers=como("bia")).status_code == 201

    renga(0)
    uma = _contar_queries(lambda: client.get("/feed", headers=como("ana")))
    for i in range(1, 6):
        renga(i)
    seis = _contar_queries(lambda: client.get("/feed", headers=como("ana")))
    assert seis == uma


# ---------- índices ----------


def test_indices_de_desempenho_existem(client):
    from sqlalchemy import inspect

    nomes = lambda tabela: {i["name"] for i in inspect(engine).get_indexes(tabela)}  # noqa: E731
    assert {"ix_posts_autorais", "ix_posts_originais"} <= nomes("posts")
    assert "ix_comentarios_do_poema" in nomes("comentarios")


def test_preparo_cria_o_indice_que_falta_em_tabela_que_ja_existia(client):
    # O banco do deploy anterior: tabela criada antes do índice existir.
    from sqlalchemy import inspect, text

    from app.main import criar_indices_que_faltam, preparar_banco

    with engine.begin() as conexao:
        conexao.execute(text("DROP INDEX ix_posts_autorais"))
        conexao.execute(text("DROP INDEX ix_comentarios_do_poema"))
    assert sorted(criar_indices_que_faltam()) == ["ix_comentarios_do_poema", "ix_posts_autorais"]
    nomes = {i["name"] for i in inspect(engine).get_indexes("posts")}
    assert "ix_posts_autorais" in nomes
    # Tudo criado: rodar o preparo de novo não cria nada nem quebra.
    preparar_banco()
    assert criar_indices_que_faltam() == []
