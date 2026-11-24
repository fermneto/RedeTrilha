"""GET /usuarios (a tela Poetas) e POST /usuarios: paginação e criação."""


def test_lista_usuarios_paginada(client):
    client.post("/usuarios", json={"username": "ana", "name": "Ana"})
    client.post("/usuarios", json={"username": "bia", "name": "Bia"})

    r = client.get("/usuarios?offset=0&limit=1")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["total"] == 2
    assert len(corpo["items"]) == 1
    assert corpo["items"][0]["username"] == "ana"


def test_cria_usuario_e_aparece_na_lista(client):
    r = client.post("/usuarios", json={"username": "carla", "name": "Carla"})
    assert r.status_code == 201
    assert r.json()["username"] == "carla"

    r = client.get("/usuarios")
    assert [u["username"] for u in r.json()["items"]] == ["carla"]
