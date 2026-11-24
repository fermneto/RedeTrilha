"""Repost puro e citação sem depender da auth: get_current_user é trocado por um
usuário escolhido pelo header X-Teste-Usuario."""

import pytest
from fastapi import Header
from sqlalchemy import select


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
    for nome in ("ana", "bia", "caio"):
        client.post("/usuarios", json={"username": nome, "name": nome.title()})
    yield lambda username: {"X-Teste-Usuario": username}
    app.dependency_overrides.clear()


def _poema(client, como, autor: str = "bia", texto: str = "um verso") -> int:
    return client.post("/posts", json={"texto": texto}, headers=como(autor)).json()["id"]


def _reposts_puros(autor: str) -> list:
    from app.db import SessionLocal
    from app.models.post import Post
    from app.services.users import buscar_por_username

    with SessionLocal() as db:
        autor_id = buscar_por_username(db, autor).id
        return list(
            db.scalars(select(Post).where(Post.autor_id == autor_id, Post.texto == ""))
        )


def test_repostar_e_idempotente_e_conta(client, como):
    original = _poema(client, como)

    assert client.post(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204
    assert client.post(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204
    client.post(f"/posts/{original}/repostar", headers=como("caio"))

    [repost] = _reposts_puros("ana")
    assert (repost.repost_de_id, repost.texto) == (original, "")
    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["reposts"], r.json()["repostei"]) == (2, True)
    r = client.get(f"/posts/{original}", headers=como("bia"))
    assert (r.json()["reposts"], r.json()["repostei"]) == (2, False)


def test_desfazer_repost_e_idempotente(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("ana"))

    assert client.delete(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204
    assert client.delete(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204

    assert _reposts_puros("ana") == []
    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["reposts"], r.json()["repostei"]) == (0, False)


def test_repostar_poema_inexistente_da_404(client, como):
    assert client.post("/posts/999/repostar", headers=como("ana")).status_code == 404
    assert client.delete("/posts/999/repostar", headers=como("ana")).status_code == 404


def test_repostar_um_repost_aponta_para_o_original(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    [repost_do_caio] = _reposts_puros("caio")

    client.post(f"/posts/{repost_do_caio.id}/repostar", headers=como("ana"))

    [repost_da_ana] = _reposts_puros("ana")
    assert repost_da_ana.repost_de_id == original
    assert client.get(f"/posts/{original}", headers=como("ana")).json()["reposts"] == 2


def test_repostar_o_proprio_poema_e_permitido(client, como):
    original = _poema(client, como, autor="ana")
    assert client.post(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204
    assert client.get(f"/posts/{original}", headers=como("ana")).json()["repostei"] is True


def test_citacao_conta_como_repost_mas_nao_como_repostei(client, como):
    original = _poema(client, como, texto="o verso citado")

    r = client.post(
        "/posts",
        json={"texto": "olha que verso\n\n  lindo", "repost_de_id": original},
        headers=como("ana"),
    )
    assert r.status_code == 201
    citacao = r.json()
    assert citacao["texto"] == "olha que verso\n\n  lindo"
    assert citacao["repost_de_id"] == original
    assert citacao["repost_de"]["texto"] == "o verso citado"
    assert citacao["repost_removido"] is False

    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["reposts"], r.json()["repostei"]) == (1, False)


def test_citar_um_repost_puro_aponta_para_o_original(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    [repost] = _reposts_puros("caio")

    r = client.post(
        "/posts", json={"texto": "cito", "repost_de_id": repost.id}, headers=como("ana")
    )
    assert r.json()["repost_de_id"] == original


def test_citar_poema_inexistente_da_404(client, como):
    r = client.post("/posts", json={"texto": "cito", "repost_de_id": 999}, headers=como("ana"))
    assert r.status_code == 404


def test_citacao_sem_texto_da_422(client, como):
    original = _poema(client, como)
    r = client.post("/posts", json={"texto": " ", "repost_de_id": original}, headers=como("ana"))
    assert r.status_code == 422


def test_patch_em_repost_puro_da_422(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    [repost] = _reposts_puros("ana")

    r = client.patch(f"/posts/{repost.id}", json={"texto": "virei citação?"}, headers=como("ana"))
    assert r.status_code == 422


def test_apagar_o_repost_puro_pelo_delete_do_post(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    [repost] = _reposts_puros("ana")

    assert client.delete(f"/posts/{repost.id}", headers=como("ana")).status_code == 204
    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["reposts"], r.json()["repostei"]) == (0, False)


def test_apagar_o_original_leva_os_puros_e_mantem_a_citacao(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    citacao = client.post(
        "/posts", json={"texto": "cito", "repost_de_id": original}, headers=como("caio")
    ).json()["id"]

    assert client.delete(f"/posts/{original}", headers=como("bia")).status_code == 204

    assert _reposts_puros("ana") == []
    r = client.get(f"/posts/{citacao}", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["texto"] == "cito"
    assert (r.json()["repost_de"], r.json()["repost_removido"]) == (None, True)


def test_feed_mostra_citacao_de_poema_removido(client, como):
    original = _poema(client, como)
    client.post("/posts", json={"texto": "cito", "repost_de_id": original}, headers=como("caio"))
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    client.post("/usuarios/caio/follow", headers=como("ana"))
    client.delete(f"/posts/{original}", headers=como("bia"))

    [item] = client.get("/feed", headers=como("ana")).json()["items"]
    assert (item["texto"], item["repost_removido"]) == ("cito", True)
