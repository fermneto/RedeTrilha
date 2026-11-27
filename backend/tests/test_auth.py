"""Auth além do núcleo: contas sem senha, bypass de DEBUG, logout, limite do bcrypt e seed."""

import pytest

SENHA = "senha-forte-123"


def test_consagrado_sem_senha_nao_loga(client):
    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        db.add(
            User(
                username="augusto_dos_anjos",
                name="Augusto dos Anjos",
                password_hash=None,
                consagrado=True,
                nascimento=1884,
                morte=1914,
            )
        )
        db.commit()

    r = client.post(
        "/auth/login", json={"username": "augusto_dos_anjos", "password": SENHA}
    )
    assert r.status_code == 401


def test_conta_sem_senha_nao_loga(client, criar_usuario):
    criar_usuario("ana")

    r = client.post("/auth/login", json={"username": "ana", "password": SENHA})
    assert r.status_code == 401


def test_username_inexistente_da_o_mesmo_401(client):
    r = client.post("/auth/login", json={"username": "ninguem", "password": SENHA})
    assert r.status_code == 401
    assert r.json()["detail"] == "usuário ou senha inválidos"


def test_token_invalido_da_401(client):
    r = client.get("/auth/eu", headers={"Authorization": "Bearer nao-existe"})
    assert r.status_code == 401


def test_bypass_x_user_id_so_com_debug(client, criar_usuario, monkeypatch):
    user_id = criar_usuario("bia")
    headers = {"X-User-Id": str(user_id)}

    monkeypatch.delenv("DEBUG", raising=False)
    assert client.get("/auth/eu", headers=headers).status_code == 401

    monkeypatch.setenv("DEBUG", "true")
    r = client.get("/auth/eu", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "bia"


def test_x_user_id_com_digito_unicode_da_401_e_nao_500(client, monkeypatch):
    # "²" passa no str.isdigit(), mas o int() explode. O uvicorn entrega o byte
    # 0xB2 como "²" (latin-1); o TestClient recodifica o header, então a
    # dependência é chamada direto.
    from fastapi import HTTPException

    from app.db import SessionLocal
    from app.deps import get_current_user

    monkeypatch.setenv("DEBUG", "true")
    with SessionLocal() as db, pytest.raises(HTTPException) as erro:
        get_current_user(authorization=None, x_user_id="²", db=db)
    assert erro.value.status_code == 401


def test_x_user_id_invalido_sem_debug_da_401_e_nao_422(client, monkeypatch):
    monkeypatch.delenv("DEBUG", raising=False)
    assert client.get("/auth/eu", headers={"X-User-Id": "abc"}).status_code == 401


def test_token_invalido_da_401_mesmo_com_debug_e_x_user_id(client, criar_usuario, monkeypatch):
    user_id = criar_usuario("bia")
    monkeypatch.setenv("DEBUG", "true")

    for authorization in ("Bearer nao-existe", "Basic abc", "Bearer "):
        r = client.get(
            "/auth/eu",
            headers={"Authorization": authorization, "X-User-Id": str(user_id)},
        )
        assert r.status_code == 401, authorization


def test_logout_apaga_a_sessao(client, logar):
    headers = logar("ana")
    assert client.get("/auth/eu", headers=headers).status_code == 200

    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/auth/eu", headers=headers).status_code == 401


def test_logout_so_apaga_a_sessao_atual(client, logar):
    celular = logar("ana")
    r = client.post("/auth/login", json={"username": "ana", "password": SENHA})
    notebook = {"Authorization": f"Bearer {r.json()['token']}"}

    client.post("/auth/logout", headers=celular)
    assert client.get("/auth/eu", headers=notebook).status_code == 200


def test_logout_exige_login(client):
    assert client.post("/auth/logout").status_code == 401


def test_cadastro_na_corrida_da_409_e_nao_500(client, monkeypatch):
    """Dois cadastros do mesmo username passam juntos pela checagem: o índice
    único barra o segundo, que recebe o 409 de sempre."""
    from app.db import SessionLocal
    from app.models.user import User
    from app.services import auth

    original = auth.garantir_username_livre

    def checar_e_concorrer(db, username):
        original(db, username)
        with SessionLocal() as outra:
            outra.add(User(username=username, name="Outra"))
            outra.commit()

    monkeypatch.setattr(auth, "garantir_username_livre", checar_e_concorrer)
    r = client.post("/auth/registro", json={"username": "ana", "name": "Ana", "password": SENHA})

    assert r.status_code == 409
    assert r.json()["detail"] == "username já existe"


def test_senha_acima_de_72_caracteres_da_422(client):
    r = client.post(
        "/auth/registro", json={"username": "ana", "name": "Ana", "password": "a" * 73}
    )
    assert r.status_code == 422
    assert "no máximo 72" in r.json()["detail"][0]["msg"]


def test_senha_com_menos_de_72_caracteres_mas_mais_de_72_bytes_da_422(client):
    senha = "ç" * 40  # 40 caracteres, 80 bytes em UTF-8
    r = client.post(
        "/auth/registro", json={"username": "ana", "name": "Ana", "password": senha}
    )
    assert r.status_code == 422
    assert "72 bytes" in r.json()["detail"][0]["msg"]


def test_senha_com_72_bytes_passa(client):
    r = client.post(
        "/auth/registro", json={"username": "ana", "name": "Ana", "password": "a" * 72}
    )
    assert r.status_code == 201


def test_usuarios_do_seed_logam_com_a_senha_padrao(client):
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import seed

    seed.main()
    r = client.post(
        "/auth/login", json={"username": seed.CONTA_DEMO, "password": seed.SENHA_SEED}
    )
    assert r.status_code == 200
    assert seed.SENHA_SEED == "verso123"


@pytest.mark.parametrize("username", ["stats", "perfil", "feed", "explorar", "api", "usuarios"])
def test_registro_recusa_username_reservado(client, username):
    r = client.post(
        "/auth/registro", json={"username": username, "name": "Alguém", "password": SENHA}
    )
    assert r.status_code == 422
    assert "reservado" in r.json()["detail"][0]["msg"]


def test_username_que_so_contem_um_reservado_passa(client):
    r = client.post(
        "/auth/registro", json={"username": "feed_da_ana", "name": "Ana", "password": SENHA}
    )
    assert r.status_code == 201


MSG_USERNAME = "o username precisa ter de 3 a 30 caracteres: letras minúsculas, números ou _"
MSG_NOME = "o nome é obrigatório e tem até 80 caracteres"


@pytest.mark.parametrize(
    ("campos", "mensagem"),
    [
        ({"username": "an"}, MSG_USERNAME),
        ({"username": "a" * 31}, MSG_USERNAME),
        ({"username": "Ana"}, MSG_USERNAME),
        ({"username": "ana-lima"}, MSG_USERNAME),
        ({"username": "a b"}, MSG_USERNAME),
        ({"name": ""}, MSG_NOME),
        ({"name": "   "}, MSG_NOME),
        ({"name": "x" * 81}, MSG_NOME),
        ({"password": "curta"}, "a senha precisa ter pelo menos 8 caracteres"),
    ],
)
def test_registro_explica_o_erro_em_portugues(client, campos, mensagem):
    corpo = {"username": "ana", "name": "Ana", "password": SENHA, **campos}
    r = client.post("/auth/registro", json=corpo)
    assert r.status_code == 422
    assert r.json()["detail"][0]["msg"] == mensagem


def test_lista_de_reservados_tem_os_nomes_decididos():
    from app.schemas.user import USERNAMES_RESERVADOS

    assert USERNAMES_RESERVADOS == {
        "eu", "stats", "admin", "verso", "perfil", "u", "login", "cadastro", "explorar",
        "escrever", "antologias", "usuarios", "poema", "poemas", "tags", "feed", "auth", "api",
    }
