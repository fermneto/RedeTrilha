"""Rengas como os poemas (#171): curtir, repostar, citar, guardar numa antologia e
mandar por mensagem, também as abertas. Curtida, repost e citação avisam todos os
autores da renga (quem escreveu ao menos uma estrofe), nunca quem agiu.

Usa a fixture `como` (sem bcrypt por conta); em `eu`, as contas ganham senha,
porque conta sem login não recebe aviso (services/avisos.py).
"""

import pytest
from sqlalchemy import select, update


@pytest.fixture()
def eu(client, como, criar_usuario):
    """`como`, com ana, bia, caio e dani podendo entrar (com senha)."""
    from app.db import SessionLocal
    from app.models.user import User

    criar_usuario("dani")
    with SessionLocal() as db:
        db.execute(update(User).values(password_hash="x"))
        db.commit()
    return como


def _renga(client, eu, criador="ana", **extra) -> int:
    corpo = {"titulo": "Renga do RU", "primeira_estrofe": "fila do RU\n  às onze", **extra}
    r = client.post("/rengas", json=corpo, headers=eu(criador))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _estrofe(client, eu, autor, renga_id) -> None:
    r = client.post(f"/rengas/{renga_id}/estrofes", json={"texto": "mais uma\n  estrofe"}, headers=eu(autor))
    assert r.status_code == 201, r.text


def _ler(client, eu, renga_id, quem="ana") -> dict:
    r = client.get(f"/rengas/{renga_id}", headers=eu(quem))
    assert r.status_code == 200, r.text
    return r.json()


def _contagens(renga: dict) -> tuple:
    return renga["curtidas"], renga["curti"], renga["reposts"], renga["repostei"]


def _seguir(client, eu, quem, seguido) -> None:
    assert client.post(f"/usuarios/{seguido}/follow", headers=eu(quem)).status_code == 204


def _avisos(client, eu, quem) -> list[tuple]:
    r = client.get("/avisos", headers=eu(quem))
    assert r.status_code == 200, r.text
    return [
        (a["tipo"], a["renga_id"], [u["username"] for u in a["atores"]], a["total_atores"])
        for a in r.json()["items"]
    ]


def _resumo_do_feed(corpo: dict) -> list:
    return [
        ("poema", i["texto"])
        if i["tipo"] == "poema"
        else ("renga", i["renga"]["id"], i["atividade"], [u["username"] for u in i["por"]])
        for i in corpo["items"]
    ]


# ---------- curtir ----------


def test_curtir_renga_e_idempotente_e_conta(client, eu):
    renga_id = _renga(client, eu)

    assert client.post(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 204
    assert client.post(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 204
    client.post(f"/rengas/{renga_id}/curtir", headers=eu("caio"))

    assert _contagens(_ler(client, eu, renga_id, "bia")) == (2, True, 0, False)
    assert _contagens(_ler(client, eu, renga_id, "ana")) == (2, False, 0, False)
    # A listagem (Explorar, perfil) traz os mesmos campos.
    item = client.get("/rengas", headers=eu("bia")).json()["items"][0]
    assert _contagens(item) == (2, True, 0, False)


def test_curtir_renga_aberta_ou_fechada(client, eu):
    aberta = _renga(client, eu)
    fechada = _renga(client, eu)
    client.post(f"/rengas/{fechada}/encerrar", headers=eu("ana"))
    for renga_id in (aberta, fechada):
        assert client.post(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 204
        assert _ler(client, eu, renga_id, "bia")["curti"] is True


def test_descurtir_renga_e_idempotente(client, eu):
    renga_id = _renga(client, eu)
    client.post(f"/rengas/{renga_id}/curtir", headers=eu("bia"))

    assert client.delete(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 204
    assert client.delete(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 204
    assert _contagens(_ler(client, eu, renga_id, "bia")) == (0, False, 0, False)


def test_curtir_e_repostar_renga_inexistente_da_404(client, eu):
    for rota in ("curtir", "repostar"):
        assert client.post(f"/rengas/999/{rota}", headers=eu("ana")).status_code == 404
        assert client.delete(f"/rengas/999/{rota}", headers=eu("ana")).status_code == 404


def test_curtir_e_repostar_com_bloqueio_do_criador(client, eu):
    renga_id = _renga(client, eu)
    assert client.post("/usuarios/bia/bloqueio", headers=eu("ana")).status_code == 204
    # Como no poema: 404 para quem foi bloqueado, 403 para quem bloqueou.
    assert client.post(f"/rengas/{renga_id}/curtir", headers=eu("bia")).status_code == 404
    assert client.post(f"/rengas/{renga_id}/repostar", headers=eu("bia")).status_code == 404
    outra = _renga(client, eu, "caio")
    assert client.post("/usuarios/caio/bloqueio", headers=eu("dani")).status_code == 204
    assert client.post(f"/rengas/{outra}/curtir", headers=eu("dani")).status_code == 403


def test_curtir_na_corrida_do_clique_duplo_nao_estoura(client, eu, monkeypatch):
    """A outra requisição curte entre o SELECT e o INSERT: o SELECT não vê a curtida."""
    from app.db import SessionLocal
    from app.models.curtida_renga import CurtidaRenga
    from app.models.user import User
    from app.services import curtidas_renga

    renga_id = _renga(client, eu)
    with SessionLocal() as db:
        bia = db.scalar(select(User).where(User.username == "bia"))
        db.add(CurtidaRenga(user_id=bia.id, renga_id=renga_id))
        db.commit()

        ver_sem_curtidas = db.scalar
        monkeypatch.setattr(
            db,
            "scalar",
            lambda stmt, *a, **k: None
            if "curtidas_renga" in str(stmt)
            else ver_sem_curtidas(stmt, *a, **k),
        )
        curtidas_renga.curtir(db, bia, renga_id)  # não pode levantar IntegrityError

        monkeypatch.undo()
        assert len(db.scalars(select(CurtidaRenga).where(CurtidaRenga.renga_id == renga_id)).all()) == 1


# ---------- repostar ----------


def test_repostar_renga_e_idempotente_e_desfazer_tambem(client, eu):
    renga_id = _renga(client, eu)

    assert client.post(f"/rengas/{renga_id}/repostar", headers=eu("bia")).status_code == 204
    assert client.post(f"/rengas/{renga_id}/repostar", headers=eu("bia")).status_code == 204
    assert _contagens(_ler(client, eu, renga_id, "bia")) == (0, False, 1, True)

    assert client.delete(f"/rengas/{renga_id}/repostar", headers=eu("bia")).status_code == 204
    assert client.delete(f"/rengas/{renga_id}/repostar", headers=eu("bia")).status_code == 204
    assert _contagens(_ler(client, eu, renga_id, "bia")) == (0, False, 0, False)


def test_repostar_a_propria_renga_vale_como_no_poema(client, eu):
    renga_id = _renga(client, eu)
    assert client.post(f"/rengas/{renga_id}/repostar", headers=eu("ana")).status_code == 204
    assert _ler(client, eu, renga_id, "ana")["repostei"] is True


# ---------- feed ----------


def test_repost_de_renga_entra_no_feed_de_quem_segue_quem_repostou(client, eu):
    renga_id = _renga(client, eu)
    _seguir(client, eu, "caio", "dani")
    assert client.get("/feed", headers=eu("caio")).json()["items"] == []

    client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    corpo = client.get("/feed", headers=eu("caio")).json()
    assert _resumo_do_feed(corpo) == [("renga", renga_id, "repostou", ["dani"])]
    assert corpo["items"][0]["renga"]["reposts"] == 1

    client.delete(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    assert client.get("/feed", headers=eu("caio")).json()["items"] == []


def test_repost_de_renga_sobe_a_renga_uma_vez_com_todos_que_repostaram(client, eu):
    renga_id = _renga(client, eu)
    _seguir(client, eu, "caio", "ana")
    _seguir(client, eu, "caio", "bia")
    _seguir(client, eu, "caio", "dani")
    _estrofe(client, eu, "bia", renga_id)
    client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    client.post(f"/rengas/{renga_id}/repostar", headers=eu("bia"))

    corpo = client.get("/feed", headers=eu("caio")).json()
    assert _resumo_do_feed(corpo) == [("renga", renga_id, "repostou", ["bia", "dani"])]

    # Uma estrofe depois do repost volta o rótulo para "escreveu".
    _estrofe(client, eu, "ana", renga_id)
    assert _resumo_do_feed(client.get("/feed", headers=eu("caio")).json()) == [
        ("renga", renga_id, "abriu", ["ana"])
    ]


def test_repost_de_renga_no_perfil_de_quem_repostou(client, eu):
    renga_id = _renga(client, eu)
    client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    corpo = client.get("/usuarios/dani/posts", headers=eu("caio")).json()
    assert _resumo_do_feed(corpo) == [("renga", renga_id, "repostou", ["dani"])]


def test_feed_pagina_por_cursor_com_reposts_de_renga(client, eu):
    _seguir(client, eu, "caio", "dani")
    rengas = [_renga(client, eu) for _ in range(3)]
    for renga_id in rengas:
        client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
        client.post("/posts", json={"texto": f"poema {renga_id}"}, headers=eu("dani"))

    vistos, cursor = [], None
    while True:
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        corpo = client.get("/feed", params=params, headers=eu("caio")).json()
        vistos += _resumo_do_feed(corpo)
        cursor = corpo["proximo_cursor"]
        if cursor is None:
            break
    assert vistos == _resumo_do_feed(client.get("/feed", params={"limit": 100}, headers=eu("caio")).json())
    assert len(vistos) == 6


def test_repost_de_renga_no_para_voce_tambem_de_quem_nao_segue(client, eu):
    renga_id = _renga(client, eu)
    client.post(f"/rengas/{renga_id}/encerrar", headers=eu("ana"))
    # Fechada, a renga não sobe pelas estrofes no "Para você": só pelo repost.
    assert ("renga", renga_id) not in [
        (i["tipo"], i.get("renga", {}).get("id")) for i in client.get("/feed/para-voce", headers=eu("caio")).json()["items"]
    ]
    client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    client.post(f"/rengas/{renga_id}/repostar", headers=eu("bia"))

    corpo = client.get("/feed/para-voce", headers=eu("caio")).json()
    assert _resumo_do_feed(corpo)[0] == ("renga", renga_id, "repostou", ["bia", "dani"])
    assert [i for i in corpo["items"] if i["tipo"] == "renga"] == corpo["items"][:1]


def test_para_voce_pagina_por_cursor_com_reposts_de_renga(client, eu):
    for _ in range(3):
        renga_id = _renga(client, eu)
        client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
        client.post("/posts", json={"texto": f"poema {renga_id}"}, headers=eu("dani"))

    vistos, cursor = [], None
    while True:
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        corpo = client.get("/feed/para-voce", params=params, headers=eu("caio")).json()
        vistos += _resumo_do_feed(corpo)
        cursor = corpo["proximo_cursor"]
        if cursor is None:
            break
    todos = client.get("/feed/para-voce", params={"limit": 100}, headers=eu("caio")).json()
    assert vistos == _resumo_do_feed(todos)
    assert len(vistos) == 6


# ---------- citar ----------


def test_citar_renga_cria_um_poema_com_a_renga_citada(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, "bia", renga_id)

    r = client.post(
        "/posts", json={"texto": "que renga\n  bonita", "renga_citada_id": renga_id}, headers=eu("caio")
    )
    assert r.status_code == 201, r.text
    citacao = r.json()
    assert citacao["repost_de_id"] is None
    assert citacao["renga_citada_id"] == renga_id
    assert citacao["renga_citada"]["titulo"] == "Renga do RU"
    assert [e["autor"]["username"] for e in citacao["renga_citada"]["estrofes"]] == ["ana", "bia"]
    # A citação conta nos reposts da renga, como nos poemas; não é repost puro.
    assert _contagens(_ler(client, eu, renga_id, "caio")) == (0, False, 1, False)
    # Lida de novo e no feed de quem segue quem citou.
    assert client.get(f"/posts/{citacao['id']}", headers=eu("ana")).json()["renga_citada"]["id"] == renga_id
    _seguir(client, eu, "dani", "caio")
    item = client.get("/feed", headers=eu("dani")).json()["items"][0]
    assert (item["tipo"], item["renga_citada"]["id"]) == ("poema", renga_id)


def test_citar_renga_valida_o_alvo(client, eu):
    renga_id = _renga(client, eu)
    poema = client.post("/posts", json={"texto": "um poema"}, headers=eu("bia")).json()["id"]
    r = client.post(
        "/posts",
        json={"texto": "os dois", "renga_citada_id": renga_id, "repost_de_id": poema},
        headers=eu("caio"),
    )
    assert r.status_code == 422
    assert client.post("/posts", json={"texto": "x", "renga_citada_id": 999}, headers=eu("caio")).status_code == 404
    client.post("/usuarios/caio/bloqueio", headers=eu("ana"))
    r = client.post("/posts", json={"texto": "x", "renga_citada_id": renga_id}, headers=eu("caio"))
    assert r.status_code == 404


def test_apagar_a_citacao_tira_o_vinculo_e_a_contagem(client, eu):
    from app.db import SessionLocal
    from app.models.citacao_renga import CitacaoRenga

    renga_id = _renga(client, eu)
    post_id = client.post(
        "/posts", json={"texto": "cito", "renga_citada_id": renga_id}, headers=eu("caio")
    ).json()["id"]
    assert client.delete(f"/posts/{post_id}", headers=eu("caio")).status_code == 204

    assert _ler(client, eu, renga_id)["reposts"] == 0
    with SessionLocal() as db:
        assert db.scalars(select(CitacaoRenga)).all() == []
    assert _avisos(client, eu, "ana") == []


def test_citacao_de_renga_de_quem_bloqueou_quem_ve_fica_indisponivel(client, eu):
    renga_id = _renga(client, eu)
    post_id = client.post(
        "/posts", json={"texto": "cito", "renga_citada_id": renga_id}, headers=eu("caio")
    ).json()["id"]
    client.post("/usuarios/bia/bloqueio", headers=eu("ana"))

    poema = client.get(f"/posts/{post_id}", headers=eu("bia")).json()
    assert (poema["renga_citada_id"], poema["renga_citada"], poema["repost_indisponivel"]) == (
        renga_id,
        None,
        True,
    )


# ---------- antologias ----------


def _antologia(client, eu, dono="bia", **extra) -> int:
    r = client.post("/antologias", json={"nome": "Cadeias", **extra}, headers=eu(dono))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_guardar_renga_na_antologia(client, eu):
    renga_id = _renga(client, eu)
    poema = client.post("/posts", json={"texto": "um poema"}, headers=eu("caio")).json()["id"]
    antologia = _antologia(client, eu)

    rota = f"/antologias/{antologia}/rengas"
    assert client.post(rota, json={"renga_id": renga_id}, headers=eu("bia")).status_code == 204
    assert client.post(rota, json={"renga_id": renga_id}, headers=eu("bia")).status_code == 204
    client.post(f"/antologias/{antologia}/poemas", json={"post_id": poema}, headers=eu("bia"))

    detalhe = client.get(f"/antologias/{antologia}", headers=eu("caio")).json()
    assert detalhe["qtd"] == 2
    assert [p["id"] for p in detalhe["poemas"]] == [poema]
    assert [r["id"] for r in detalhe["rengas"]] == [renga_id]
    assert detalhe["rengas"][0]["estrofes"][0]["texto"] == "fila do RU\n  às onze"

    marcadas = client.get("/antologias", params={"renga_id": renga_id}, headers=eu("bia")).json()
    assert [(a["id"], a["contem"], a["qtd"]) for a in marcadas["items"]] == [(antologia, True, 2)]

    assert client.delete(f"{rota}/{renga_id}", headers=eu("bia")).status_code == 204
    assert client.delete(f"{rota}/{renga_id}", headers=eu("bia")).status_code == 204
    marcadas = client.get("/antologias", params={"renga_id": renga_id}, headers=eu("bia")).json()
    assert marcadas["items"][0]["contem"] is False


def test_antologia_intercala_poemas_e_rengas_na_ordem_em_que_entraram(client, eu):
    renga_id = _renga(client, eu)
    um = client.post("/posts", json={"titulo": "Um", "texto": "um"}, headers=eu("caio")).json()["id"]
    dois = client.post("/posts", json={"texto": "dois\nverso"}, headers=eu("caio")).json()["id"]
    antologia = _antologia(client, eu)
    client.post(f"/antologias/{antologia}/poemas", json={"post_id": um}, headers=eu("bia"))
    client.post(f"/antologias/{antologia}/rengas", json={"renga_id": renga_id}, headers=eu("bia"))
    client.post(f"/antologias/{antologia}/poemas", json={"post_id": dois}, headers=eu("bia"))

    detalhe = client.get(f"/antologias/{antologia}", headers=eu("caio")).json()
    assert detalhe["ordem"] == [
        {"tipo": "poema", "id": um},
        {"tipo": "renga", "id": renga_id},
        {"tipo": "poema", "id": dois},
    ]

    # O cartão de compartilhamento conta e lista os dois, na mesma ordem.
    client.headers.pop("X-Teste-Usuario", None)
    cartao = client.get(f"/cartoes/antologia/{antologia}").json()
    assert cartao["qtd"] == 3
    assert [(p["titulo"], p["primeiro_verso"], p["autor"]["username"]) for p in cartao["poemas"]] == [
        ("Um", "um", "caio"),
        ("Renga do RU", "", "ana"),
        (None, "dois", "caio"),
    ]


def test_antologia_so_com_renga_aparece_nas_publicas(client, eu):
    renga_id = _renga(client, eu)
    antologia = _antologia(client, eu)
    assert client.get("/antologias/publicas", headers=eu("caio")).json()["items"] == []
    client.post(f"/antologias/{antologia}/rengas", json={"renga_id": renga_id}, headers=eu("bia"))
    assert [a["id"] for a in client.get("/antologias/publicas", headers=eu("caio")).json()["items"]] == [antologia]


def test_antologia_de_renga_valida_dono_e_renga(client, eu):
    renga_id = _renga(client, eu)
    antologia = _antologia(client, eu)
    rota = f"/antologias/{antologia}/rengas"
    assert client.post(rota, json={"renga_id": renga_id}, headers=eu("caio")).status_code == 403
    assert client.post(rota, json={"renga_id": 999}, headers=eu("bia")).status_code == 404
    assert client.get("/antologias", params={"renga_id": 999}, headers=eu("bia")).status_code == 404
    r = client.get("/antologias", params={"renga_id": renga_id, "post_id": 1}, headers=eu("bia"))
    assert r.status_code == 422


def test_apagar_antologia_com_renga(client, eu):
    renga_id = _renga(client, eu)
    antologia = _antologia(client, eu)
    client.post(f"/antologias/{antologia}/rengas", json={"renga_id": renga_id}, headers=eu("bia"))
    assert client.delete(f"/antologias/{antologia}", headers=eu("bia")).status_code == 204
    assert _ler(client, eu, renga_id)["id"] == renga_id


# ---------- mensagens ----------


def _conversa(client, eu, quem="bia", com="caio") -> int:
    r = client.post("/mensagens/conversas", json={"username": com}, headers=eu(quem))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_enviar_renga_por_mensagem(client, eu):
    renga_id = _renga(client, eu)
    conversa = _conversa(client, eu)
    rota = f"/mensagens/conversas/{conversa}/mensagens"

    r = client.post(rota, json={"renga_id": renga_id}, headers=eu("bia"))
    assert r.status_code == 201, r.text
    assert (r.json()["texto"], r.json()["post"], r.json()["renga"]["id"]) == ("", None, renga_id)

    lidas = client.get(rota, headers=eu("caio")).json()["items"]
    assert lidas[-1]["renga"]["estrofes"][0]["autor"]["username"] == "ana"
    caixa = client.get("/mensagens/conversas", params={"aba": "pedidos"}, headers=eu("caio")).json()
    assert caixa["items"][0]["ultima_mensagem"]["renga"]["id"] == renga_id


def test_mensagem_leva_poema_ou_renga(client, eu):
    renga_id = _renga(client, eu)
    poema = client.post("/posts", json={"texto": "um poema"}, headers=eu("ana")).json()["id"]
    rota = f"/mensagens/conversas/{_conversa(client, eu)}/mensagens"
    r = client.post(rota, json={"renga_id": renga_id, "post_id": poema}, headers=eu("bia"))
    assert r.status_code == 422
    assert client.post(rota, json={"renga_id": 999}, headers=eu("bia")).status_code == 404
    client.post("/usuarios/bia/bloqueio", headers=eu("ana"))
    assert client.post(rota, json={"renga_id": renga_id}, headers=eu("bia")).status_code == 404


# ---------- avisos ----------


def test_curtida_de_renga_avisa_todos_os_autores_menos_quem_curtiu(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, "bia", renga_id)
    _estrofe(client, eu, "ana", renga_id)
    _estrofe(client, eu, "caio", renga_id)

    client.post(f"/rengas/{renga_id}/curtir", headers=eu("caio"))
    for autor in ("ana", "bia"):
        assert ("curtida", renga_id, ["caio"], 1) in _avisos(client, eu, autor)
    assert [a for a in _avisos(client, eu, "caio") if a[0] == "curtida"] == []
    assert _avisos(client, eu, "dani") == []
    aviso = client.get("/avisos", headers=eu("ana")).json()["items"][0]
    assert (aviso["tipo"], aviso["titulo"], aviso["post_id"]) == ("curtida", "Renga do RU", None)

    client.delete(f"/rengas/{renga_id}/curtir", headers=eu("caio"))
    for autor in ("ana", "bia"):
        assert [a for a in _avisos(client, eu, autor) if a[0] == "curtida"] == []


def test_repost_de_renga_avisa_todos_os_autores_e_desfazer_tira(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, "bia", renga_id)

    client.post(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    for autor in ("ana", "bia"):
        assert ("repost", renga_id, ["dani"], 1) in _avisos(client, eu, autor)
    client.delete(f"/rengas/{renga_id}/repostar", headers=eu("dani"))
    for autor in ("ana", "bia"):
        assert [a for a in _avisos(client, eu, autor) if a[0] == "repost"] == []


def test_citacao_de_renga_avisa_todos_os_autores(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, "bia", renga_id)
    post_id = client.post(
        "/posts", json={"texto": "cito a renga", "renga_citada_id": renga_id}, headers=eu("bia")
    ).json()["id"]

    aviso = client.get("/avisos", headers=eu("ana")).json()["items"][0]
    assert (aviso["tipo"], aviso["post_id"], aviso["renga_id"]) == ("citacao", post_id, renga_id)
    assert (aviso["titulo"], aviso["trecho"]) == ("Renga do RU", "cito a renga")
    # Quem citou (autora da renga) não se avisa.
    assert [a for a in _avisos(client, eu, "bia") if a[0] == "citacao"] == []


def test_curtidas_da_mesma_renga_viram_uma_linha_e_de_rengas_diferentes_nao(client, eu):
    uma = _renga(client, eu)
    outra = _renga(client, eu)
    poema = client.post("/posts", json={"texto": "um poema"}, headers=eu("ana")).json()["id"]
    for quem in ("bia", "caio"):
        client.post(f"/rengas/{uma}/curtir", headers=eu(quem))
    client.post(f"/rengas/{outra}/curtir", headers=eu("dani"))
    client.post(f"/posts/{poema}/curtir", headers=eu("dani"))

    linhas = _avisos(client, eu, "ana")
    assert linhas == [
        ("curtida", None, ["dani"], 1),
        ("curtida", outra, ["dani"], 1),
        ("curtida", uma, ["caio", "bia"], 2),
    ]
    assert client.get("/avisos/resumo", headers=eu("ana")).json()["nao_lidos"] == 3


def test_curtir_a_propria_renga_avisa_so_os_outros_autores(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, "bia", renga_id)
    client.post(f"/rengas/{renga_id}/curtir", headers=eu("ana"))
    assert _avisos(client, eu, "ana") == [("estrofe", renga_id, ["bia"], 1)]
    assert ("curtida", renga_id, ["ana"], 1) in _avisos(client, eu, "bia")
