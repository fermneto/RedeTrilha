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


def _repostar(autor: str, original: int, texto: str = "") -> int:
    """Repost direto no banco: a rota de repost é da H5 e ainda não existe."""
    from app.db import SessionLocal
    from app.models.post import Post
    from app.services.users import buscar_por_username

    with SessionLocal() as db:
        post = Post(
            autor_id=buscar_por_username(db, autor).id, texto=texto, repost_de_id=original
        )
        db.add(post)
        db.commit()
        return post.id


def test_repost_puro_de_seguido_traz_o_original_com_quem_repostou(client, como):
    original = _postar(client, como, "caio", "do caio")
    client.post(f"/posts/{original}/curtir", headers=como("ana"))
    _repostar("bia", original)
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    [item] = r.json()["items"]
    assert (item["id"], item["texto"]) == (original, "do caio")
    assert item["repostado_por"]["username"] == "bia"
    assert (item["curtidas"], item["curti"]) == (1, True)


def test_poema_repetido_aparece_uma_vez_na_ocorrencia_mais_recente(client, como):
    original = _postar(client, como, "bia", "da bia")
    _postar(client, como, "caio", "do caio")
    _repostar("ana", original)
    depois = _postar(client, como, "bia", "bia depois")
    _repostar("caio", original)
    client.post("/usuarios/bia/follow", headers=como("ana"))
    client.post("/usuarios/caio/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    assert r.json()["total"] == 3
    itens = r.json()["items"]
    assert [p["id"] for p in itens][:2] == [original, depois]
    assert itens[0]["repostado_por"]["username"] == "caio"
    assert itens[1]["repostado_por"] is None
    assert itens[2]["texto"] == "do caio"

    r = client.get("/feed?offset=1&limit=5", headers=como("ana"))
    assert [p["texto"] for p in r.json()["items"]] == ["bia depois", "do caio"]


def test_citacao_nao_deduplica_com_o_original(client, como):
    original = _postar(client, como, "bia", "da bia")
    citacao = _repostar("caio", original, texto="olha esse verso")
    client.post("/usuarios/bia/follow", headers=como("ana"))
    client.post("/usuarios/caio/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    assert [p["id"] for p in r.json()["items"]] == [citacao, original]
    citado = r.json()["items"][0]
    assert citado["repostado_por"] is None
    assert citado["repost_de"]["texto"] == "da bia"


def test_repost_puro_de_poema_apagado_fica_fora(client, como):
    original = _postar(client, como, "caio", "do caio")
    _repostar("bia", original)
    client.delete(f"/posts/{original}", headers=como("caio"))
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/feed", headers=como("ana"))
    assert (r.json()["total"], r.json()["items"]) == (0, [])


def test_repostado_por_fica_none_fora_do_feed(client, como):
    original = _postar(client, como, "caio", "do caio")
    _repostar("bia", original)
    assert client.get(f"/posts/{original}", headers=como("ana")).json()["repostado_por"] is None


def test_feed_sem_limite_maximo_de_pagina(client, como):
    r = client.get("/feed?limit=500", headers=como("ana"))
    assert (r.status_code, r.json()["limit"]) == (200, 500)
