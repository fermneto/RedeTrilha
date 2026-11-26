"""Rengas no feed e no perfil, como reposts no X: sobem com a atividade de um seguido."""

from datetime import datetime


def _seguir(client, como, quem: str, seguido: str) -> None:
    assert client.post(f"/usuarios/{seguido}/follow", headers=como(quem)).status_code == 204


def _poema(client, como, autor: str, texto: str) -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201
    return r.json()["id"]


def _renga(client, como, criador: str, **extra) -> int:
    corpo = {"titulo": "Renga do RU", "primeira_estrofe": "fila do RU\n  às onze", **extra}
    r = client.post("/rengas", json=corpo, headers=como(criador))
    assert r.status_code == 201
    return r.json()["id"]


def _estrofe(client, como, autor: str, renga_id: int) -> None:
    r = client.post(
        f"/rengas/{renga_id}/estrofes", json={"texto": "mais uma\n  estrofe"}, headers=como(autor)
    )
    assert r.status_code == 201, r.text


def _resumo(corpo: dict) -> list:
    """("poema", texto) ou ("renga", id, atividade, [usernames do rótulo]) de cada item."""
    return [
        ("poema", i["texto"])
        if i["tipo"] == "poema"
        else ("renga", i["renga"]["id"], i["atividade"], [u["username"] for u in i["por"]])
        for i in corpo["items"]
    ]


def test_renga_do_seguido_entra_como_abertura(client, como):
    renga_id = _renga(client, como, "bia")
    _seguir(client, como, "ana", "bia")

    corpo = client.get("/feed", headers=como("ana")).json()
    assert _resumo(corpo) == [("renga", renga_id, "abriu", ["bia"])]
    assert corpo["total"] == 1
    assert corpo["items"][0]["renga"]["estrofes"][0]["texto"] == "fila do RU\n  às onze"
    assert corpo["items"][0]["renga"]["posso_escrever"] is True
    # Quem não segue ninguém envolvido não vê.
    assert client.get("/feed", headers=como("caio")).json()["items"] == []


def test_poema_no_feed_traz_tipo(client, como):
    _poema(client, como, "ana", "um poema")
    item = client.get("/feed", headers=como("ana")).json()["items"][0]
    assert (item["tipo"], item["texto"]) == ("poema", "um poema")


def test_renga_sobe_com_a_estrofe_do_seguido(client, como):
    _seguir(client, como, "ana", "caio")
    renga_id = _renga(client, como, "bia")
    _poema(client, como, "caio", "primeiro do caio")
    _estrofe(client, como, "caio", renga_id)
    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("renga", renga_id, "escreveu", ["caio"]),
        ("poema", "primeiro do caio"),
    ]

    _poema(client, como, "caio", "segundo do caio")
    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("poema", "segundo do caio"),
        ("renga", renga_id, "escreveu", ["caio"]),
        ("poema", "primeiro do caio"),
    ]


def test_renga_aparece_uma_vez_com_todos_os_seguidos(client, como, criar_usuario):
    criar_usuario("davi")
    for seguido in ("bia", "caio", "davi"):
        _seguir(client, como, "ana", seguido)
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _estrofe(client, como, "davi", renga_id)

    corpo = client.get("/feed", headers=como("ana")).json()
    assert _resumo(corpo) == [("renga", renga_id, "escreveu", ["davi", "caio"])]
    assert corpo["total"] == 1


def test_criador_aparece_sempre_como_quem_abriu(client, como):
    _seguir(client, como, "ana", "bia")
    _seguir(client, como, "ana", "caio")
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _estrofe(client, como, "bia", renga_id)
    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("renga", renga_id, "abriu", ["bia"])
    ]

    # Quando outra pessoa escreve depois, o criador fica fora do "escreveu".
    _estrofe(client, como, "caio", renga_id)
    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("renga", renga_id, "escreveu", ["caio"])
    ]


def test_encerrar_sobe_a_renga_com_o_rotulo_encerrou(client, como):
    _seguir(client, como, "ana", "bia")
    _seguir(client, como, "ana", "caio")
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _poema(client, como, "caio", "poema do caio")
    assert _resumo(client.get("/feed", headers=como("ana")).json())[0] == (
        "poema",
        "poema do caio",
    )

    client.post(f"/rengas/{renga_id}/encerrar", headers=como("bia"))

    esperado = [("renga", renga_id, "encerrou", ["bia"]), ("poema", "poema do caio")]
    assert _resumo(client.get("/feed", headers=como("ana")).json()) == esperado
    # No feed da própria criadora também.
    assert _resumo(client.get("/feed", headers=como("bia")).json())[0] == esperado[0]


def test_encerramento_so_conta_para_quem_segue_a_criadora(client, como):
    _seguir(client, como, "ana", "caio")
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _poema(client, como, "caio", "poema do caio")
    client.post(f"/rengas/{renga_id}/encerrar", headers=como("bia"))

    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("poema", "poema do caio"),
        ("renga", renga_id, "escreveu", ["caio"]),
    ]


def test_fechar_pelo_limite_nao_e_encerramento(client, como):
    _seguir(client, como, "ana", "bia")
    renga_id = _renga(client, como, "bia", limite=3)
    _estrofe(client, como, "caio", renga_id)
    _estrofe(client, como, "bia", renga_id)

    item = client.get("/feed", headers=como("ana")).json()["items"][0]
    assert (item["atividade"], item["renga"]["fechada"]) == ("abriu", True)


def test_perfil_ignora_o_encerramento(client, como):
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _poema(client, como, "bia", "poema da bia")
    client.post(f"/rengas/{renga_id}/encerrar", headers=como("bia"))

    assert _resumo(client.get("/usuarios/bia/posts", headers=como("ana")).json()) == [
        ("poema", "poema da bia"),
        ("renga", renga_id, "abriu", ["bia"]),
    ]


def test_renga_conta_como_poema_no_perfil(client, como):
    _poema(client, como, "caio", "poema do caio")
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _estrofe(client, como, "bia", renga_id)
    _renga(client, como, "caio", titulo="Renga do caio")

    def poemas(username: str) -> int:
        return client.get(f"/usuarios/{username}", headers=como("ana")).json()["poemas"]

    # caio: 1 poema + 2 rengas; bia: 1 renga (duas estrofes contam uma vez); ana: nada.
    assert (poemas("caio"), poemas("bia"), poemas("ana")) == (3, 1, 0)

    acervo = client.get("/acervo?tipo=do_verso&limit=100", headers=como("ana")).json()
    no_acervo = {p["username"]: p["poemas"] for p in acervo["items"]}
    assert (no_acervo["caio"], no_acervo["bia"], no_acervo["ana"]) == (3, 1, 0)


def test_renga_fechada_continua_no_feed(client, como):
    _seguir(client, como, "ana", "bia")
    renga_id = _renga(client, como, "bia", limite=3)
    _estrofe(client, como, "caio", renga_id)
    _estrofe(client, como, "bia", renga_id)

    item = client.get("/feed", headers=como("ana")).json()["items"][0]
    assert (item["tipo"], item["renga"]["fechada"]) == ("renga", True)
    assert [a["username"] for a in item["renga"]["autores"]] == ["bia", "caio"]
    assert item["renga"]["posso_escrever"] is False


def test_as_proprias_rengas_entram_no_proprio_feed(client, como):
    criada = _renga(client, como, "ana")
    de_outro = _renga(client, como, "bia", titulo="Renga da bia")
    _estrofe(client, como, "ana", de_outro)

    assert _resumo(client.get("/feed", headers=como("ana")).json()) == [
        ("renga", de_outro, "escreveu", ["ana"]),
        ("renga", criada, "abriu", ["ana"]),
    ]


def test_renga_de_convidados_aparece_para_quem_segue(client, como):
    _seguir(client, como, "caio", "ana")
    renga_id = _renga(client, como, "ana", modo="convidados", convidados=["bia"])

    item = client.get("/feed", headers=como("caio")).json()["items"][0]
    assert item["renga"]["id"] == renga_id
    assert item["renga"]["posso_escrever"] is False
    assert item["renga"]["motivo"] == "só os convidados escrevem nesta renga"


def test_perfil_mostra_a_renga_na_data_da_pessoa(client, como):
    renga_id = _renga(client, como, "bia")
    _estrofe(client, como, "caio", renga_id)
    _poema(client, como, "caio", "poema do caio")
    # A estrofe mais nova da bia não mexe na posição da renga no perfil do caio.
    _estrofe(client, como, "bia", renga_id)

    assert _resumo(client.get("/usuarios/caio/posts", headers=como("ana")).json()) == [
        ("poema", "poema do caio"),
        ("renga", renga_id, "escreveu", ["caio"]),
    ]
    assert _resumo(client.get("/usuarios/bia/posts", headers=como("ana")).json()) == [
        ("renga", renga_id, "abriu", ["bia"]),
    ]


def test_cursor_estavel_com_poema_e_estrofe_na_mesma_data(client, como):
    """Post e estrofe com a mesma data (e o mesmo id): o cursor não repete nem pula."""
    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.renga import EstrofeRenga

    poema_id = _poema(client, como, "ana", "poema empatado")
    renga_id = _renga(client, como, "ana")
    _poema(client, como, "ana", "poema mais novo")
    mesma_data = datetime(2026, 11, 20, 12, 0, 0)
    with SessionLocal() as db:
        db.get(Post, poema_id).created_at = mesma_data
        estrofe = db.query(EstrofeRenga).filter_by(renga_id=renga_id).one()
        estrofe.created_at = mesma_data
        db.commit()

    vistos, cursor = [], None
    while True:
        url = "/feed?limit=1" + (f"&cursor={cursor}" if cursor else "")
        corpo = client.get(url, headers=como("ana")).json()
        vistos += _resumo(corpo)[: corpo["fim_em"]]
        cursor = corpo["proximo_cursor"]
        if corpo["fim_em"] is not None:
            break

    # No empate, o post vem antes da estrofe; a ordem é sempre a mesma.
    assert vistos == [
        ("poema", "poema mais novo"),
        ("poema", "poema empatado"),
        ("renga", renga_id, "abriu", ["ana"]),
    ]
