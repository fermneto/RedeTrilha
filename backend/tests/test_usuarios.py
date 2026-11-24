"""GET /usuarios (a tela Poetas): a lista paginada. Conta nova nasce só no /auth/registro."""


def test_lista_usuarios_paginada(client, criar_usuario):
    criar_usuario("bia")
    criar_usuario("ana")

    r = client.get("/usuarios?offset=0&limit=1")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["total"] == 2
    assert len(corpo["items"]) == 1
    assert corpo["items"][0]["username"] == "ana"


def test_registro_aparece_na_lista(client):
    senha = "senha-forte-123"
    r = client.post("/auth/registro", json={"username": "carla", "name": "Carla", "password": senha})
    assert r.status_code == 201

    r = client.get("/usuarios")
    assert [u["username"] for u in r.json()["items"]] == ["carla"]


def test_post_usuarios_nao_existe_mais(client):
    """A conta sem senha do slice de exemplo saiu: criar conta é só pelo /auth/registro."""
    r = client.post("/usuarios", json={"username": "ana", "name": "Ana"})
    assert r.status_code in (404, 405)
    assert client.get("/usuarios").json()["total"] == 0
