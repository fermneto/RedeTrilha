"""Acervo: GET /acervo (filtros, ordem, páginas) e GET /acervo/filtros.

Os poetas da rede ana, bia e caio vêm da fixture `como`; os consagrados são gravados
direto no banco, com poemas na língua do original, como faz o importador.
"""

import typing

import pytest

from app.schemas.acervo import ChaveEpoca


def _consagrado(
    username: str, name: str, nascimento: int | None, morte: int, idiomas: list[str | None]
) -> int:
    """Um consagrado com um poema por item de `idiomas`."""
    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.user import User

    with SessionLocal() as db:
        poeta = User(
            username=username, name=name, consagrado=True, nascimento=nascimento, morte=morte
        )
        db.add(poeta)
        db.flush()
        for i, idioma in enumerate(idiomas):
            db.add(Post(autor_id=poeta.id, titulo=f"poema {i}", texto="verso", idioma=idioma))
        db.commit()
        return poeta.id


@pytest.fixture()
def acervo(client, como):
    """3 poetas da rede e 5 consagrados de línguas e épocas diferentes, com follows e poemas."""
    _consagrado("homero", "Homero", -800, -700, ["el", "el"])
    _consagrado("camoes", "Luís de Camões", 1524, 1580, ["pt", "pt", "pt", "es"])
    _consagrado("alvares_de_azevedo", "Álvares de Azevedo", 1831, 1852, ["pt"])
    _consagrado("baudelaire", "Charles Baudelaire", 1821, 1867, ["fr", "fr", None])
    _consagrado("pessoa", "Fernando Pessoa", 1888, 1935, ["pt", "pt"])

    for texto in ("um", "dois", "três"):
        assert client.post("/posts", json={"texto": texto}, headers=como("bia")).status_code == 201
    primeiro = client.post("/posts", json={"texto": "da caio"}, headers=como("caio")).json()
    # repost puro não conta como poema; citação conta
    client.post(f"/posts/{primeiro['id']}/repostar", headers=como("ana"))
    client.post("/posts", json={"texto": "cito", "repost_de_id": primeiro["id"]}, headers=como("ana"))

    for quem in ("ana", "bia", "caio"):
        client.post("/usuarios/pessoa/follow", headers=como(quem))
    for quem in ("ana", "bia"):
        client.post("/usuarios/baudelaire/follow", headers=como(quem))
    client.post("/usuarios/caio/follow", headers=como("ana"))
    return como


def _usernames(client, como, consulta: str = "", quem: str = "ana") -> list[str]:
    r = client.get(f"/acervo?{consulta}", headers=como(quem))
    assert r.status_code == 200, r.text
    return [p["username"] for p in r.json()["items"]]


def test_exige_login(client):
    assert client.get("/acervo").status_code == 401
    assert client.get("/acervo/filtros").status_code == 401


def test_todos_em_ordem_alfabetica_ignorando_acento(client, acervo):
    # "Álvares" fica no A (no SQLite puro, iria para depois do Z)
    assert _usernames(client, acervo) == [
        "alvares_de_azevedo", "ana", "bia", "caio", "baudelaire", "pessoa", "homero", "camoes",
    ]


def test_item_traz_contagens_e_sigo(client, acervo):
    itens = {p["username"]: p for p in client.get("/acervo", headers=acervo("ana")).json()["items"]}
    assert (itens["pessoa"]["seguidores"], itens["pessoa"]["poemas"]) == (3, 2)
    assert itens["pessoa"]["sigo"] is True
    assert itens["camoes"]["sigo"] is False
    # o poema e a citação contam; o repost puro, não
    assert itens["ana"]["poemas"] == 1
    assert itens["bia"]["poemas"] == 3
    assert itens["caio"]["seguidores"] == 1
    assert (itens["homero"]["nascimento"], itens["homero"]["morte"]) == (-800, -700)
    assert itens["homero"]["consagrado"] is True
    assert {"id", "name", "bio", "avatar_url", "created_at"} <= itens["ana"].keys()


def test_tipo_separa_consagrados_de_contemporaneos(client, acervo):
    assert _usernames(client, acervo, "tipo=contemporaneos") == ["ana", "bia", "caio"]
    assert _usernames(client, acervo, "tipo=consagrados") == [
        "alvares_de_azevedo", "baudelaire", "pessoa", "homero", "camoes",
    ]


def test_conta_nova_entra_como_contemporanea(client, logar, acervo):
    logar("dani", "Dani")
    assert "dani" in _usernames(client, acervo, "tipo=contemporaneos")
    assert "dani" not in _usernames(client, acervo, "tipo=consagrados")


def test_busca_por_nome_ou_username_sem_acento_nem_maiuscula(client, acervo):
    assert _usernames(client, acervo, "q=camoes") == ["camoes"]
    assert _usernames(client, acervo, "q=CAMÕES") == ["camoes"]
    assert _usernames(client, acervo, "q=alvares") == ["alvares_de_azevedo"]
    assert _usernames(client, acervo, "q=%40pess") == ["pessoa"]
    assert _usernames(client, acervo, "q=de") == ["alvares_de_azevedo", "baudelaire", "camoes"]
    assert _usernames(client, acervo, "q=ninguem") == []
    assert len(_usernames(client, acervo, "q=%20%20")) == 8


def test_lingua_e_a_mais_frequente_e_so_de_consagrados(client, acervo):
    # Camões tem 3 em pt e 1 em es: é pt
    assert _usernames(client, acervo, "lingua=pt") == ["alvares_de_azevedo", "pessoa", "camoes"]
    assert _usernames(client, acervo, "lingua=es") == []
    assert _usernames(client, acervo, "lingua=fr") == ["baudelaire"]
    # os poetas da rede escrevem em pt (o padrão), mas a língua é filtro de consagrado
    assert _usernames(client, acervo, "tipo=contemporaneos&lingua=pt") == []


def test_epoca_pelo_ano_de_morte(client, acervo):
    assert _usernames(client, acervo, "epoca=antiguidade") == ["homero"]
    assert _usernames(client, acervo, "epoca=xvi") == ["camoes"]
    assert _usernames(client, acervo, "epoca=xix") == ["alvares_de_azevedo", "baudelaire"]
    assert _usernames(client, acervo, "epoca=xx") == ["pessoa"]
    assert _usernames(client, acervo, "epoca=xvii") == []
    assert _usernames(client, acervo, "tipo=contemporaneos&epoca=xix") == []


def test_filtros_combinados(client, acervo):
    assert _usernames(client, acervo, "tipo=consagrados&lingua=pt&epoca=xix") == [
        "alvares_de_azevedo"
    ]
    assert _usernames(client, acervo, "lingua=pt&epoca=xx&q=fernando") == ["pessoa"]
    assert _usernames(client, acervo, "lingua=pt&epoca=xx&q=camoes") == []
    assert _usernames(client, acervo, "lingua=pt&ordem=poemas") == [
        "camoes", "pessoa", "alvares_de_azevedo",
    ]


def test_ordem_por_seguidos_e_por_poemas_desempata_pelo_nome(client, acervo):
    seguidos = _usernames(client, acervo, "ordem=seguidos")
    assert seguidos[:3] == ["pessoa", "baudelaire", "caio"]
    assert seguidos[3:] == ["alvares_de_azevedo", "ana", "bia", "homero", "camoes"]

    assert _usernames(client, acervo, "ordem=poemas") == [
        "camoes", "bia", "baudelaire", "pessoa", "homero", "alvares_de_azevedo", "ana", "caio",
    ]


def test_paginas_e_total(client, acervo):
    todos = _usernames(client, acervo)
    r = client.get("/acervo?limit=3&offset=3", headers=acervo("ana")).json()
    assert (r["total"], r["offset"], r["limit"]) == (8, 3, 3)
    assert [p["username"] for p in r["items"]] == todos[3:6]

    ultima = client.get("/acervo?limit=3&offset=6", headers=acervo("ana")).json()
    assert [p["username"] for p in ultima["items"]] == todos[6:]
    fora = client.get("/acervo?limit=3&offset=30", headers=acervo("ana")).json()
    assert (fora["items"], fora["total"]) == ([], 8)

    # o total é o dos filtros, não o da tabela
    assert client.get("/acervo?tipo=contemporaneos&limit=1", headers=acervo("ana")).json()["total"] == 3
    # padrão da tela: 24 por página
    assert client.get("/acervo", headers=acervo("ana")).json()["limit"] == 24


def test_parametros_invalidos_dao_422(client, acervo):
    for consulta in ("tipo=vivos", "ordem=nome", "epoca=xxi", "lingua=portugues", "limit=101"):
        assert client.get(f"/acervo?{consulta}", headers=acervo("ana")).status_code == 422
    # a mensagem chega em português (app/erros.py)
    erro = client.get("/acervo?tipo=vivos", headers=acervo("ana")).json()["detail"][0]
    assert erro["msg"] == "valor fora das opções permitidas"


def test_opcoes_de_filtro_com_contagem(client, acervo):
    r = client.get("/acervo/filtros", headers=acervo("ana"))
    assert r.status_code == 200
    corpo = r.json()
    # só consagrados; mais poetas primeiro, empate pelo código
    assert corpo["linguas"] == [
        {"codigo": "pt", "poetas": 3},
        {"codigo": "el", "poetas": 1},
        {"codigo": "fr", "poetas": 1},
    ]
    epocas = {e["chave"]: e for e in corpo["epocas"]}
    assert [e["chave"] for e in corpo["epocas"]] == list(typing.get_args(ChaveEpoca))
    assert epocas["antiguidade"] == {
        "chave": "antiguidade", "rotulo": "Antiguidade", "inicio": None, "fim": 500, "poetas": 1,
    }
    assert (epocas["xix"]["poetas"], epocas["xvii"]["poetas"]) == (2, 0)
    assert (epocas["xx"]["inicio"], epocas["xx"]["fim"]) == (1901, 1955)


def test_faixas_de_epoca_sao_contiguas():
    from app.services.acervo import FAIXAS_DE_EPOCA

    for anterior, seguinte in zip(FAIXAS_DE_EPOCA, FAIXAS_DE_EPOCA[1:]):
        assert seguinte.inicio == anterior.fim + 1
