"""Negrito, itálico, sublinhado e tachado no texto do poema (core/marcas.py) nas
rotas: o texto é gravado como veio, e a oficina, as tags, o Em alta e a crítica
ancorada leem o texto sem as marcas, com o mesmo número de linhas."""

SONETO = "**Amor** é fogo que arde sem se ver,\né *ferida* que dói, e não se sente;"


def _poema(client, como, texto: str, autor: str = "bia") -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201
    return r.json()["id"]


def test_poema_grava_e_devolve_as_marcas_como_vieram(client, como):
    post_id = _poema(client, como, SONETO)
    assert client.get(f"/posts/{post_id}", headers=como("ana")).json()["texto"] == SONETO


def test_oficina_conta_sem_as_marcas(client):
    com = client.post("/oficina/analise", json={"texto": SONETO}).json()
    sem = client.post(
        "/oficina/analise",
        json={"texto": "Amor é fogo que arde sem se ver,\né ferida que dói, e não se sente;"},
    ).json()
    assert com == sem
    assert [v["silabas"] for v in com["versos"]] == [10, 10]


def test_oficina_alinha_um_item_por_linha_com_marcas():
    from app.services.oficina import analisar_rascunho

    versos = analisar_rascunho("~~risco~~\n\n  ++recuo++ no verso", None).versos
    assert len(versos) == 3 and versos[1].silabas is None


def test_tags_dentro_de_marcas_continuam_tags(client, como):
    post_id = _poema(client, como, "a **#Chuva** cai\ne o *#mar* ~~#fim~~ e #ma**r**é")
    tags = client.get(f"/posts/{post_id}", headers=como("ana")).json()["tags"]
    assert set(tags) == {"chuva", "mar", "fim", "mare"}
    r = client.get("/tags/chuva/posts", headers=como("ana"))
    assert [p["id"] for p in r.json()["items"]] == [post_id]


def test_trecho_do_em_alta_vem_com_as_marcas(client, como):
    # A linha só de #tags (mesmo em negrito) é pulada; a escolhida volta formatada.
    _poema(client, como, "**#saudade** *#mar*\n  a **casa** *vazia*")
    item = client.get("/tags/trending", headers=como("ana")).json()["items"][0]
    assert item["trecho"] == "  a **casa** *vazia*"


def test_numeracao_de_versos_e_trecho_com_marcas(client, como):
    post_id = _poema(client, como, "**um**\n\n*três* e ~~quatro~~\n++quatro++")
    r = client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": "gostei", "parent_id": None, "ancora": {"verso_inicio": 3, "verso_fim": 4}},
        headers=como("ana"),
    )
    assert r.status_code == 201
    assert r.json()["ancora"]["trecho"] == "*três* e ~~quatro~~\n++quatro++"
    # Verso fora do poema: 4 linhas, com ou sem marcas.
    r = client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": "x", "parent_id": None, "ancora": {"verso_inicio": 5, "verso_fim": 5}},
        headers=como("ana"),
    )
    assert r.status_code == 422


def test_comentario_nao_interpreta_marcas(client, como):
    post_id = _poema(client, como, "um poema")
    r = client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": "**isto** fica *literal*", "parent_id": None},
        headers=como("ana"),
    )
    assert r.json()["texto"] == "**isto** fica *literal*"


def test_rascunho_mantem_as_marcas_ate_publicar(client, como):
    texto = "**Esboço** em *itálico*\n\n  ++recuo++ e \\*literal"
    r = client.post("/rascunhos", json={"texto": texto}, headers=como("ana"))
    rascunho_id = r.json()["id"]
    assert client.get(f"/rascunhos/{rascunho_id}", headers=como("ana")).json()["texto"] == texto
    publicado = client.post(f"/rascunhos/{rascunho_id}/publicar", headers=como("ana")).json()
    assert publicado["texto"] == texto


def test_estrofe_de_renga_com_marcas(client, como):
    estrofe = "na **varanda**\n    a *chuva* escreve"
    r = client.post(
        "/rengas", json={"titulo": "Renga", "primeira_estrofe": "abre"}, headers=como("ana")
    )
    renga_id = r.json()["id"]
    r = client.post(f"/rengas/{renga_id}/estrofes", json={"texto": estrofe}, headers=como("bia"))
    assert r.status_code == 201
    assert r.json()["estrofes"][1]["texto"] == estrofe


def test_mensagem_direta_nao_interpreta_marcas_e_o_poema_vai_como_foi(client, como):
    from tests.test_mensagens import abrir, enviar

    post_id = _poema(client, como, SONETO)
    client.post("/usuarios/bia/follow", headers=como("ana"))
    client.post("/usuarios/ana/follow", headers=como("bia"))
    conversa = abrir(client, como, "ana", "bia")
    mensagem = enviar(client, como, "ana", conversa["id"], "**olha** este *aqui*", post_id=post_id)
    assert mensagem["texto"] == "**olha** este *aqui*"
    assert mensagem["post"]["texto"] == SONETO
