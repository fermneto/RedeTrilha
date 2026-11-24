"""Comentários em árvore sem depender da auth: get_current_user é trocado por um
usuário escolhido pelo header X-Teste-Usuario."""

from datetime import datetime, timedelta

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
    return client.post("/posts", json={"texto": "comentem"}, headers=como(autor)).json()["id"]


def _comentar(client, como, post_id: int, texto: str, parent_id=None, autor="ana"):
    return client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": texto, "parent_id": parent_id},
        headers=como(autor),
    )


def test_arvore_de_tres_niveis_em_ordem_cronologica(client, como):
    post_id = _poema(client, como)
    r = _comentar(client, como, post_id, "raiz 1")
    assert r.status_code == 201
    raiz1 = r.json()
    assert (raiz1["parent_id"], raiz1["respostas"], raiz1["autor"]["username"]) == (
        None,
        [],
        "ana",
    )
    raiz2 = _comentar(client, como, post_id, "raiz 2", autor="caio").json()
    filho1 = _comentar(client, como, post_id, "filho 1", raiz1["id"], "bia").json()
    _comentar(client, como, post_id, "neto 1", filho1["id"], "caio")
    _comentar(client, como, post_id, "filho 2", raiz1["id"], "caio")
    _comentar(client, como, post_id, "filho de raiz 2", raiz2["id"])

    r = client.get(f"/posts/{post_id}/comentarios", headers=como("ana"))
    assert r.status_code == 200

    def resumo(comentarios):
        return [(c["texto"], resumo(c["respostas"])) for c in comentarios]

    assert resumo(r.json()["items"]) == [
        ("raiz 1", [("filho 1", [("neto 1", [])]), ("filho 2", [])]),
        ("raiz 2", [("filho de raiz 2", [])]),
    ]
    neto = r.json()["items"][0]["respostas"][0]["respostas"][0]
    assert neto["parent_id"] == filho1["id"]
    assert neto["autor"]["username"] == "caio"


def test_parent_de_outro_poema_ou_inexistente_da_404(client, como):
    post_id = _poema(client, como)
    outro = _poema(client, como, "caio")
    alheio = _comentar(client, como, outro, "lá").json()

    assert _comentar(client, como, post_id, "aqui", alheio["id"]).status_code == 404
    assert _comentar(client, como, post_id, "aqui", 999).status_code == 404
    r = client.get(f"/posts/{post_id}/comentarios", headers=como("ana"))
    assert (r.json()["items"], r.json()["total"]) == ([], 0)


def test_poema_inexistente_da_404(client, como):
    assert _comentar(client, como, 999, "oi").status_code == 404
    assert client.get("/posts/999/comentarios", headers=como("ana")).status_code == 404


@pytest.mark.parametrize("texto", ["", " \n\t "])
def test_comentario_vazio_da_422(client, como, texto):
    post_id = _poema(client, como)
    assert _comentar(client, como, post_id, texto).status_code == 422


def test_quebras_de_linha_preservadas(client, como):
    post_id = _poema(client, como)
    texto = "  primeiro verso\n\n  segundo, recuado  \n"
    assert _comentar(client, como, post_id, texto).json()["texto"] == texto
    r = client.get(f"/posts/{post_id}/comentarios", headers=como("ana"))
    assert r.json()["items"][0]["texto"] == texto


def test_contagem_no_post_out(client, como):
    post_id = _poema(client, como)
    sem_comentario = _poema(client, como, "caio")
    raiz = _comentar(client, como, post_id, "um").json()
    _comentar(client, como, post_id, "dois", raiz["id"], "bia")

    assert client.get(f"/posts/{post_id}", headers=como("ana")).json()["comentarios"] == 2
    assert client.get(f"/posts/{sem_comentario}", headers=como("ana")).json()["comentarios"] == 0


def test_apagar_poema_leva_os_comentarios(client, como):
    from app.db import SessionLocal
    from app.models.comentario import Comentario

    post_id = _poema(client, como)
    raiz = _comentar(client, como, post_id, "um").json()
    _comentar(client, como, post_id, "dois", raiz["id"], "caio")
    assert client.delete(f"/posts/{post_id}", headers=como("bia")).status_code == 204

    with SessionLocal() as db:
        assert db.scalars(select(Comentario).where(Comentario.post_id == post_id)).all() == []


def _pagina(client, como, url: str, limit: int, cursor=None) -> dict:
    params = {"limit": limit} | ({"cursor": cursor} if cursor else {})
    r = client.get(url, params=params, headers=como("ana"))
    assert r.status_code == 200
    return r.json()


def _percorrer(client, como, url: str, limit: int) -> list[str]:
    textos, cursor = [], None
    while True:
        pagina = _pagina(client, como, url, limit, cursor)
        textos += [c["texto"] for c in pagina["items"]]
        cursor = pagina["proximo_cursor"]
        if cursor is None:
            return textos


def test_raizes_paginadas_por_cursor_em_ordem_cronologica(client, como):
    post_id = _poema(client, como)
    for i in range(5):
        _comentar(client, como, post_id, f"raiz {i}")
    url = f"/posts/{post_id}/comentarios"

    primeira = _pagina(client, como, url, 2)
    assert ([c["texto"] for c in primeira["items"]], primeira["total"]) == (
        ["raiz 0", "raiz 1"],
        5,
    )
    _comentar(client, como, post_id, "raiz 5")
    assert _percorrer(client, como, url, 2) == [f"raiz {i}" for i in range(6)]

    segunda = _pagina(client, como, url, 2, primeira["proximo_cursor"])
    assert [c["texto"] for c in segunda["items"]] == ["raiz 2", "raiz 3"]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"cursor": "xx"}])
def test_limit_e_cursor_invalidos_dao_422(client, como, params):
    post_id = _poema(client, como)
    r = client.get(f"/posts/{post_id}/comentarios", params=params, headers=como("ana"))
    assert r.status_code == 422


def test_previa_corta_em_3_respostas_por_nivel(client, como):
    post_id = _poema(client, como)
    raiz = _comentar(client, como, post_id, "raiz").json()
    filhos = [
        _comentar(client, como, post_id, f"filho {i}", raiz["id"], "bia").json()
        for i in range(5)
    ]
    for i in range(4):
        _comentar(client, como, post_id, f"neto {i}", filhos[0]["id"], "caio")

    item = _pagina(client, como, f"/posts/{post_id}/comentarios", 20)["items"][0]
    assert item["total_respostas"] == 5
    assert [c["texto"] for c in item["respostas"]] == ["filho 0", "filho 1", "filho 2"]
    primeiro = item["respostas"][0]
    assert primeiro["total_respostas"] == 4
    assert [c["texto"] for c in primeiro["respostas"]] == ["neto 0", "neto 1", "neto 2"]
    assert (item["respostas"][1]["total_respostas"], item["respostas"][1]["respostas"]) == (
        0,
        [],
    )


def test_respostas_de_um_comentario_paginadas_com_previa(client, como):
    post_id = _poema(client, como)
    raiz = _comentar(client, como, post_id, "raiz").json()
    filhos = [
        _comentar(client, como, post_id, f"filho {i}", raiz["id"], "bia").json()
        for i in range(5)
    ]
    _comentar(client, como, post_id, "neto", filhos[3]["id"], "caio")
    url = f"/comentarios/{raiz['id']}/respostas"

    assert _percorrer(client, como, url, 2) == [f"filho {i}" for i in range(5)]
    pagina = _pagina(client, como, url, 2, _pagina(client, como, url, 2)["proximo_cursor"])
    assert pagina["total"] == 5
    assert [c["texto"] for c in pagina["items"][1]["respostas"]] == ["neto"]
    assert client.get("/comentarios/999/respostas", headers=como("ana")).status_code == 404


def test_apagar_sem_respostas_tira_do_banco(client, como):
    from app.db import SessionLocal
    from app.models.comentario import Comentario

    post_id = _poema(client, como)
    comentario = _comentar(client, como, post_id, "some").json()

    url = f"/comentarios/{comentario['id']}"
    assert client.delete(url, headers=como("bia")).status_code == 403
    assert client.delete("/comentarios/999", headers=como("ana")).status_code == 404
    assert client.delete(url, headers=como("ana")).status_code == 204

    with SessionLocal() as db:
        assert db.get(Comentario, comentario["id"]) is None
    assert _pagina(client, como, f"/posts/{post_id}/comentarios", 20)["items"] == []


def test_apagar_com_respostas_deixa_marcador(client, como):
    post_id = _poema(client, como)
    raiz = _comentar(client, como, post_id, "segredo").json()
    _comentar(client, como, post_id, "resposta", raiz["id"], "bia")

    assert client.delete(f"/comentarios/{raiz['id']}", headers=como("ana")).status_code == 204

    item = _pagina(client, como, f"/posts/{post_id}/comentarios", 20)["items"][0]
    assert (item["texto"], item["autor"], item["removido"]) == ("", None, True)
    assert [c["texto"] for c in item["respostas"]] == ["resposta"]
    assert item["respostas"][0]["removido"] is False
    assert _comentar(client, como, post_id, "oi", raiz["id"], "caio").status_code == 404


def test_core_monta_em_ordem_mesmo_com_entrada_fora_de_ordem():
    from app.core.arvore_comentarios import montar

    t = datetime(2026, 11, 23, 12, 0)
    itens = [
        (4, 1, t + timedelta(minutes=3), "d"),
        (2, None, t + timedelta(minutes=1), "b"),
        (3, 1, t + timedelta(minutes=2), "c"),
        (1, None, t, "a"),
        (5, 3, t + timedelta(minutes=4), "e"),
    ]
    raizes = montar(itens)

    def resumo(nos):
        return [(no.payload, resumo(no.respostas)) for no in nos]

    assert resumo(raizes) == [("a", [("c", [("e", [])]), ("d", [])]), ("b", [])]
    assert resumo(montar(itens, raiz=1)) == [("c", [("e", [])]), ("d", [])]
    assert montar([]) == []
