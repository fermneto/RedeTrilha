"""Auth além do núcleo: contas sem senha (consagrados e slice de exemplo) não logam."""

SENHA = "senha-forte-123"


def test_consagrado_sem_senha_nao_loga(client):
    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        db.add(
            User(
                username="cecilia_meireles",
                name="Cecília Meireles",
                password_hash=None,
                consagrado=True,
                nascimento=1901,
                morte=1964,
            )
        )
        db.commit()

    r = client.post(
        "/auth/login", json={"username": "cecilia_meireles", "password": SENHA}
    )
    assert r.status_code == 401


def test_usuario_do_slice_de_exemplo_nao_loga(client):
    r = client.post("/usuarios", json={"username": "ana", "name": "Ana"})
    assert r.status_code == 201
    assert r.json()["consagrado"] is False

    r = client.post("/auth/login", json={"username": "ana", "password": SENHA})
    assert r.status_code == 401


def test_username_inexistente_da_o_mesmo_401(client):
    r = client.post("/auth/login", json={"username": "ninguem", "password": SENHA})
    assert r.status_code == 401
    assert r.json()["detail"] == "usuário ou senha inválidos"


def test_token_invalido_da_401(client):
    r = client.get("/auth/eu", headers={"Authorization": "Bearer nao-existe"})
    assert r.status_code == 401


def test_bypass_x_user_id_so_com_debug(client, monkeypatch):
    user_id = client.post("/usuarios", json={"username": "bia", "name": "Bia"}).json()["id"]
    headers = {"X-User-Id": str(user_id)}

    monkeypatch.delenv("DEBUG", raising=False)
    assert client.get("/auth/eu", headers=headers).status_code == 401

    monkeypatch.setenv("DEBUG", "true")
    r = client.get("/auth/eu", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "bia"
