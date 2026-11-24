"""Deploy (N5): health check, SEED_ON_BOOT, CORS por variável e o bypass fora de produção."""

import pytest
from fastapi.testclient import TestClient

SENHA_SEED = "verso123"


def _bootar_com_seed(monkeypatch) -> TestClient:
    from app.main import app

    monkeypatch.setenv("SEED_ON_BOOT", "true")
    return TestClient(app)


def test_saude_responde_ok(client):
    r = client.get("/saude")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_sem_seed_on_boot_o_banco_nasce_vazio(client):
    assert client.get("/usuarios").json()["total"] == 0


def test_seed_on_boot_popula_o_banco_e_o_indice_de_tags(monkeypatch):
    from app.db import Base, engine

    Base.metadata.drop_all(engine)
    with _bootar_com_seed(monkeypatch) as c:
        r = c.post("/auth/login", json={"username": "marina_letras", "password": SENHA_SEED})
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['token']}"}

        assert c.get("/usuarios/augusto_dos_anjos", headers=headers).status_code == 200
        # O seed roda antes do rebuild: o índice de tags já nasce com os consagrados.
        assert c.get("/tags/trending", headers=headers).json()["items"]


def test_seed_on_boot_e_idempotente(monkeypatch):
    from app.db import Base, engine

    Base.metadata.drop_all(engine)
    with _bootar_com_seed(monkeypatch) as c:
        total = c.get("/usuarios").json()["total"]
    with _bootar_com_seed(monkeypatch) as c:
        assert c.get("/usuarios").json()["total"] == total


def test_cors_origins_padrao_e_localhost(monkeypatch):
    from app.main import origens_permitidas

    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert origens_permitidas() == ["http://localhost:3000"]


def test_cors_origins_separadas_por_virgula(monkeypatch):
    from app.main import origens_permitidas

    monkeypatch.setenv(
        "CORS_ORIGINS", "https://verso.vercel.app/, http://localhost:3000 ,"
    )
    assert origens_permitidas() == ["https://verso.vercel.app", "http://localhost:3000"]


def test_cors_libera_so_a_origem_configurada(client):
    preflight = {"Access-Control-Request-Method": "POST"}

    r = client.options("/auth/login", headers={"Origin": "http://localhost:3000", **preflight})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"

    r = client.options("/auth/login", headers={"Origin": "https://intruso.com", **preflight})
    assert "access-control-allow-origin" not in r.headers


@pytest.mark.parametrize("debug", [None, "", "false", "1", "True", "yes"])
def test_x_user_id_nunca_vale_sem_debug_true(client, monkeypatch, debug):
    # Em produção (Render) não existe DEBUG: o header precisa ser ignorado sempre.
    user_id = client.post("/usuarios", json={"username": "bia", "name": "Bia"}).json()["id"]
    if debug is None:
        monkeypatch.delenv("DEBUG", raising=False)
    else:
        monkeypatch.setenv("DEBUG", debug)

    headers = {"X-User-Id": str(user_id)}
    for rota in ("/auth/eu", "/feed", "/tags/trending"):
        assert client.get(rota, headers=headers).status_code == 401, rota
    r = client.post("/posts", json={"texto": "invasão"}, headers=headers)
    assert r.status_code == 401
