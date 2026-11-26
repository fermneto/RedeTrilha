"""A repercussão na página da publicação: quem curtiu, quem repostou e quem citou
um poema ou uma renga (services/repercussao.py). Páginas no padrão
`{items, total, offset, limit}`, da ação mais recente para a mais antiga."""


def _poema(client, como, autor="ana") -> int:
    r = client.post("/posts", json={"titulo": "Chuva", "texto": "a chuva\n\n  cai"}, headers=como(autor))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _renga(client, como, criador="ana") -> int:
    corpo = {"titulo": "Renga do RU", "primeira_estrofe": "fila do RU\n  às onze"}
    r = client.post("/rengas", json=corpo, headers=como(criador))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _usernames(client, como, caminho, quem="ana") -> tuple[list[str], int]:
    r = client.get(caminho, headers=como(quem))
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert set(corpo) == {"items", "total", "offset", "limit"}
    return [u["username"] for u in corpo["items"]], corpo["total"]


def test_quem_curtiu_o_poema_vem_do_mais_recente(client, como):
    pid = _poema(client, como)
    for quem in ("bia", "caio"):
        assert client.post(f"/posts/{pid}/curtir", headers=como(quem)).status_code == 204
    assert _usernames(client, como, f"/posts/{pid}/curtidas") == (["caio", "bia"], 2)
    assert _usernames(client, como, f"/posts/{pid}/curtidas?limit=1&offset=1") == (["bia"], 2)


def test_quem_repostou_o_poema_nao_inclui_quem_citou(client, como):
    pid = _poema(client, como)
    assert client.post(f"/posts/{pid}/repostar", headers=como("bia")).status_code == 204
    r = client.post("/posts", json={"texto": "que verso", "repost_de_id": pid}, headers=como("caio"))
    assert r.status_code == 201
    assert _usernames(client, como, f"/posts/{pid}/reposts") == (["bia"], 1)


def test_repost_puro_mostra_a_repercussao_do_original(client, como):
    pid = _poema(client, como)
    assert client.post(f"/posts/{pid}/curtir", headers=como("caio")).status_code == 204
    assert client.post(f"/posts/{pid}/repostar", headers=como("bia")).status_code == 204
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.post import Post

    with SessionLocal() as db:
        repost_id = db.scalar(select(Post.id).where(Post.repost_de_id == pid, Post.texto == ""))
    assert _usernames(client, como, f"/posts/{repost_id}/curtidas") == (["caio"], 1)


def test_citacoes_do_poema_sem_os_reposts_puros(client, como):
    pid = _poema(client, como)
    assert client.post(f"/posts/{pid}/repostar", headers=como("caio")).status_code == 204
    r = client.post("/posts", json={"texto": "e a chuva\nfica", "repost_de_id": pid}, headers=como("bia"))
    assert r.status_code == 201
    corpo = client.get(f"/posts/{pid}/citacoes", headers=como("ana")).json()
    assert corpo["total"] == 1
    assert corpo["items"][0]["texto"] == "e a chuva\nfica"
    assert corpo["items"][0]["repost_de"]["id"] == pid


def test_repercussao_da_renga(client, como):
    rid = _renga(client, como)
    assert client.post(f"/rengas/{rid}/curtir", headers=como("bia")).status_code == 204
    assert client.post(f"/rengas/{rid}/repostar", headers=como("caio")).status_code == 204
    r = client.post("/posts", json={"texto": "cito a fila", "renga_citada_id": rid}, headers=como("bia"))
    assert r.status_code == 201
    assert _usernames(client, como, f"/rengas/{rid}/curtidas") == (["bia"], 1)
    assert _usernames(client, como, f"/rengas/{rid}/reposts") == (["caio"], 1)
    citacoes = client.get(f"/rengas/{rid}/citacoes", headers=como("ana")).json()
    assert citacoes["total"] == 1
    assert citacoes["items"][0]["renga_citada_id"] == rid


def test_bloqueio_esconde_da_lista_e_o_autor_que_bloqueou_da_404(client, como):
    pid = _poema(client, como)
    rid = _renga(client, como)
    for quem in ("bia", "caio"):
        assert client.post(f"/posts/{pid}/curtir", headers=como(quem)).status_code == 204
    assert client.post("/usuarios/bia/bloqueio", headers=como("caio")).status_code == 204
    assert _usernames(client, como, f"/posts/{pid}/curtidas", quem="caio") == (["caio"], 1)
    assert client.post("/usuarios/caio/bloqueio", headers=como("ana")).status_code == 204
    for caminho in (f"/posts/{pid}/curtidas", f"/posts/{pid}/citacoes", f"/rengas/{rid}/reposts"):
        assert client.get(caminho, headers=como("caio")).status_code == 404


def test_publicacao_que_nao_existe_da_404(client, como):
    for caminho in ("/posts/999/curtidas", "/posts/999/reposts", "/rengas/999/citacoes"):
        assert client.get(caminho, headers=como("ana")).status_code == 404
