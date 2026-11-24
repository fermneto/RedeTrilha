"""Repost puro e citação sem depender da auth: get_current_user é trocado por um
usuário escolhido pelo header X-Teste-Usuario."""

import pytest
from sqlalchemy import select


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


def test_curtir_um_repost_puro_curte_o_original(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    [repost] = _reposts_puros("caio")

    assert client.post(f"/posts/{repost.id}/curtir", headers=como("ana")).status_code == 204
    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["curtidas"], r.json()["curti"]) == (1, True)
    assert client.get(f"/posts/{repost.id}", headers=como("ana")).json()["curtidas"] == 0

    assert client.delete(f"/posts/{repost.id}/curtir", headers=como("ana")).status_code == 204
    r = client.get(f"/posts/{original}", headers=como("ana"))
    assert (r.json()["curtidas"], r.json()["curti"]) == (0, False)


def test_curtir_uma_citacao_curte_a_citacao(client, como):
    original = _poema(client, como)
    citacao = client.post(
        "/posts", json={"texto": "cito", "repost_de_id": original}, headers=como("caio")
    ).json()["id"]

    client.post(f"/posts/{citacao}/curtir", headers=como("ana"))
    assert client.get(f"/posts/{citacao}", headers=como("ana")).json()["curtidas"] == 1
    assert client.get(f"/posts/{original}", headers=como("ana")).json()["curtidas"] == 0


def test_citar_uma_citacao_aponta_para_a_citacao(client, como):
    original = _poema(client, como)
    citacao = client.post(
        "/posts", json={"texto": "cito", "repost_de_id": original}, headers=como("caio")
    ).json()["id"]

    r = client.post(
        "/posts", json={"texto": "cito a citação", "repost_de_id": citacao}, headers=como("ana")
    )
    assert r.json()["repost_de_id"] == citacao


def test_desfazer_pelo_id_do_repost_de_outra_pessoa_desfaz_o_proprio(client, como):
    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    [repost_do_caio] = _reposts_puros("caio")

    r = client.delete(f"/posts/{repost_do_caio.id}/repostar", headers=como("ana"))
    assert r.status_code == 204
    assert _reposts_puros("ana") == []
    assert len(_reposts_puros("caio")) == 1


def test_indice_unico_barra_repost_puro_duplicado(client, como):
    from sqlalchemy.exc import IntegrityError

    from app.db import SessionLocal
    from app.models.post import Post
    from app.services.users import buscar_por_username

    original = _poema(client, como)
    with SessionLocal() as db:
        ana = buscar_por_username(db, "ana").id
        db.add_all(
            [
                Post(autor_id=ana, texto="cito 1", repost_de_id=original),
                Post(autor_id=ana, texto="cito 2", repost_de_id=original),
                Post(autor_id=ana, texto="", repost_de_id=original),
            ]
        )
        db.commit()
        db.add(Post(autor_id=ana, texto="", repost_de_id=original))
        with pytest.raises(IntegrityError):
            db.commit()


def test_repostar_em_corrida_vale_como_ja_repostado(client, como, monkeypatch):
    from app.services import reposts

    original = _poema(client, como)
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    # Simula a outra chamada simultânea: a checagem não vê o repost que já existe.
    monkeypatch.setattr(reposts, "_repost_puro", lambda db, usuario, original_id: None)

    assert client.post(f"/posts/{original}/repostar", headers=como("ana")).status_code == 204
    assert len(_reposts_puros("ana")) == 1


def test_explorar_nao_lista_reposts_puros(client, como):
    original = _poema(client, como, texto="um soneto")
    client.post(f"/posts/{original}/repostar", headers=como("ana"))
    citacao = client.post(
        "/posts", json={"texto": "cito", "repost_de_id": original}, headers=como("caio")
    ).json()["id"]

    r = client.get("/explorar", headers=como("ana"))
    assert r.json()["total"] == 2
    assert [p["id"] for p in r.json()["items"]] == [citacao, original]
