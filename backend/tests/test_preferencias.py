"""Preferências do onboarding: escolas, formas e região, tudo opcional."""

import pytest


def test_sem_preferencias_vem_tudo_vazio(client, como):
    r = client.get("/preferencias", headers=como("ana"))
    assert r.status_code == 200
    assert r.json() == {"escolas": [], "formas": [], "pais": None, "uf": None, "mostrar_lugar": True}


def test_put_troca_tudo_e_e_so_da_propria_pessoa(client, como):
    corpo = {
        "escolas": ["romantismo", "simbolismo"], "formas": ["soneto"], "pais": "BR", "uf": "PB",
        "mostrar_lugar": True,
    }
    r = client.put("/preferencias", json=corpo, headers=como("ana"))
    assert (r.status_code, r.json()) == (200, corpo)
    assert client.get("/preferencias", headers=como("ana")).json() == corpo
    assert client.get("/preferencias", headers=como("bia")).json()["escolas"] == []

    # O que não vem volta ao vazio; repetidos saem.
    r = client.put("/preferencias", json={"formas": ["haicai", "haicai"]}, headers=como("ana"))
    assert r.json() == {"escolas": [], "formas": ["haicai"], "pais": None, "uf": None, "mostrar_lugar": True}


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


def test_gostos_sao_publicos_no_perfil(client, como):
    corpo = {
        "escolas": ["romantismo"], "formas": ["soneto", "haicai"], "pais": "BR", "uf": "PB",
        "mostrar_lugar": True,
    }
    client.put("/preferencias", json=corpo, headers=como("ana"))
    r = client.get("/usuarios/ana/gostos", headers=como("bia"))
    assert (r.status_code, r.json()) == (200, corpo)
    assert client.get("/usuarios/ana/gostos", headers=como("ana")).json() == corpo
    # Sem nada marcado, tudo vazio; username que não existe, 404.
    assert client.get("/usuarios/bia/gostos", headers=como("ana")).json() == {
        "escolas": [], "formas": [], "pais": None, "uf": None, "mostrar_lugar": True
    }
    assert client.get("/usuarios/ninguem/gostos", headers=como("ana")).status_code == 404


def test_gostos_respeitam_o_bloqueio(client, como):
    client.put("/preferencias", json={"formas": ["soneto"]}, headers=como("bia"))
    client.put("/preferencias", json={"formas": ["trova"]}, headers=como("caio"))
    assert client.post("/usuarios/caio/bloqueio", headers=como("bia")).status_code == 204
    # O bloqueado não vê o perfil de quem o bloqueou; quem bloqueou vê vazio.
    assert client.get("/usuarios/bia/gostos", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/caio/gostos", headers=como("bia")).json()["formas"] == []
    assert client.get("/usuarios/bia/gostos", headers=como("ana")).json()["formas"] == ["soneto"]


def test_lugar_fora_do_perfil_so_para_os_outros(client, como):
    corpo = {"escolas": ["barroco"], "pais": "BR", "uf": "PB", "mostrar_lugar": False}
    r = client.put("/preferencias", json=corpo, headers=como("ana"))
    assert r.json()["mostrar_lugar"] is False
    assert client.get("/preferencias", headers=como("ana")).json()["mostrar_lugar"] is False

    # Os outros veem os gostos sem país e UF; a própria pessoa vê tudo.
    dos_outros = client.get("/usuarios/ana/gostos", headers=como("bia")).json()
    assert (dos_outros["escolas"], dos_outros["pais"], dos_outros["uf"]) == (["barroco"], None, None)
    meus = client.get("/usuarios/ana/gostos", headers=como("ana")).json()
    assert (meus["pais"], meus["uf"]) == ("BR", "PB")

    # Ligar de novo volta a mostrar; o PUT sem o campo volta ao padrão (ligado).
    client.put("/preferencias", json={**corpo, "mostrar_lugar": True}, headers=como("ana"))
    assert client.get("/usuarios/ana/gostos", headers=como("bia")).json()["uf"] == "PB"
    client.put("/preferencias", json={**corpo, "mostrar_lugar": False}, headers=como("ana"))
    client.put("/preferencias", json={"pais": "PT"}, headers=como("ana"))
    assert client.get("/usuarios/ana/gostos", headers=como("bia")).json()["pais"] == "PT"
