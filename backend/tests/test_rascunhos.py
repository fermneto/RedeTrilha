"""Rascunhos: privados até publicar, e só eles se editam (o poema publicado é imutável)."""

import pytest

POEMA = "Primeiro verso\n\n  segundo verso recuado  \nterceiro #segredo\n"


@pytest.fixture()
def rascunho(client, como):
    """Fábrica: cria um rascunho pela rota e devolve o id."""

    def _criar(texto: str = POEMA, autor: str = "ana", **extras) -> int:
        r = client.post("/rascunhos", json={"texto": texto, **extras}, headers=como(autor))
        assert r.status_code == 201
        return r.json()["id"]

    return _criar


def test_crud_do_rascunho_preserva_o_texto(client, como, rascunho):
    rascunho_id = rascunho(titulo="Esboço", forma="soneto")
    r = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana"))
    assert r.status_code == 200
    dados = r.json()
    assert (dados["titulo"], dados["texto"], dados["forma"]) == ("Esboço", POEMA, "soneto")

    r = client.patch(f"/rascunhos/{rascunho_id}", json={"forma": None}, headers=como("ana"))
    assert r.status_code == 200
    assert (r.json()["texto"], r.json()["forma"]) == (POEMA, None)

    r = client.get("/rascunhos", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["offset"] == 0
    assert [item["id"] for item in r.json()["items"]] == [rascunho_id]

    assert client.delete(f"/rascunhos/{rascunho_id}", headers=como("ana")).status_code == 204
    assert client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).status_code == 404


@pytest.mark.parametrize("corpo", [{"texto": " \n "}, {"texto": "ok", "forma": "epopeia"}])
def test_rascunho_invalido_da_422(client, como, corpo):
    assert client.post("/rascunhos", json=corpo, headers=como("ana")).status_code == 422


def test_rascunho_de_outra_pessoa_da_404(client, como, rascunho):
    rascunho_id = rascunho()
    bia = como("bia")
    assert client.get(f"/rascunhos/{rascunho_id}", headers=bia).status_code == 404
    r = client.patch(f"/rascunhos/{rascunho_id}", json={"texto": "x"}, headers=bia)
    assert r.status_code == 404
    assert client.delete(f"/rascunhos/{rascunho_id}", headers=bia).status_code == 404
    assert client.post(f"/rascunhos/{rascunho_id}/publicar", headers=bia).status_code == 404
    assert client.get("/rascunhos", headers=bia).json()["total"] == 0
    assert client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).json()["texto"] == POEMA


def test_rascunho_fica_fora_do_feed_perfil_tags_e_explorar(client, como, rascunho):
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models.post_tag import PostTag

    client.post("/usuarios/ana/follow", headers=como("bia"))
    rascunho(forma="haicai")

    for quem in ("ana", "bia"):
        h = como(quem)
        assert client.get("/feed", headers=h).json()["items"] == []
        assert client.get("/usuarios/ana/posts", headers=h).json()["items"] == []
        assert client.get("/tags/segredo/posts", headers=h).json()["total"] == 0
        assert client.get("/explorar", headers=h).json()["total"] == 0
        assert client.get("/tags/trending", headers=h).json()["items"] == []
    assert client.get("/usuarios/ana", headers=como("bia")).json()["poemas"] == 0
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(PostTag)) == 0


def test_publicar_cria_o_poema_e_apaga_o_rascunho(client, como, rascunho):
    rascunho_id = rascunho(titulo="Esboço")
    client.patch(f"/rascunhos/{rascunho_id}", json={"titulo": "Final"}, headers=como("ana"))
    client.patch(f"/rascunhos/{rascunho_id}", json={"forma": "haicai"}, headers=como("ana"))

    r = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana"))
    assert r.status_code == 201
    poema = r.json()
    assert (poema["titulo"], poema["texto"], poema["forma"]) == ("Final", POEMA, "haicai")
    assert poema["tags"] == ["haicai", "segredo"]

    assert client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).status_code == 404
    assert client.get("/rascunhos", headers=como("ana")).json()["total"] == 0

    r = client.get("/tags/segredo/posts", headers=como("bia"))
    assert [item["id"] for item in r.json()["items"]] == [poema["id"]]
    r = client.get("/usuarios/ana/posts", headers=como("bia"))
    assert [item["id"] for item in r.json()["items"]] == [poema["id"]]


def test_publicar_usa_a_data_da_publicacao(client, como, rascunho):
    rascunho_id = rascunho()
    criado = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).json()["created_at"]
    poema = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana")).json()
    assert poema["created_at"] > criado


def _poema(client, como, autor: str = "bia", texto: str = "o original") -> int:
    return client.post("/posts", json={"texto": texto}, headers=como(autor)).json()["id"]


def test_rascunho_de_citacao_vira_citacao_ao_publicar(client, como, rascunho):
    original = _poema(client, como)
    rascunho_id = rascunho(texto="meu comentário", repost_de_id=original)
    r = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana"))
    assert (r.json()["repost_de_id"], r.json()["repost_removido"]) == (original, False)

    # Em rascunho, a citação não conta como repost do original.
    assert client.get(f"/posts/{original}", headers=como("bia")).json()["reposts"] == 0

    citacao = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana")).json()
    assert (citacao["texto"], citacao["repost_de_id"]) == ("meu comentário", original)
    assert citacao["repost_de"]["id"] == original
    assert client.get(f"/posts/{original}", headers=como("bia")).json()["reposts"] == 1


def test_rascunho_que_cita_um_repost_puro_cita_o_original(client, como, rascunho):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.post import Post

    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    with SessionLocal() as db:
        puro = db.scalar(select(Post.id).where(Post.repost_de_id == original))

    rascunho_id = rascunho(texto="cito", repost_de_id=puro)
    r = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana"))
    assert r.json()["repost_de_id"] == original


def test_rascunho_que_cita_poema_inexistente_da_404(client, como):
    r = client.post("/rascunhos", json={"texto": "cito", "repost_de_id": 9999}, headers=como("ana"))
    assert r.status_code == 404


def test_patch_do_rascunho_nao_troca_o_poema_citado(client, como, rascunho):
    original, outro = _poema(client, como), _poema(client, como, texto="outro")
    rascunho_id = rascunho(texto="cito", repost_de_id=original)
    corpo = {"texto": "cito melhor", "repost_de_id": outro}
    r = client.patch(f"/rascunhos/{rascunho_id}", json=corpo, headers=como("ana"))
    assert (r.json()["texto"], r.json()["repost_de_id"]) == ("cito melhor", original)


def test_original_apagado_antes_de_publicar_a_citacao(client, como, rascunho):
    original = _poema(client, como)
    rascunho_id = rascunho(texto="cito", repost_de_id=original)
    assert client.delete(f"/posts/{original}", headers=como("bia")).status_code == 204

    r = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana"))
    assert (r.json()["repost_de_id"], r.json()["repost_removido"]) == (None, True)

    r = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana"))
    assert r.status_code == 201
    citacao = r.json()
    assert (citacao["repost_de"], citacao["repost_removido"]) == (None, True)
