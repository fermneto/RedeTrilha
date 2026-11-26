"""Cada poema e cada renga aparecem uma vez só por sessão de leitura do feed, nas
duas abas ("Seguindo" e "Para você"), mesmo com várias páginas e com a rede
mudando entre uma página e a próxima."""

import base64

import pytest

from app.db import SessionLocal
from app.models.post import Post


def _poema(client, como, autor: str, texto: str) -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201
    return r.json()["id"]


def _seguir(client, como, quem: str, *seguidos: str) -> None:
    for seguido in seguidos:
        assert client.post(f"/usuarios/{seguido}/follow", headers=como(quem)).status_code == 204


def _renga(client, como, criador: str, limite: int = 12) -> int:
    corpo = {"titulo": "Renga do RU", "primeira_estrofe": "fila do RU\n  às onze", "limite": limite}
    r = client.post("/rengas", json=corpo, headers=como(criador))
    assert r.status_code == 201
    return r.json()["id"]


def _estrofe(client, como, autor: str, renga_id: int) -> None:
    corpo = {"texto": "mais uma\n  estrofe"}
    r = client.post(f"/rengas/{renga_id}/estrofes", json=corpo, headers=como(autor))
    assert r.status_code == 201, r.text


def _chave(item: dict) -> tuple[str, int]:
    return ("renga", item["renga"]["id"]) if item["tipo"] == "renga" else ("poema", item["id"])


def _pagina(client, como, rota: str, cursor: str | None, limit: int = 2) -> dict:
    params = {"limit": limit, **({"cursor": cursor} if cursor else {})}
    r = client.get(rota, params=params, headers=como("ana"))
    assert r.status_code == 200, r.text
    return r.json()


def _ler_tudo(client, como, rota: str, cursor: str | None = None, limit: int = 2) -> list[dict]:
    """Lê o trecho próprio da aba (no Seguindo, o de quem segue; no "Para você", o
    inédito), até a página com `fim_em`: o feed não acaba, continua depois dele."""
    itens = []
    while True:
        corpo = _pagina(client, como, rota, cursor, limit)
        itens += corpo["items"][: corpo["fim_em"]]
        cursor = corpo["proximo_cursor"]
        assert cursor is not None
        if corpo["fim_em"] is not None:
            return itens


ROTAS = ["/feed", "/feed/para-voce"]


@pytest.fixture(autouse=True)
def dani_e_eva(como, criar_usuario):
    """Mais duas contas, além de ana, bia e caio do `como`."""
    criar_usuario("dani")
    criar_usuario("eva")


@pytest.mark.parametrize("rota", ROTAS)
def test_original_e_varios_reposts_viram_um_item_em_qualquer_pagina(client, como, rota):
    """O original e os reposts de várias pessoas, espalhados por páginas diferentes."""
    _seguir(client, como, "ana", "bia", "caio", "dani")
    original = _poema(client, como, "bia", "o original")
    client.post(f"/posts/{original}/repostar", headers=como("caio"))
    for i in range(3):
        _poema(client, como, "caio", f"caio {i}")
    client.post(f"/posts/{original}/repostar", headers=como("dani"))
    for i in range(3):
        _poema(client, como, "dani", f"dani {i}")
    client.post(f"/posts/{original}/repostar", headers=como("ana"))

    itens = _ler_tudo(client, como, rota, limit=1)

    chaves = [_chave(i) for i in itens]
    assert len(chaves) == len(set(chaves)) == 7
    assert chaves[0] == ("poema", original)
    assert [u["username"] for u in itens[0]["repostado_por"]] == ["ana", "dani", "caio"]


@pytest.mark.parametrize("rota", ROTAS)
def test_repost_desfeito_no_meio_da_leitura_nao_traz_o_poema_de_novo(client, como, rota):
    _seguir(client, como, "ana", "bia", "caio")
    original = _poema(client, como, "bia", "o original")
    for i in range(3):
        _poema(client, como, "caio", f"caio {i}")
    client.post(f"/posts/{original}/repostar", headers=como("caio"))

    primeira = _pagina(client, como, rota, None)
    assert [_chave(i) for i in primeira["items"]][0] == ("poema", original)
    # O poema cai para a data em que foi publicado, abaixo do cursor.
    client.delete(f"/posts/{original}/repostar", headers=como("caio"))
    resto = _ler_tudo(client, como, rota, primeira["proximo_cursor"])

    assert [i["texto"] for i in resto] == ["caio 1", "caio 0"]


def test_comentario_apagado_no_meio_da_leitura_nao_traz_o_poema_de_novo(client, como):
    poema = _poema(client, como, "bia", "o comentado")
    for i in range(3):
        _poema(client, como, "caio", f"caio {i}")
    r = client.post(f"/posts/{poema}/comentarios", json={"texto": "bonito"}, headers=como("dani"))
    comentario = r.json()["id"]

    primeira = _pagina(client, como, "/feed/para-voce", None)
    assert primeira["items"][0]["subiu_por"] == "comentario"
    client.delete(f"/comentarios/{comentario}", headers=como("dani"))
    resto = _ler_tudo(client, como, "/feed/para-voce", primeira["proximo_cursor"])

    assert [i["texto"] for i in resto] == ["caio 1", "caio 0"]


def test_renga_que_fecha_no_meio_da_leitura_nao_volta_pelo_repost(client, como):
    """No "Para você", a renga fechada perde as estrofes e cai para o repost."""
    renga = _renga(client, como, "bia", limite=3)
    client.post(f"/rengas/{renga}/repostar", headers=como("caio"))
    for i in range(3):
        _poema(client, como, "caio", f"caio {i}")
    _estrofe(client, como, "dani", renga)

    primeira = _pagina(client, como, "/feed/para-voce", None)
    assert _chave(primeira["items"][0]) == ("renga", renga)
    _estrofe(client, como, "eva", renga)  # a 3ª de 3: fecha
    resto = _ler_tudo(client, como, "/feed/para-voce", primeira["proximo_cursor"])

    assert [_chave(i) for i in resto] == [
        ("poema", _id("caio 1")),
        ("poema", _id("caio 0")),
    ]


@pytest.mark.parametrize("rota", ROTAS)
def test_repost_de_renga_desfeito_no_meio_da_leitura_nao_traz_a_renga_de_novo(
    client, como, rota
):
    _seguir(client, como, "ana", "bia", "caio")
    renga = _renga(client, como, "bia")
    for i in range(3):
        _poema(client, como, "caio", f"caio {i}")
    client.post(f"/rengas/{renga}/repostar", headers=como("caio"))

    primeira = _pagina(client, como, rota, None)
    assert (primeira["items"][0]["tipo"], primeira["items"][0]["atividade"]) == (
        "renga",
        "repostou",
    )
    client.delete(f"/rengas/{renga}/repostar", headers=como("caio"))
    resto = _ler_tudo(client, como, rota, primeira["proximo_cursor"])

    assert ("renga", renga) not in [_chave(i) for i in resto]
    assert [i["texto"] for i in resto] == ["caio 1", "caio 0"]


@pytest.mark.parametrize("rota", ROTAS)
def test_a_leitura_inteira_nao_repete_nada(client, como, rota):
    """Poemas, citação, reposts, renga e comentário, de 1 em 1 e de 3 em 3."""
    _seguir(client, como, "ana", "bia", "caio")
    primeiro = _poema(client, como, "bia", "primeiro")
    renga = _renga(client, como, "bia")
    client.post("/posts", json={"texto": "cito", "repost_de_id": primeiro}, headers=como("caio"))
    client.post(f"/posts/{primeiro}/repostar", headers=como("caio"))
    _estrofe(client, como, "caio", renga)
    for i in range(4):
        _poema(client, como, "bia", f"bia {i}")
    client.post(f"/rengas/{renga}/repostar", headers=como("caio"))
    client.post(f"/posts/{primeiro}/comentarios", json={"texto": "ok"}, headers=como("caio"))
    client.post(f"/posts/{primeiro}/repostar", headers=como("bia"))

    for limit in (1, 3):
        chaves = [_chave(i) for i in _ler_tudo(client, como, rota, limit=limit)]
        # A citação é um poema próprio: conta à parte do citado.
        assert len(chaves) == len(set(chaves)) == 7, (limit, chaves)


def test_cursor_de_antes_sem_os_vistos_continua_valendo(client, como):
    _seguir(client, como, "ana", "bia")
    for i in range(3):
        _poema(client, como, "bia", f"bia {i}")
    novo = _pagina(client, como, "/feed", None, limit=1)["proximo_cursor"]
    data, chave, _ = base64.urlsafe_b64decode(novo).decode().split("|")
    antigo = base64.urlsafe_b64encode(f"{data}|{chave}".encode()).decode()

    assert [i["texto"] for i in _ler_tudo(client, como, "/feed", antigo, 1)] == ["bia 1", "bia 0"]


def _id(texto: str) -> int:
    with SessionLocal() as db:
        return db.query(Post.id).filter(Post.texto == texto).scalar()
