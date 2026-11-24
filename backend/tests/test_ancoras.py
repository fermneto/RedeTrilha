"""Crítica ancorada no verso (issue #71), sem depender da auth (fixture `como`).

Os versos são as linhas de `texto.split("\\n")`, base 1, com as linhas em branco
entre estrofes contadas.
"""

import pytest

POEMA = "  Minha terra tem palmeiras,\nOnde canta o Sabiá;\n\nAs aves, que aqui gorjeiam,\n  Não gorjeiam como lá."


def _poema(client, como, texto: str = POEMA, autor: str = "bia") -> int:
    return client.post("/posts", json={"texto": texto}, headers=como(autor)).json()["id"]


def _criticar(client, como, post_id, inicio, fim, texto="crítica", parent_id=None, autor="ana"):
    return client.post(
        f"/posts/{post_id}/comentarios",
        json={
            "texto": texto,
            "parent_id": parent_id,
            "ancora": {"verso_inicio": inicio, "verso_fim": fim},
        },
        headers=como(autor),
    )


def _raizes(client, como, post_id, **params):
    r = client.get(f"/posts/{post_id}/comentarios", params=params, headers=como("ana"))
    assert r.status_code == 200
    return r.json()


def _marcas(client, como, post_id):
    r = client.get(f"/posts/{post_id}/comentarios/versos", headers=como("ana"))
    assert r.status_code == 200
    return [(m["verso"], m["comentarios"]) for m in r.json()["items"]]


def test_critica_guarda_o_trecho_com_recuos_e_quebras(client, como):
    post_id = _poema(client, como)
    r = _criticar(client, como, post_id, 1, 2)
    assert r.status_code == 201
    assert r.json()["ancora"] == {
        "verso_inicio": 1,
        "verso_fim": 2,
        "trecho": "  Minha terra tem palmeiras,\nOnde canta o Sabiá;",
    }


def test_linha_em_branco_conta_como_verso(client, como):
    post_id = _poema(client, como)
    ancora = _criticar(client, como, post_id, 4, 5).json()["ancora"]
    assert ancora["trecho"] == "As aves, que aqui gorjeiam,\n  Não gorjeiam como lá."
    # O intervalo pode atravessar a linha em branco entre estrofes.
    ancora = _criticar(client, como, post_id, 2, 4).json()["ancora"]
    assert ancora["trecho"] == "Onde canta o Sabiá;\n\nAs aves, que aqui gorjeiam,"


def test_listagem_traz_a_ancora_e_o_comentario_sem_ancora_continua_igual(client, como):
    post_id = _poema(client, como)
    critica = _criticar(client, como, post_id, 5, 5).json()
    plano = client.post(
        f"/posts/{post_id}/comentarios", json={"texto": "lindo"}, headers=como("caio")
    ).json()
    assert plano["ancora"] is None
    resposta = client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": "concordo", "parent_id": critica["id"]},
        headers=como("bia"),
    ).json()
    assert resposta["ancora"] is None

    itens = _raizes(client, como, post_id)["items"]
    assert [(c["texto"], c["ancora"] and c["ancora"]["trecho"]) for c in itens] == [
        ("crítica", "  Não gorjeiam como lá."),
        ("lindo", None),
    ]
    assert itens[0]["respostas"][0]["ancora"] is None
    r = client.get(f"/comentarios/{critica['id']}/respostas", headers=como("ana"))
    assert r.json()["items"][0]["ancora"] is None


@pytest.mark.parametrize(
    ("inicio", "fim", "mensagem"),
    [
        (3, 2, "o verso inicial não pode vir depois do verso final"),
        (0, 1, "o poema tem 5 versos; escolha entre o 1 e o 5"),
        (4, 6, "o poema tem 5 versos; escolha entre o 1 e o 5"),
        (3, 3, "o trecho escolhido está em branco"),
    ],
)
def test_intervalo_invalido_da_422(client, como, inicio, fim, mensagem):
    post_id = _poema(client, como)
    r = _criticar(client, como, post_id, inicio, fim)
    assert r.status_code == 422
    assert r.json()["detail"] == mensagem
    assert _raizes(client, como, post_id)["total"] == 0


def test_resposta_nao_tem_ancora_propria(client, como):
    post_id = _poema(client, como)
    pai = _criticar(client, como, post_id, 1, 1).json()
    r = _criticar(client, como, post_id, 2, 2, parent_id=pai["id"])
    assert r.status_code == 422
    assert "herda o trecho do pai" in r.json()["detail"]


def test_repost_puro_ancora_no_texto_do_original(client, como):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.post import Post

    post_id = _poema(client, como)
    client.post(f"/posts/{post_id}/repostar", headers=como("caio"))
    with SessionLocal() as db:
        repost_id = db.scalar(select(Post.id).where(Post.repost_de_id == post_id))
    r = _criticar(client, como, repost_id, 2, 2)
    assert (r.status_code, r.json()["post_id"]) == (201, post_id)
    assert r.json()["ancora"]["trecho"] == "Onde canta o Sabiá;"


def test_marcas_contam_os_versos_e_o_filtro_traz_as_criticas_do_verso(client, como):
    post_id = _poema(client, como)
    a = _criticar(client, como, post_id, 1, 2, "a").json()
    b = _criticar(client, como, post_id, 2, 2, "b", autor="caio").json()
    client.post(f"/posts/{post_id}/comentarios", json={"texto": "plano"}, headers=como("bia"))

    assert _marcas(client, como, post_id) == [(1, 1), (2, 2)]
    pagina = _raizes(client, como, post_id, verso=2)
    assert ([c["id"] for c in pagina["items"]], pagina["total"]) == ([a["id"], b["id"]], 2)
    assert [c["id"] for c in _raizes(client, como, post_id, verso=1)["items"]] == [a["id"]]
    assert _raizes(client, como, post_id, verso=4)["items"] == []


def test_filtro_por_verso_pagina_por_cursor(client, como):
    post_id = _poema(client, como)
    ids = [_criticar(client, como, post_id, 1, 1, f"c{i}").json()["id"] for i in range(3)]
    client.post(f"/posts/{post_id}/comentarios", json={"texto": "plano"}, headers=como("bia"))
    primeira = _raizes(client, como, post_id, verso=1, limit=2)
    segunda = _raizes(client, como, post_id, verso=1, limit=2, cursor=primeira["proximo_cursor"])
    assert [c["id"] for c in primeira["items"] + segunda["items"]] == ids
    assert segunda["proximo_cursor"] is None


def test_apagar_critica_e_poema_leva_as_ancoras(client, como):
    post_id = _poema(client, como)
    sozinha = _criticar(client, como, post_id, 1, 1).json()
    com_resposta = _criticar(client, como, post_id, 2, 2).json()
    client.post(
        f"/posts/{post_id}/comentarios",
        json={"texto": "oi", "parent_id": com_resposta["id"]},
        headers=como("bia"),
    )

    r = client.delete(f"/comentarios/{sozinha['id']}", headers=como("ana"))
    assert r.json()["resultado"] == "apagado"
    assert _marcas(client, como, post_id) == [(2, 1)]
    # O marcador "comentário removido" continua mostrando o trecho: as respostas dependem dele.
    client.delete(f"/comentarios/{com_resposta['id']}", headers=como("ana"))
    marcador = _raizes(client, como, post_id)["items"][0]
    assert (marcador["removido"], marcador["ancora"]["trecho"]) == (True, "Onde canta o Sabiá;")

    assert client.delete(f"/posts/{post_id}", headers=como("bia")).status_code == 204

    from app.db import SessionLocal
    from app.models.ancora_comentario import AncoraComentario

    with SessionLocal() as db:
        assert db.query(AncoraComentario).count() == 0
