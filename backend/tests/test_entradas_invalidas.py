"""Entradas que o banco não aceita viram 422, nunca 500.

As chaves são INTEGER (int4) no Postgres: um id acima de 2**31 - 1 estourava lá
(e acima de 2**63 - 1 também no SQLite) e respondia 500.
"""

import base64

import pytest

from app.core.vistos import codificar as codificar_vistos

FORA_DO_INT4 = 2**31
FORA_DO_INT8 = 2**63


def _poema(client, como, quem="ana", texto="a maré\nsobe"):
    r = client.post("/posts", json={"texto": texto}, headers=como(quem))
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.parametrize("grande", [FORA_DO_INT4, FORA_DO_INT8])
@pytest.mark.parametrize(
    "metodo, rota",
    [
        ("GET", "/posts/{n}"),
        ("POST", "/posts/{n}/curtir"),
        ("POST", "/posts/{n}/repostar"),
        ("GET", "/posts/{n}/comentarios"),
        ("GET", "/posts/{n}/curtidas"),
        ("GET", "/comentarios/{n}/respostas"),
        ("GET", "/rengas/{n}"),
        ("POST", "/rengas/{n}/curtir"),
        ("GET", "/antologias/{n}"),
        ("GET", "/mensagens/conversas/{n}"),
        ("GET", "/rascunhos/{n}"),
        ("GET", "/cartoes/poema/{n}"),
        ("GET", "/cartoes/antologia/{n}"),
        ("GET", "/explorar?offset={n}"),
        ("GET", "/usuarios/ana/seguidores?offset={n}"),
        ("GET", "/antologias?post_id={n}"),
        ("GET", "/mensagens/conversas/1/mensagens?antes={n}"),
    ],
)
def test_id_e_offset_fora_do_int4_dao_422(client, como, metodo, rota, grande):
    r = client.request(metodo, rota.format(n=grande), headers=como("ana"))
    assert r.status_code == 422, r.text


@pytest.mark.parametrize("rota", ["/posts/0", "/posts/-1", "/antologias/0"])
def test_id_que_nao_e_positivo_da_422(client, como, rota):
    assert client.get(rota, headers=como("ana")).status_code == 422


@pytest.mark.parametrize(
    "rota, corpo",
    [
        ("/posts", {"texto": "x", "repost_de_id": FORA_DO_INT4}),
        ("/posts", {"texto": "x", "repost_de_id": FORA_DO_INT8}),
        ("/posts", {"texto": "x", "renga_citada_id": FORA_DO_INT4}),
        ("/rascunhos", {"texto": "x", "repost_de_id": FORA_DO_INT4}),
        ("/feed/vistos", {"itens": [{"tipo": "poema", "id": FORA_DO_INT4}]}),
        ("/feed/vistos", {"itens": [{"tipo": "poema", "id": FORA_DO_INT8}]}),
        ("/avisos/lidos", {"ate": FORA_DO_INT8}),
    ],
)
def test_id_do_corpo_fora_do_int4_da_422(client, como, rota, corpo):
    assert client.post(rota, json=corpo, headers=como("ana")).status_code == 422


def test_ids_do_corpo_presos_a_um_poema_dao_422(client, como):
    pid = _poema(client, como)
    ana = como("ana")
    r = client.post(f"/posts/{pid}/comentarios", json={"texto": "x", "parent_id": FORA_DO_INT8}, headers=ana)
    assert r.status_code == 422
    r = client.post(
        f"/posts/{pid}/comentarios",
        json={"texto": "x", "ancora": {"verso_inicio": 1, "verso_fim": FORA_DO_INT8}},
        headers=ana,
    )
    assert r.status_code == 422
    assert client.get(f"/posts/{pid}/comentarios?verso={FORA_DO_INT8}", headers=ana).status_code == 422
    antologia = client.post("/antologias", json={"nome": "x"}, headers=ana).json()["id"]
    r = client.post(f"/antologias/{antologia}/poemas", json={"post_id": FORA_DO_INT4}, headers=ana)
    assert r.status_code == 422
    r = client.post(f"/antologias/{antologia}/rengas", json={"renga_id": FORA_DO_INT4}, headers=ana)
    assert r.status_code == 422
    conversa = client.post("/mensagens/conversas", json={"username": "bia"}, headers=ana).json()["id"]
    r = client.post(
        f"/mensagens/conversas/{conversa}/mensagens", json={"post_id": FORA_DO_INT4}, headers=ana
    )
    assert r.status_code == 422
    r = client.post(f"/mensagens/conversas/{conversa}/lida", json={"ate": FORA_DO_INT8}, headers=ana)
    assert r.status_code == 422


def _cursor(bruto: str) -> str:
    return base64.urlsafe_b64encode(bruto.encode()).decode()


@pytest.mark.parametrize(
    "rota, bruto",
    [
        ("/posts/{pid}/comentarios", f"2026-01-01T00:00:00|{FORA_DO_INT4}"),
        ("/posts/{pid}/comentarios", f"2026-01-01T00:00:00|{FORA_DO_INT8}"),
        ("/posts/{pid}/comentarios", "0001-01-01T00:00:00+03:00|1"),
        ("/avisos", f"2026-01-01T00:00:00|{FORA_DO_INT8}"),
        ("/feed", "9999-12-31T23:59:59-03:00|1|"),
        ("/feed", "0001-01-01T00:00:00+03:00|1|"),
        ("/feed", f"mais|0|0|0|0|0|2026-01-01T00:00:00|{FORA_DO_INT8}|"),
        ("/feed", f"mais|0|0|0|0|0|2026-01-01T00:00:00|{FORA_DO_INT4}|"),
        ("/feed", f"2026-01-01T00:00:00|1|{codificar_vistos({('poema', FORA_DO_INT8)})}"),
        ("/feed/para-voce", f"pv|2026-01-01T00:00:00|1|{codificar_vistos({('poema', FORA_DO_INT4)})}"),
        ("/mensagens/conversas", str(FORA_DO_INT8)),
    ],
)
def test_cursor_fora_do_banco_e_cursor_invalido(client, como, rota, bruto):
    """O cursor é opaco, mas vem do cliente: um id ou uma data que o banco não
    aceita dá o 422 "cursor inválido" de sempre, não 500."""
    pid = _poema(client, como)
    cursor = bruto if rota.startswith("/mensagens") else _cursor(bruto)
    r = client.get(rota.format(pid=pid), params={"cursor": cursor}, headers=como("ana"))
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == "cursor inválido"


def test_id_no_teto_do_int4_continua_404(client, como):
    assert client.get(f"/posts/{2**31 - 1}", headers=como("ana")).status_code == 404
