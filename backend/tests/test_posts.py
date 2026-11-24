"""CRUD de poemas sem depender da auth: get_current_user é trocado por um
usuário escolhido pelo header X-Teste-Usuario."""

import pytest
from fastapi import Header
from sqlalchemy import select

POEMA = "Primeiro verso\n\n  segundo verso recuado  \nterceiro verso\n"


@pytest.fixture()
def como(client):
    from app.db import SessionLocal
    from app.deps import get_current_user
    from app.main import app
    from app.models.user import User

    def usuario_do_header(x_teste_usuario: str = Header()):
        with SessionLocal() as db:
            return db.scalar(select(User).where(User.username == x_teste_usuario))

    app.dependency_overrides[get_current_user] = usuario_do_header
    for nome in ("ana", "bia"):
        client.post("/usuarios", json={"username": nome, "name": nome.title()})
    yield lambda username: {"X-Teste-Usuario": username}
    app.dependency_overrides.clear()


def test_crud_e_so_o_autor_altera(client, como):
    r = client.post("/posts", json={"texto": "meu poema"}, headers=como("ana"))
    assert r.status_code == 201
    post_id = r.json()["id"]
    assert r.json()["autor"]["username"] == "ana"

    r = client.patch(f"/posts/{post_id}", json={"texto": "invadido"}, headers=como("bia"))
    assert r.status_code == 403
    assert client.delete(f"/posts/{post_id}", headers=como("bia")).status_code == 403
    assert client.get(f"/posts/{post_id}", headers=como("bia")).json()["texto"] == "meu poema"

    r = client.patch(f"/posts/{post_id}", json={"texto": "editado"}, headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["texto"] == "editado"

    assert client.delete(f"/posts/{post_id}", headers=como("ana")).status_code == 204
    assert client.get(f"/posts/{post_id}", headers=como("ana")).status_code == 404


def test_quebras_de_linha_e_espacos_preservados(client, como):
    r = client.post("/posts", json={"texto": POEMA}, headers=como("ana"))
    post_id = r.json()["id"]
    assert r.json()["texto"] == POEMA
    assert client.get(f"/posts/{post_id}", headers=como("ana")).json()["texto"] == POEMA


def test_poema_longo_nao_e_truncado(client, como):
    longo = "verso\n" * 5000
    r = client.post("/posts", json={"texto": longo}, headers=como("ana"))
    assert r.status_code == 201
    assert r.json()["texto"] == longo


@pytest.mark.parametrize(
    "corpo",
    [
        {"texto": ""},
        {"texto": " \n\t "},
        {"texto": "ok", "forma": "epopeia"},
        {"texto": "ok", "titulo": "t" * 201},
    ],
)
def test_criacao_invalida_da_422(client, como, corpo):
    assert client.post("/posts", json=corpo, headers=como("ana")).status_code == 422


def test_patch_parcial_mantem_o_resto_e_limpa_com_null(client, como):
    r = client.post(
        "/posts",
        json={"titulo": "Chuva", "texto": "cai", "forma": "haicai"},
        headers=como("ana"),
    )
    post_id = r.json()["id"]

    r = client.patch(f"/posts/{post_id}", json={"texto": "caiu"}, headers=como("ana"))
    assert (r.json()["titulo"], r.json()["forma"]) == ("Chuva", "haicai")

    r = client.patch(f"/posts/{post_id}", json={"titulo": None}, headers=como("ana"))
    assert r.json()["titulo"] is None

    r = client.patch(f"/posts/{post_id}", json={"texto": None}, headers=como("ana"))
    assert r.status_code == 422


def test_indice_de_tags_acompanha_o_poema(client, como):
    from app.core.indice_tags import indice_tags

    r = client.post(
        "/posts", json={"texto": "sobre a #Solidão", "forma": "soneto"}, headers=como("ana")
    )
    post_id = r.json()["id"]
    assert r.json()["tags"] == ["solidao", "soneto"]
    assert indice_tags.posts_da_tag("solidao") == [post_id]

    client.patch(f"/posts/{post_id}", json={"texto": "sobre o #mar"}, headers=como("ana"))
    assert indice_tags.posts_da_tag("solidao") == []
    assert indice_tags.posts_da_tag("mar") == [post_id]

    client.delete(f"/posts/{post_id}", headers=como("ana"))
    assert indice_tags.posts_da_tag("mar") == []
    assert indice_tags.posts_da_tag("soneto") == []


def test_indice_e_reconstruido_no_startup(client, como):
    from app.core.indice_tags import indice_tags
    from app.db import SessionLocal
    from app.services.posts import reconstruir_indice

    r = client.post("/posts", json={"texto": "#lua"}, headers=como("ana"))
    indice_tags.reconstruir([])
    with SessionLocal() as db:
        reconstruir_indice(db)
    assert indice_tags.posts_da_tag("lua") == [r.json()["id"]]
