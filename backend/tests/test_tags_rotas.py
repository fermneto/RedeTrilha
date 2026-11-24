"""Rotas /tags e /explorar sem depender da auth: get_current_user é trocado
por um usuário escolhido pelo header X-Teste-Usuario (como em test_posts.py)."""

import time
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


def test_post_apagado_some_da_tag(client, como, publicar):
    apagado = publicar("#lua nova")
    fica = publicar("#lua minguante")

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
            {"tag": "amor", "contagem": 2, "trecho": None},
            {"tag": "chuva", "contagem": 1, "trecho": None},
            {"tag": "haicai", "contagem": 1, "trecho": None},
            {"tag": "mar", "contagem": 1, "trecho": None},
        ]
    }


def test_trending_devolve_no_maximo_5(client, como, publicar):
    for tag in ("a", "b", "c", "d", "e", "f"):
        publicar(f"#{tag}")
    r = client.get("/tags/trending", headers=como("ana"))
    assert [item["tag"] for item in r.json()["items"]] == ["a", "b", "c", "d", "e"]


def test_trending_traz_o_primeiro_verso_do_poema_mais_novo(client, como, publicar):
    publicar("um poema antigo\n#saudade")
    publicar("\n   \n    a casa vazia,   \no quintal #saudade", autor="bia")

    item = client.get("/tags/trending", headers=como("ana")).json()["items"][0]
    assert item == {"tag": "saudade", "contagem": 2, "trecho": "    a casa vazia,   "}


def test_trending_pula_a_linha_so_de_tags(client, como, publicar):
    publicar("#saudade #mar\n\n  a varanda, a rede,\n#fim")

    itens = client.get("/tags/trending", headers=como("ana")).json()["items"]
    assert {item["trecho"] for item in itens} == {"  a varanda, a rede,"}


def test_trending_linha_de_tags_patologica_nao_trava(client, como, publicar):
    # "#a#a#a... x" fazia a regex antiga recuar em tempo exponencial.
    publicar("#a" * 40 + " x\n\n  o verso certo\n#fim")

    inicio = time.perf_counter()
    itens = client.get("/tags/trending", headers=como("ana")).json()["items"]
    assert time.perf_counter() - inicio < 5
    assert {item["trecho"] for item in itens} == {"#a" * 40 + " x"}


def test_trending_um_poema_diferente_por_tag(client, como, publicar):
    publicar("o mar antigo\n#mar #sal")
    publicar("a chuva fina\n#chuva #mar")
    publicar("o sal da lágrima\n#sal #mar #chuva")

    itens = client.get("/tags/trending", headers=como("ana")).json()["items"]
    trechos = {item["tag"]: item["trecho"] for item in itens}
    # mar (3) fica com o mais novo; chuva (2) e sal (2) com o mais novo ainda livre.
    assert [item["tag"] for item in itens] == ["mar", "chuva", "sal"]
    assert trechos == {"mar": "o sal da lágrima", "chuva": "a chuva fina", "sal": "o mar antigo"}


def test_trending_repete_o_poema_quando_a_tag_nao_tem_outro(client, como, publicar):
    publicar("um verso só\n#lua #noite")

    trechos = [item["trecho"] for item in client.get("/tags/trending", headers=como("ana")).json()["items"]]
    assert trechos == ["um verso só", "um verso só"]


def test_trending_limit_ate_10(client, como, publicar):
    for i in range(12):
        publicar(f"verso\n#t{i:02d}")
    r = client.get("/tags/trending?limit=10", headers=como("ana"))
    assert [item["tag"] for item in r.json()["items"]] == [f"t{i:02d}" for i in range(10)]
    assert len(client.get("/tags/trending", headers=como("ana")).json()["items"]) == 5
    assert client.get("/tags/trending?limit=11", headers=como("ana")).status_code == 422


def test_trending_sem_o_poema_no_banco_vem_sem_trecho(client, como):
    from app.core.indice_tags import indice_tags

    indice_tags.indexar(999, {"fantasma"}, datetime.now(UTC))

    item = client.get("/tags/trending", headers=como("ana")).json()["items"][0]
    assert item == {"tag": "fantasma", "contagem": 1, "trecho": None}


def test_busca_de_tags_por_prefixo_normalizado(client, como, publicar):
    publicar("#Saudade #sal")
    publicar("#saudade", autor="bia")
    publicar("#mar")

    r = client.get("/tags/busca?q=%23SAÚ", headers=como("ana"))
    assert r.status_code == 200
    assert r.json() == {"items": [{"tag": "saudade", "poemas": 2}]}

    r = client.get("/tags/busca?q=sa", headers=como("ana"))
    assert [item["tag"] for item in r.json()["items"]] == ["saudade", "sal"]

    assert client.get("/tags/busca?q=", headers=como("ana")).json() == {"items": []}
    assert client.get("/tags/busca", headers=como("ana")).json() == {"items": []}


def test_busca_de_tags_mostra_no_maximo_5(client, como, publicar):
    for tag in ("aa", "ab", "ac", "ad", "ae", "af"):
        publicar(f"#{tag}")
    r = client.get("/tags/busca?q=a", headers=como("ana"))
    assert [item["tag"] for item in r.json()["items"]] == ["aa", "ab", "ac", "ad", "ae"]


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
