"""Follow sem depender da auth: a dependência get_current_user é trocada por
um usuário escolhido pelo header X-Teste-Usuario."""

def _contagens(db_username: str) -> tuple[int, int]:
    from app.db import SessionLocal
    from app.services.follows import contar_seguidores, contar_seguindo
    from app.services.users import buscar_por_username

    with SessionLocal() as db:
        user = buscar_por_username(db, db_username)
        return contar_seguidores(db, user.id), contar_seguindo(db, user.id)


def test_seguir_e_idempotente_e_conta(client, como):
    assert client.post("/usuarios/bia/follow", headers=como("ana")).status_code == 204
    assert client.post("/usuarios/bia/follow", headers=como("ana")).status_code == 204

    assert _contagens("bia") == (1, 0)
    assert _contagens("ana") == (0, 1)


def test_deixar_de_seguir_e_idempotente(client, como):
    client.post("/usuarios/bia/follow", headers=como("ana"))
    assert client.delete("/usuarios/bia/follow", headers=como("ana")).status_code == 204
    assert client.delete("/usuarios/bia/follow", headers=como("ana")).status_code == 204
    assert _contagens("bia") == (0, 0)


def test_listas_paginadas_mais_recente_primeiro(client, como):
    client.post("/usuarios/caio/follow", headers=como("ana"))
    client.post("/usuarios/caio/follow", headers=como("bia"))
    client.post("/usuarios/bia/follow", headers=como("ana"))

    r = client.get("/usuarios/caio/seguidores", headers=como("ana"))
    assert r.json()["total"] == 2
    assert [u["username"] for u in r.json()["items"]] == ["bia", "ana"]

    r = client.get("/usuarios/ana/seguindo?offset=0&limit=1", headers=como("ana"))
    assert r.json()["total"] == 2
    assert [u["username"] for u in r.json()["items"]] == ["bia"]


def test_seguir_a_si_mesmo_e_inexistente(client, como):
    assert client.post("/usuarios/ana/follow", headers=como("ana")).status_code == 422
    assert client.post("/usuarios/ninguem/follow", headers=como("ana")).status_code == 404
