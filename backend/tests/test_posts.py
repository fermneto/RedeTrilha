"""CRUD de poemas sem depender da auth: get_current_user é trocado por um
usuário escolhido pelo header X-Teste-Usuario."""

import pytest

POEMA = "Primeiro verso\n\n  segundo verso recuado  \nterceiro verso\n"


def test_crud_e_so_o_autor_apaga(client, como):
    r = client.post("/posts", json={"texto": "meu poema"}, headers=como("ana"))
    assert r.status_code == 201
    post_id = r.json()["id"]
    assert r.json()["autor"]["username"] == "ana"

    assert client.delete(f"/posts/{post_id}", headers=como("bia")).status_code == 403
    assert client.get(f"/posts/{post_id}", headers=como("bia")).json()["texto"] == "meu poema"

    # Poema publicado é imutável, nem o autor edita.
    r = client.patch(f"/posts/{post_id}", json={"texto": "editado"}, headers=como("ana"))
    assert r.status_code == 405

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


def test_indice_de_tags_acompanha_o_poema(client, como):
    from app.core.indice_tags import indice_tags

    r = client.post(
        "/posts", json={"texto": "sobre a #Solidão", "forma": "soneto"}, headers=como("ana")
    )
    post_id = r.json()["id"]
    assert r.json()["tags"] == ["solidao", "soneto"]
    assert indice_tags.posts_da_tag("solidao") == [post_id]

    client.delete(f"/posts/{post_id}", headers=como("ana"))
    assert indice_tags.posts_da_tag("solidao") == []
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
