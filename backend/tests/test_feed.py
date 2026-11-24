"""Feed sem depender da auth: get_current_user é trocado por um usuário
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


def _postar(client, como, autor: str, texto: str) -> int:
    return client.post("/posts", json={"texto": texto}, headers=como(autor)).json()["id"]


def _textos(r) -> list[str]:
    return [p["texto"] for p in r.json()["items"]]


def test_feed_dos_seguidos_e_proprios_mais_novo_primeiro(client, como):
    _postar(client, como, "bia", "bia 1")
    _postar(client, como, "caio", "caio 1")
    _postar(client, como, "ana", "ana 1")
    _postar(client, como, "bia", "bia 2")
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["total"] == 3
    assert _textos(r) == ["bia 2", "ana 1", "bia 1"]


def test_feed_paginado(client, como):
    for i in range(3):
        _postar(client, como, "bia", f"bia {i}")
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/feed?offset=1&limit=1", headers=como("ana"))
    assert (r.json()["total"], r.json()["offset"], r.json()["limit"]) == (3, 1, 1)
    assert _textos(r) == ["bia 1"]


def test_feed_vazio_sem_seguir_ninguem(client, como):
    _postar(client, como, "bia", "bia 1")
    r = client.get("/feed", headers=como("ana"))
    assert (r.json()["total"], r.json()["items"]) == (0, [])


def test_feed_traz_reposts_e_curtidas(client, como):
    from app.db import SessionLocal
    from app.models.post import Post
    from app.services.users import buscar_por_username

    original = _postar(client, como, "caio", "do caio")
    client.post(f"/posts/{original}/curtir", headers=como("ana"))
    with SessionLocal() as db:
        bia = buscar_por_username(db, "bia")
        db.add(Post(autor_id=bia.id, texto="", repost_de_id=original))
        db.commit()
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    [repost] = r.json()["items"]
    assert repost["repost_de_id"] == original
    assert repost["repost_de"]["texto"] == "do caio"
    assert (repost["repost_de"]["curtidas"], repost["repost_de"]["curti"]) == (1, True)
    assert (repost["curtidas"], repost["curti"]) == (0, False)
