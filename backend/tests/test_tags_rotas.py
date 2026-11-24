"""Rotas /tags e /explorar sem depender da auth: get_current_user é trocado
por um usuário escolhido pelo header X-Teste-Usuario (como em test_posts.py)."""

from datetime import UTC, datetime, timedelta

import pytest


@pytest.fixture()
def publicar(client, como):
    def _publicar(texto: str, forma: str | None = None, autor: str = "ana") -> int:
        r = client.post("/posts", json={"texto": texto, "forma": forma}, headers=como(autor))
        assert r.status_code == 201
        return r.json()["id"]

    return _publicar


def ids(resposta) -> list[int]:
    return [post["id"] for post in resposta.json()["items"]]


def test_tag_com_acento_e_maiuscula_acha_o_poema(client, como, publicar):
    p1 = publicar("na #Solidão do quarto")
    p2 = publicar("outra #solidao", autor="bia")
    publicar("sem tag nenhuma")

    r = client.get("/tags/SOLIDÃO/posts", headers=como("ana"))
    assert r.status_code == 200
    assert ids(r) == [p2, p1]
    assert r.json()["total"] == 2
    assert r.json()["items"][0]["autor"]["username"] == "bia"
    assert r.json()["items"][0]["tags"] == ["solidao"]


def test_tag_pagina_mais_novo_primeiro(client, como, publicar):
    criados = [publicar(f"verso {i} #mar") for i in range(5)]

    r = client.get("/tags/mar/posts?offset=1&limit=2", headers=como("ana"))
    assert ids(r) == [criados[3], criados[2]]
    assert (r.json()["total"], r.json()["offset"], r.json()["limit"]) == (5, 1, 2)

    r = client.get("/tags/mar/posts?offset=4&limit=2", headers=como("ana"))
    assert ids(r) == [criados[0]]

    r = client.get("/tags/inexistente/posts", headers=como("ana"))
    assert r.json() == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_edicao_que_tira_a_tag_e_post_apagado_somem(client, como, publicar):
    editado = publicar("#lua cheia")
    apagado = publicar("#lua nova")
    fica = publicar("#lua minguante")

    client.patch(f"/posts/{editado}", json={"texto": "sol"}, headers=como("ana"))
    client.delete(f"/posts/{apagado}", headers=como("ana"))

    r = client.get("/tags/lua/posts", headers=como("ana"))
    assert ids(r) == [fica]
    assert r.json()["total"] == 1


def test_trending_conta_so_as_ultimas_24h(client, como, publicar):
    from app.core.indice_tags import indice_tags

    publicar("#amor #mar")
    publicar("#amor")
    publicar("#chuva", forma="haicai")
    antigo = datetime.now(UTC) - timedelta(hours=25)
    for post_id in range(1000, 1005):
        indice_tags.indexar(post_id, {"velha"}, antigo)

    r = client.get("/tags/trending", headers=como("ana"))
    assert r.status_code == 200
    assert r.json() == {
        "items": [
            {"tag": "amor", "contagem": 2},
            {"tag": "chuva", "contagem": 1},
            {"tag": "haicai", "contagem": 1},
            {"tag": "mar", "contagem": 1},
        ]
    }


def test_trending_devolve_no_maximo_5(client, como, publicar):
    for tag in ("a", "b", "c", "d", "e", "f"):
        publicar(f"#{tag}")
    r = client.get("/tags/trending", headers=como("ana"))
    assert [item["tag"] for item in r.json()["items"]] == ["a", "b", "c", "d", "e"]


def test_explorar_filtros(client, como, publicar):
    soneto_mar = publicar("ondas #mar", forma="soneto")
    haicai_mar = publicar("espuma #mar", forma="haicai", autor="bia")
    soneto = publicar("sem mar", forma="soneto", autor="bia")
    livre = publicar("verso solto")

    r = client.get("/explorar", headers=como("ana"))
    assert ids(r) == [livre, soneto, haicai_mar, soneto_mar]
    assert r.json()["total"] == 4

    r = client.get("/explorar?limit=2&offset=1", headers=como("ana"))
    assert ids(r) == [soneto, haicai_mar]

    r = client.get("/explorar?tag=Mar", headers=como("ana"))
    assert ids(r) == [haicai_mar, soneto_mar]

    r = client.get("/explorar?forma=soneto", headers=como("ana"))
    assert ids(r) == [soneto, soneto_mar]
    assert r.json()["total"] == 2

    r = client.get("/explorar?tag=mar&forma=soneto", headers=como("ana"))
    assert ids(r) == [soneto_mar]
    assert r.json()["total"] == 1


def test_explorar_forma_invalida_da_422(client, como):
    assert client.get("/explorar?forma=epopeia", headers=como("ana")).status_code == 422


def test_tag_e_explorar_trazem_curtidas_reais(client, como, publicar):
    poema = publicar("#chuva na janela", forma="haicai")
    client.post(f"/posts/{poema}/curtir", headers=como("bia"))

    for rota in ("/tags/chuva/posts", "/explorar", "/explorar?forma=haicai"):
        item = client.get(rota, headers=como("bia")).json()["items"][0]
        assert (item["curtidas"], item["curti"]) == (1, True), rota
        item = client.get(rota, headers=como("ana")).json()["items"][0]
        assert (item["curtidas"], item["curti"]) == (1, False), rota
