"""POST /oficina/analise: sem login, sem banco, um item por linha."""

from app.schemas.oficina import MAX_CARACTERES

QUADRA = "Minha terra tem palmeiras,\nOnde canta o Sabiá;\nAs aves, que aqui gorjeiam,\nNão gorjeiam como lá."


def test_analise_sem_login(client):
    r = client.post("/oficina/analise", json={"texto": QUADRA})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["esquema"] == "ABAB"
    assert corpo["aviso"] is None
    assert corpo["versos"][1] == {"silabas": 7, "rima": "B", "tipo_rima": "consoante"}
    assert [v["silabas"] for v in corpo["versos"]] == [7, 7, 7, 7]


def test_linhas_alinhadas_ao_textarea(client):
    r = client.post("/oficina/analise", json={"texto": "\n  verso com recuo\n\n"})
    versos = r.json()["versos"]
    assert len(versos) == 4
    assert versos[0]["silabas"] is None and versos[1]["silabas"] == 5


def test_aviso_de_forma(client):
    r = client.post("/oficina/analise", json={"texto": QUADRA, "forma": "soneto"})
    assert r.json()["aviso"] == "Um soneto costuma ter 14 versos; este tem 4."


def test_nao_grava_nada(auth_client, client):
    antes = auth_client.get("/feed").json()["items"]
    client.post("/oficina/analise", json={"texto": QUADRA})
    assert auth_client.get("/feed").json()["items"] == antes


def test_limite_de_tamanho(client):
    r = client.post("/oficina/analise", json={"texto": "a" * (MAX_CARACTERES + 1)})
    assert r.status_code == 422
    assert client.post("/oficina/analise", json={"texto": "a" * MAX_CARACTERES}).status_code == 200


def test_forma_desconhecida(client):
    r = client.post("/oficina/analise", json={"texto": QUADRA, "forma": "epopeia"})
    assert r.status_code == 422
