"""Curtidas sem depender da auth: get_current_user é trocado por um usuário
escolhido pelo header X-Teste-Usuario."""

from sqlalchemy import select


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
