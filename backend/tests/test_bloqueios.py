"""Bloqueio como no X, na rede inteira (services/bloqueios.py): a bia bloqueia o caio.

O caio (bloqueado) não vê nada da bia (404) e não interage com ela; a bia não
interage com o caio (403) e deixa de vê-lo nos feeds, nas tags, nas rengas e
nas sugestões, e ele deixa de vê-la nos dele. As mensagens estão em
tests/test_mensagens.py.
"""


def bloquear(client, como, quem: str = "bia", alvo: str = "caio") -> None:
    assert client.post(f"/usuarios/{alvo}/bloqueio", headers=como(quem)).status_code == 204


def poema(client, como, quem: str, texto: str = "a maré\n#mar") -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(quem))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def ids_do_feed(client, como, quem: str, rota: str) -> set[int]:
    itens = client.get(rota, headers=como(quem)).json()["items"]
    return {i["id"] for i in itens if i.get("tipo", "poema") == "poema"}


def test_bloquear_desfaz_os_follows_nos_dois_sentidos_e_impede_seguir(client, como):
    client.post("/usuarios/caio/follow", headers=como("bia"))
    client.post("/usuarios/bia/follow", headers=como("caio"))
    bloquear(client, como)

    assert client.get("/usuarios/bia/seguindo", headers=como("ana")).json()["total"] == 0
    assert client.get("/usuarios/bia/seguidores", headers=como("ana")).json()["total"] == 0
    assert client.post("/usuarios/caio/follow", headers=como("bia")).status_code == 403
    assert client.post("/usuarios/bia/follow", headers=como("caio")).status_code == 404

    # Desbloquear libera de novo, mas os follows não voltam sozinhos.
    assert client.delete("/usuarios/caio/bloqueio", headers=como("bia")).status_code == 204
    assert client.get("/usuarios/bia/seguindo", headers=como("ana")).json()["total"] == 0
    assert client.post("/usuarios/caio/follow", headers=como("bia")).status_code == 204


def test_quem_foi_bloqueado_nao_ve_poema_nem_perfil(client, como):
    da_bia = poema(client, como, "bia")
    do_caio = poema(client, como, "caio")
    bloquear(client, como)

    assert client.get(f"/posts/{da_bia}", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia/posts", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia/bloqueio", headers=como("caio")).status_code == 404
    # Quem bloqueou ainda vê o perfil e os poemas do bloqueado (para desbloquear).
    assert client.get(f"/posts/{do_caio}", headers=como("bia")).status_code == 200
    assert client.get("/usuarios/caio", headers=como("bia")).status_code == 200
    assert [p["id"] for p in client.get("/usuarios/caio/posts", headers=como("bia")).json()["items"]] == [do_caio]
    assert client.get("/usuarios/caio/bloqueio", headers=como("bia")).json() == {"bloqueei": True}
    assert client.get("/usuarios/caio/bloqueio", headers=como("ana")).json() == {"bloqueei": False}
    # Para os outros, nada muda.
    assert client.get(f"/posts/{da_bia}", headers=como("ana")).status_code == 200


def test_nenhum_dos_dois_curte_comenta_reposta_nem_cita(client, como):
    da_bia = poema(client, como, "bia")
    do_caio = poema(client, como, "caio")
    bloquear(client, como)

    def acoes(quem: str, post_id: int) -> list[int]:
        return [
            client.post(f"/posts/{post_id}/curtir", headers=como(quem)).status_code,
            client.post(f"/posts/{post_id}/comentarios", json={"texto": "oi"}, headers=como(quem)).status_code,
            client.post(f"/posts/{post_id}/repostar", headers=como(quem)).status_code,
            client.post("/posts", json={"texto": "cito", "repost_de_id": post_id}, headers=como(quem)).status_code,
        ]

    assert acoes("caio", da_bia) == [404] * 4
    assert acoes("bia", do_caio) == [403] * 4
    assert acoes("ana", da_bia) == [204, 201, 204, 201]


def test_rengas_de_quem_bloqueou_somem_e_nao_aceitam_estrofe(client, como):
    da_bia = client.post("/rengas", json={"titulo": "R", "primeira_estrofe": "um"}, headers=como("bia")).json()["id"]
    do_caio = client.post("/rengas", json={"titulo": "S", "primeira_estrofe": "dois"}, headers=como("caio")).json()["id"]
    bloquear(client, como)

    assert client.get(f"/rengas/{da_bia}", headers=como("caio")).status_code == 404
    r = client.post(f"/rengas/{da_bia}/estrofes", json={"texto": "três"}, headers=como("caio"))
    assert r.status_code == 404
    r = client.post(f"/rengas/{do_caio}/estrofes", json={"texto": "quatro"}, headers=como("bia"))
    assert r.status_code == 403
    assert [x["id"] for x in client.get("/rengas", headers=como("caio")).json()["items"]] == [do_caio]
    assert [x["id"] for x in client.get("/rengas", headers=como("bia")).json()["items"]] == [da_bia]
    assert len(client.get("/rengas", headers=como("ana")).json()["items"]) == 2


def test_feeds_tags_e_explorar_sem_os_poemas_do_outro(client, como):
    da_bia = poema(client, como, "bia")
    do_caio = poema(client, como, "caio")
    da_ana = poema(client, como, "ana")
    client.post("/usuarios/ana/follow", headers=como("bia"))
    client.post("/usuarios/ana/follow", headers=como("caio"))
    # A ana reposta o poema do caio e comenta o da bia: um entraria no Seguindo da
    # bia; o outro sobe no Para você de todos.
    client.post(f"/posts/{do_caio}/repostar", headers=como("ana"))
    client.post(f"/posts/{da_bia}/comentarios", json={"texto": "lindo"}, headers=como("ana"))
    assert do_caio in ids_do_feed(client, como, "bia", "/feed")
    bloquear(client, como)

    assert ids_do_feed(client, como, "bia", "/feed") == {da_bia, da_ana}
    assert ids_do_feed(client, como, "bia", "/feed/para-voce") == {da_bia, da_ana}
    assert ids_do_feed(client, como, "caio", "/feed/para-voce") == {do_caio, da_ana}
    assert ids_do_feed(client, como, "ana", "/feed/para-voce") == {da_bia, do_caio, da_ana}
    for rota in ["/tags/mar/posts", "/explorar", "/explorar?tag=mar"]:
        assert ids_do_feed(client, como, "bia", rota) == {da_bia, da_ana}, rota
        assert ids_do_feed(client, como, "caio", rota) == {do_caio, da_ana}, rota
    assert client.get("/tags/mar/posts", headers=como("caio")).json()["total"] == 2


def test_sugestoes_sem_quem_bloqueei_nem_quem_me_bloqueou(client, como):
    for quem in ("ana", "bia", "caio"):
        poema(client, como, quem)
    bloquear(client, como)
    sugeridos = lambda quem: {s["username"] for s in client.get("/sugestoes", headers=como(quem)).json()["items"]}  # noqa: E731
    assert sugeridos("bia") == {"ana"}
    assert sugeridos("caio") == {"ana"}
    assert sugeridos("ana") == {"bia", "caio"}


def test_nao_manda_por_mensagem_poema_de_quem_tem_bloqueio(client, como):
    da_bia = poema(client, como, "bia")
    conversa = client.post("/mensagens/conversas", json={"username": "ana"}, headers=como("caio")).json()["id"]
    bloquear(client, como)
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"post_id": da_bia}, headers=como("caio"))
    assert r.status_code == 404
