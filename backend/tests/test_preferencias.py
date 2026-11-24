"""Preferências do onboarding: escolas, formas e região, tudo opcional."""

import pytest


def test_sem_preferencias_vem_tudo_vazio(client, como):
    r = client.get("/preferencias", headers=como("ana"))
    assert r.status_code == 200
    assert r.json() == {"escolas": [], "formas": [], "pais": None, "uf": None}


def test_put_troca_tudo_e_e_so_da_propria_pessoa(client, como):
    corpo = {"escolas": ["romantismo", "simbolismo"], "formas": ["soneto"], "pais": "BR", "uf": "PB"}
    r = client.put("/preferencias", json=corpo, headers=como("ana"))
    assert (r.status_code, r.json()) == (200, corpo)
    assert client.get("/preferencias", headers=como("ana")).json() == corpo
    assert client.get("/preferencias", headers=como("bia")).json()["escolas"] == []

    # O que não vem volta ao vazio; repetidos saem.
    r = client.put("/preferencias", json={"formas": ["haicai", "haicai"]}, headers=como("ana"))
    assert r.json() == {"escolas": [], "formas": ["haicai"], "pais": None, "uf": None}


def test_pais_sem_estado_e_fora_do_brasil(client, como):
    r = client.put("/preferencias", json={"pais": "PT"}, headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["pais"] == "PT"


@pytest.mark.parametrize(
    "corpo",
    [
        {"escolas": ["surrealismo"]},
        {"formas": ["epopeia"]},
        {"pais": "XX"},
        {"pais": "br"},
        {"pais": "BR", "uf": "ZZ"},
        {"pais": "PT", "uf": "SP"},
        {"uf": "PB"},
        {"cidade": "João Pessoa"},
    ],
)
def test_valores_invalidos_dao_422(client, como, corpo):
    r = client.put("/preferencias", json=corpo, headers=como("ana"))
    assert r.status_code == 422


def test_opcoes_trazem_o_vocabulario(client, como):
    opcoes = client.get("/preferencias/opcoes", headers=como("ana")).json()
    assert {"codigo": "popular_cordel", "rotulo": "poesia popular e cordel"} in opcoes["escolas"]
    assert len(opcoes["escolas"]) == 15
    assert {"codigo": "modernismo_hispanico", "rotulo": "modernismo hispânico"} in opcoes["escolas"]
    assert {"codigo": "realismo", "rotulo": "realismo"} in opcoes["escolas"]
    assert "soneto" in opcoes["formas"]
    assert "BR" in opcoes["paises"] and len(opcoes["paises"]) == 249
    assert {"codigo": "PB", "rotulo": "Paraíba"} in opcoes["ufs"]
    assert len(opcoes["ufs"]) == 27


def test_preferencias_exigem_login(client):
    assert client.get("/preferencias").status_code == 401
