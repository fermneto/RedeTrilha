"""Curtidas sem depender da auth: get_current_user é trocado por um usuário
escolhido pelo header X-Teste-Usuario."""

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


def _poema(client, como, autor: str = "bia") -> int:
    return client.post("/posts", json={"texto": "curte aí"}, headers=como(autor)).json()["id"]


def test_curtir_e_idempotente_e_conta(client, como):
    post_id = _poema(client, como)

    assert client.post(f"/posts/{post_id}/curtir", headers=como("ana")).status_code == 204
    assert client.post(f"/posts/{post_id}/curtir", headers=como("ana")).status_code == 204
    client.post(f"/posts/{post_id}/curtir", headers=como("caio"))

    r = client.get(f"/posts/{post_id}", headers=como("ana"))
    assert (r.json()["curtidas"], r.json()["curti"]) == (2, True)
    r = client.get(f"/posts/{post_id}", headers=como("bia"))
    assert (r.json()["curtidas"], r.json()["curti"]) == (2, False)


def test_descurtir_e_idempotente(client, como):
    post_id = _poema(client, como)
    client.post(f"/posts/{post_id}/curtir", headers=como("ana"))

    assert client.delete(f"/posts/{post_id}/curtir", headers=como("ana")).status_code == 204
    assert client.delete(f"/posts/{post_id}/curtir", headers=como("ana")).status_code == 204

    r = client.get(f"/posts/{post_id}", headers=como("ana"))
    assert (r.json()["curtidas"], r.json()["curti"]) == (0, False)


def test_curtir_poema_inexistente_da_404(client, como):
    assert client.post("/posts/999/curtir", headers=como("ana")).status_code == 404
    assert client.delete("/posts/999/curtir", headers=como("ana")).status_code == 404


def test_apagar_poema_leva_as_curtidas(client, como):
    from app.db import SessionLocal
    from app.models.curtida import Curtida

    post_id = _poema(client, como)
    client.post(f"/posts/{post_id}/curtir", headers=como("ana"))
    client.delete(f"/posts/{post_id}", headers=como("bia"))

    with SessionLocal() as db:
        assert db.scalars(select(Curtida).where(Curtida.post_id == post_id)).all() == []
