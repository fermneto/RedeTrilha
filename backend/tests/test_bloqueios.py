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
    bloquear(client, como)

    assert client.get(f"/posts/{da_bia}", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia/posts", headers=como("caio")).status_code == 404
    assert client.get("/usuarios/bia/bloqueio", headers=como("caio")).status_code == 404
    # Quem bloqueou ainda abre o cabeçalho do perfil (para desbloquear), mas não vê
    # nada do que o bloqueado publicou, repostou ou juntou em antologias.
    client.post("/antologias", json={"nome": "Mar"}, headers=como("caio"))
    assert client.get("/usuarios/caio", headers=como("bia")).status_code == 200
    vazio = client.get("/usuarios/caio/posts", headers=como("bia")).json()
    assert (vazio["items"], vazio["total"]) == ([], 0)
    assert client.get("/usuarios/caio/antologias", headers=como("bia")).json()["items"] == []
    assert client.get("/usuarios/bia/antologias", headers=como("caio")).status_code == 404
    assert len(client.get("/usuarios/caio/antologias", headers=como("ana")).json()["items"]) == 1
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


def comentar(client, como, quem: str, post_id: int, texto: str, **extra) -> dict:
    r = client.post(f"/posts/{post_id}/comentarios", json={"texto": texto, **extra}, headers=como(quem))
    assert r.status_code == 201, r.text
    return r.json()


def test_comentarios_de_quem_tem_bloqueio_somem_para_todos_e_voltam_ao_desbloquear(client, como):
    da_bia = poema(client, como, "bia", "um\ndois\ntrês")
    sozinho = comentar(client, como, "caio", da_bia, "sem resposta")
    com_resposta = comentar(client, como, "caio", da_bia, "com resposta")
    comentar(client, como, "ana", da_bia, "respondo", parent_id=com_resposta["id"])
    critica = comentar(client, como, "caio", da_bia, "o verso 2", ancora={"verso_inicio": 2, "verso_fim": 2})
    comentar(client, como, "ana", da_bia, "a do verso 2 é boa", ancora={"verso_inicio": 2, "verso_fim": 3})
    bloquear(client, como)

    for quem in ("ana", "bia"):
        pagina = client.get(f"/posts/{da_bia}/comentarios", headers=como(quem)).json()
        assert pagina["total"] == 2
        marcador, da_ana = pagina["items"]
        assert marcador["id"] == com_resposta["id"]
        assert (marcador["removido"], marcador["texto"], marcador["autor"]) == (True, "", None)
        assert [r["texto"] for r in marcador["respostas"]] == ["respondo"]
        assert da_ana["autor"]["username"] == "ana"
        versos = client.get(f"/posts/{da_bia}/comentarios/versos", headers=como(quem)).json()["items"]
        assert versos == [{"verso": 2, "comentarios": 1}, {"verso": 3, "comentarios": 1}]
        so_verso_2 = client.get(f"/posts/{da_bia}/comentarios?verso=2", headers=como(quem)).json()
        assert [c["autor"]["username"] for c in so_verso_2["items"]] == ["ana"]
    assert client.get(f"/comentarios/{sozinho['id']}/respostas", headers=como("ana")).status_code == 404
    respostas = client.get(f"/comentarios/{com_resposta['id']}/respostas", headers=como("ana")).json()
    assert [r["texto"] for r in respostas["items"]] == ["respondo"]

    # Filtro na leitura: desbloquear traz tudo de volta.
    client.delete("/usuarios/caio/bloqueio", headers=como("bia"))
    pagina = client.get(f"/posts/{da_bia}/comentarios", headers=como("ana")).json()
    assert pagina["total"] == 4
    assert {c["id"] for c in pagina["items"]} >= {sozinho["id"], critica["id"]}


def test_quem_foi_bloqueado_nao_le_os_comentarios_do_poema(client, como):
    da_bia = poema(client, como, "bia")
    comentario = comentar(client, como, "ana", da_bia, "oi")
    bloquear(client, como)
    for rota in [
        f"/posts/{da_bia}/comentarios",
        f"/posts/{da_bia}/comentarios/versos",
        f"/comentarios/{comentario['id']}/respostas",
    ]:
        assert client.get(rota, headers=como("caio")).status_code == 404, rota


def test_comentario_escondido_nao_sobe_o_poema_no_para_voce(client, como):
    da_bia = poema(client, como, "bia")
    comentar(client, como, "caio", da_bia, "subo?")
    bloquear(client, como)
    item = next(i for i in client.get("/feed/para-voce", headers=como("ana")).json()["items"] if i["id"] == da_bia)
    assert item["comentado_por"] == []


def test_citacao_de_terceiro_mostra_poema_indisponivel_para_o_bloqueado(client, como):
    da_bia = poema(client, como, "bia")
    citacao = client.post("/posts", json={"texto": "cito a bia", "repost_de_id": da_bia}, headers=como("ana")).json()
    bloquear(client, como)
    para_o_caio = client.get(f"/posts/{citacao['id']}", headers=como("caio")).json()
    assert (para_o_caio["repost_de"], para_o_caio["repost_indisponivel"]) == (None, True)
    para_a_ana = client.get(f"/posts/{citacao['id']}", headers=como("ana")).json()
    assert para_a_ana["repost_de"]["id"] == da_bia and para_a_ana["repost_indisponivel"] is False


def test_acervo_e_listas_de_seguidores_sem_o_outro(client, como):
    for quem in ("bia", "caio"):
        client.post("/usuarios/ana/follow", headers=como(quem))
        client.post(f"/usuarios/{quem}/follow", headers=como("ana"))
    bloquear(client, como)

    acervo = lambda quem: {p["username"] for p in client.get("/acervo", headers=como(quem)).json()["items"]}  # noqa: E731
    assert "caio" not in acervo("bia") and "bia" not in acervo("caio")
    assert {"bia", "caio"} <= acervo("ana")
    lista = lambda quem, rota: {u["username"] for u in client.get(rota, headers=como(quem)).json()["items"]}  # noqa: E731
    for rota in ("/usuarios/ana/seguidores", "/usuarios/ana/seguindo"):
        assert lista("bia", rota) == {"bia"}
        assert lista("caio", rota) == {"caio"}
        assert lista("ana", rota) == {"bia", "caio"}
    assert client.get("/usuarios/bia/seguidores", headers=como("caio")).status_code == 404


def test_nao_convida_para_renga_quem_tem_bloqueio(client, como):
    bloquear(client, como)
    corpo = {"titulo": "R", "primeira_estrofe": "um", "modo": "convidados"}
    for quem, convidado in (("bia", "caio"), ("caio", "bia")):
        r = client.post("/rengas", json={**corpo, "convidados": [convidado]}, headers=como(quem))
        assert r.status_code == 422, r.text
    renga = client.post("/rengas", json={**corpo, "convidados": ["ana"]}, headers=como("bia")).json()["id"]
    assert client.post(f"/rengas/{renga}/convites", json={"usernames": ["caio"]}, headers=como("bia")).status_code == 422
