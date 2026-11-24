"""Rascunhos (privados até publicar) e versões de poemas publicados (só o autor vê)."""

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
    from app.core.indice_tags import indice_tags

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
    assert indice_tags.posts_da_tag("segredo") == []


def test_publicar_cria_poema_sem_editado_e_apaga_o_rascunho(client, como, rascunho):
    rascunho_id = rascunho(titulo="Esboço")
    client.patch(f"/rascunhos/{rascunho_id}", json={"titulo": "Final"}, headers=como("ana"))
    client.patch(f"/rascunhos/{rascunho_id}", json={"forma": "haicai"}, headers=como("ana"))

    r = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana"))
    assert r.status_code == 201
    poema = r.json()
    assert (poema["titulo"], poema["texto"], poema["forma"]) == ("Final", POEMA, "haicai")
    assert poema["editado"] is False
    assert poema["tags"] == ["haicai", "segredo"]

    assert client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).status_code == 404
    assert client.get("/rascunhos", headers=como("ana")).json()["total"] == 0
    assert client.get(f"/posts/{poema['id']}/versoes", headers=como("ana")).json()["total"] == 0

    r = client.get("/tags/segredo/posts", headers=como("bia"))
    assert [item["id"] for item in r.json()["items"]] == [poema["id"]]
    r = client.get("/usuarios/ana/posts", headers=como("bia"))
    assert [item["id"] for item in r.json()["items"]] == [poema["id"]]


def test_publicar_usa_a_data_da_publicacao(client, como, rascunho):
    rascunho_id = rascunho()
    criado = client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).json()["created_at"]
    poema = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana")).json()
    assert poema["created_at"] > criado


def test_editar_poema_publicado_guarda_versao_so_para_o_autor(client, como):
    corpo = {"titulo": "Um", "texto": POEMA, "forma": "soneto"}
    r = client.post("/posts", json=corpo, headers=como("ana"))
    post_id = r.json()["id"]
    assert r.json()["editado"] is False

    client.patch(f"/posts/{post_id}", json={"texto": "segundo\n  texto"}, headers=como("ana"))
    r = client.patch(f"/posts/{post_id}", json={"titulo": "Dois"}, headers=como("ana"))
    assert r.json()["editado"] is True
    assert client.get(f"/posts/{post_id}", headers=como("bia")).json()["editado"] is True

    r = client.get(f"/posts/{post_id}/versoes", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["total"] == 2
    recente, antiga = r.json()["items"]
    assert (antiga["titulo"], antiga["texto"], antiga["forma"]) == ("Um", POEMA, "soneto")
    assert (recente["titulo"], recente["texto"]) == ("Um", "segundo\n  texto")

    assert client.get(f"/posts/{post_id}/versoes", headers=como("bia")).status_code == 404
    assert client.get("/posts/9999/versoes", headers=como("ana")).status_code == 404


def test_edicao_sem_mudanca_no_que_se_le_nao_cria_versao(client, como):
    r = client.post("/posts", json={"titulo": "Um", "texto": "verso"}, headers=como("ana"))
    post_id = r.json()["id"]
    client.patch(f"/posts/{post_id}", json={"texto": "verso", "titulo": "Um"}, headers=como("ana"))
    r = client.patch(f"/posts/{post_id}", json={"idioma": "en"}, headers=como("ana"))
    assert r.json()["editado"] is False
    assert client.get(f"/posts/{post_id}/versoes", headers=como("ana")).json()["total"] == 0


def test_editado_aparece_no_feed_e_no_original_da_citacao(client, como):
    post_id = client.post("/posts", json={"texto": "original"}, headers=como("ana")).json()["id"]
    client.patch(f"/posts/{post_id}", json={"texto": "original revisto"}, headers=como("ana"))
    client.post("/posts", json={"texto": "cito", "repost_de_id": post_id}, headers=como("bia"))
    client.post("/usuarios/ana/follow", headers=como("bia"))

    itens = client.get("/feed", headers=como("bia")).json()["items"]
    citacao, original = itens
    assert citacao["editado"] is False
    assert citacao["repost_de"]["editado"] is True
    assert original["editado"] is True


def test_apagar_poema_apaga_as_versoes(client, como):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.versao_poema import VersaoPoema

    post_id = client.post("/posts", json={"texto": "um"}, headers=como("ana")).json()["id"]
    client.patch(f"/posts/{post_id}", json={"texto": "dois"}, headers=como("ana"))
    assert client.delete(f"/posts/{post_id}", headers=como("ana")).status_code == 204
    with SessionLocal() as db:
        assert db.scalars(select(VersaoPoema).where(VersaoPoema.post_id == post_id)).all() == []
