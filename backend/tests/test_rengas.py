"""Renga: o poema colaborativo, uma estrofe por vez, ninguém escreve duas seguidas."""

import pytest
from sqlalchemy.exc import IntegrityError

ESTROFE = "na varanda do CCHLA\n    a chuva escreve primeiro\n\n— e a gente copia"


def _renga(client, criador: dict, **extra) -> dict:
    corpo = {"titulo": "Renga da chuva", "primeira_estrofe": ESTROFE, **extra}
    r = client.post("/rengas", json=corpo, headers=criador)
    assert r.status_code == 201, r.text
    return r.json()


def _estrofe(client, autor: dict, renga_id: int, texto: str = "outra estrofe\n  recuada"):
    return client.post(f"/rengas/{renga_id}/estrofes", json={"texto": texto}, headers=autor)


def test_criar_abre_com_a_primeira_estrofe_intacta(client, como):
    renga = _renga(client, como("ana"))

    assert renga["titulo"] == "Renga da chuva"
    assert (renga["modo"], renga["limite"], renga["fechada"]) == ("aberta", 12, False)
    assert renga["qtd_estrofes"] == 1
    assert renga["estrofes"][0]["texto"] == ESTROFE
    assert renga["estrofes"][0]["autor"]["username"] == "ana"
    assert [a["username"] for a in renga["autores"]] == ["ana"]
    # A criadora acabou de escrever: a vez não é dela.
    assert renga["posso_escrever"] is False
    assert "vez" in renga["motivo"]


def test_criar_valida_titulo_estrofe_e_limite(client, como):
    ana = como("ana")
    base = {"titulo": "x", "primeira_estrofe": "y"}
    assert client.post("/rengas", json={**base, "titulo": "  "}, headers=ana).status_code == 422
    assert client.post("/rengas", json={**base, "primeira_estrofe": "\n  \n"}, headers=ana).status_code == 422
    assert client.post("/rengas", json={**base, "limite": 2}, headers=ana).status_code == 422
    assert client.post("/rengas", json={**base, "limite": 41}, headers=ana).status_code == 422
    assert client.post("/rengas", json={**base, "modo": "secreta"}, headers=ana).status_code == 422
    assert (
        client.post("/rengas", json={**base, "convidados": ["bia"]}, headers=ana).status_code
        == 422
    )


def test_rotas_exigem_login(client):
    assert client.get("/rengas").status_code == 401
    assert client.post("/rengas", json={}).status_code == 401
    assert client.get("/rengas/1").status_code == 401


def test_renga_que_nao_existe_da_404(client, como):
    assert client.get("/rengas/999", headers=como("ana")).status_code == 404
    assert _estrofe(client, como("ana"), 999).status_code == 404


def test_acrescentar_guarda_ordem_autor_e_texto(client, como):
    renga = _renga(client, como("ana"))
    texto = "  o 1500 passa\n\n    e leva o verso"

    r = _estrofe(client, como("bia"), renga["id"], texto)

    assert r.status_code == 201
    corpo = r.json()
    assert [e["posicao"] for e in corpo["estrofes"]] == [1, 2]
    assert corpo["estrofes"][1]["texto"] == texto
    assert corpo["estrofes"][1]["autor"]["username"] == "bia"
    assert [a["username"] for a in corpo["autores"]] == ["ana", "bia"]


def test_estrofe_em_branco_da_422(client, como):
    renga = _renga(client, como("ana"))
    assert _estrofe(client, como("bia"), renga["id"], "  \n\t\n").status_code == 422


def test_ninguem_escreve_duas_seguidas(client, como):
    renga = _renga(client, como("ana"))

    r = _estrofe(client, como("ana"), renga["id"])
    assert r.status_code == 409
    assert "vez" in r.json()["detail"]

    assert _estrofe(client, como("bia"), renga["id"]).status_code == 201
    assert _estrofe(client, como("bia"), renga["id"]).status_code == 409
    # Depois de outra pessoa, a ana volta a poder.
    assert _estrofe(client, como("ana"), renga["id"]).status_code == 201


def test_modo_convidados_barra_quem_nao_foi_convidado(client, como):
    renga = _renga(client, como("ana"), modo="convidados", convidados=["bia"])
    assert [u["username"] for u in renga["convidados"]] == ["bia"]

    r = _estrofe(client, como("caio"), renga["id"])
    assert r.status_code == 403
    assert r.json()["detail"] == "só os convidados escrevem nesta renga"
    detalhe = client.get(f"/rengas/{renga['id']}", headers=como("caio")).json()
    assert (detalhe["posso_escrever"], detalhe["motivo"]) == (
        False,
        "só os convidados escrevem nesta renga",
    )

    assert _estrofe(client, como("bia"), renga["id"]).status_code == 201
    # A criadora participa mesmo sem estar na lista.
    assert _estrofe(client, como("ana"), renga["id"]).status_code == 201


def test_convidar_depois_da_criacao(client, como):
    renga = _renga(client, como("ana"), modo="convidados")

    assert (
        client.post(
            f"/rengas/{renga['id']}/convites", json={"usernames": ["caio"]}, headers=como("bia")
        ).status_code
        == 403
    )
    r = client.post(
        f"/rengas/{renga['id']}/convites",
        json={"usernames": ["caio", "caio", "ana"]},
        headers=como("ana"),
    )
    assert r.status_code == 200
    assert [u["username"] for u in r.json()["convidados"]] == ["caio"]
    assert _estrofe(client, como("caio"), renga["id"]).status_code == 201


def test_convidar_em_renga_aberta_da_409(client, como):
    renga = _renga(client, como("ana"))
    r = client.post(
        f"/rengas/{renga['id']}/convites", json={"usernames": ["bia"]}, headers=como("ana")
    )
    assert r.status_code == 409


def test_convidado_inexistente_ou_consagrado_da_422(client, como):
    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        db.add(User(username="augusto", name="Augusto dos Anjos", consagrado=True))
        db.commit()

    ana = como("ana")
    base = {"titulo": "x", "primeira_estrofe": "y", "modo": "convidados"}
    r = client.post("/rengas", json={**base, "convidados": ["ninguem"]}, headers=ana)
    assert r.status_code == 422
    r = client.post("/rengas", json={**base, "convidados": ["augusto"]}, headers=ana)
    assert (r.status_code, "consagrados" in r.json()["detail"]) == (422, True)


def test_limite_fecha_a_renga(client, como):
    renga = _renga(client, como("ana"), limite=3)

    assert _estrofe(client, como("bia"), renga["id"]).status_code == 201
    r = _estrofe(client, como("caio"), renga["id"])
    assert r.status_code == 201
    corpo = r.json()
    assert (corpo["fechada"], corpo["qtd_estrofes"]) == (True, 3)
    assert [a["username"] for a in corpo["autores"]] == ["ana", "bia", "caio"]

    r = _estrofe(client, como("ana"), renga["id"])
    assert r.status_code == 409
    assert "fechada" in r.json()["detail"]


def test_so_a_criadora_encerra(client, como):
    renga = _renga(client, como("ana"))
    _estrofe(client, como("bia"), renga["id"])

    r = client.post(f"/rengas/{renga['id']}/encerrar", headers=como("bia"))
    assert r.status_code == 403

    r = client.post(f"/rengas/{renga['id']}/encerrar", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["fechada"] is True
    # Idempotente.
    assert client.post(f"/rengas/{renga['id']}/encerrar", headers=como("ana")).status_code == 200


def test_renga_encerrada_recusa_estrofe(client, como):
    renga = _renga(client, como("ana"))
    client.post(f"/rengas/{renga['id']}/encerrar", headers=como("ana"))

    r = _estrofe(client, como("bia"), renga["id"])
    assert r.status_code == 409
    detalhe = client.get(f"/rengas/{renga['id']}", headers=como("bia")).json()
    assert detalhe["posso_escrever"] is False
    assert "fechada" in detalhe["motivo"]


def test_acrescimos_seguidos_nao_estouram_o_limite(client, como):
    """O caso sequencial da corrida: muitas tentativas e o total para no limite."""
    renga = _renga(client, como("ana"), limite=4)
    pessoas = ["bia", "caio", "ana", "bia", "caio", "ana"]
    codigos = [_estrofe(client, como(p), renga["id"]).status_code for p in pessoas]

    assert codigos == [201, 201, 201, 409, 409, 409]
    detalhe = client.get(f"/rengas/{renga['id']}", headers=como("ana")).json()
    assert [e["posicao"] for e in detalhe["estrofes"]] == [1, 2, 3, 4]


def test_posicao_e_unica_por_renga(client, como):
    """A trava da corrida no banco: duas estrofes na mesma posição não gravam."""
    from app.db import SessionLocal
    from app.models.renga import EstrofeRenga

    renga = _renga(client, como("ana"))
    with SessionLocal() as db:
        db.add(EstrofeRenga(renga_id=renga["id"], autor_id=renga["criador"]["id"], posicao=1, texto="x"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_listar_pagina_e_filtra(client, como):
    aberta = _renga(client, como("ana"))
    fechada = _renga(client, como("bia"), titulo="Renga do RU")
    client.post(f"/rengas/{fechada['id']}/encerrar", headers=como("bia"))

    r = client.get("/rengas", headers=como("caio"))
    assert r.status_code == 200
    corpo = r.json()
    assert set(corpo) == {"items", "total", "offset", "limit"}
    assert corpo["total"] == 2
    assert [i["id"] for i in corpo["items"]] == [fechada["id"], aberta["id"]]

    so_abertas = client.get("/rengas?situacao=aberta", headers=como("caio")).json()
    assert [i["id"] for i in so_abertas["items"]] == [aberta["id"]]
    so_fechadas = client.get("/rengas?situacao=fechada", headers=como("caio")).json()
    assert [i["id"] for i in so_fechadas["items"]] == [fechada["id"]]
    assert so_fechadas["items"][0]["autores"][0]["username"] == "bia"
    assert client.get("/rengas?situacao=outra", headers=como("caio")).status_code == 422


def test_minhas_sao_as_que_criei_escrevi_ou_fui_convidado(client, como):
    criei = _renga(client, como("ana"), titulo="Criei")
    escrevi = _renga(client, como("bia"), titulo="Escrevi")
    assert _estrofe(client, como("ana"), escrevi["id"]).status_code == 201
    convidada = _renga(client, como("bia"), titulo="Convite", modo="convidados", convidados=["ana"])
    alheia = _renga(client, como("caio"), titulo="Alheia")

    def ids(url):
        return [i["id"] for i in client.get(url, headers=como("ana")).json()["items"]]

    assert ids("/rengas?minhas=true") == [convidada["id"], escrevi["id"], criei["id"]]
    assert alheia["id"] in ids("/rengas")
    client.post(f"/rengas/{criei['id']}/encerrar", headers=como("ana"))
    assert ids("/rengas?minhas=true&situacao=fechada") == [criei["id"]]
    assert client.get("/rengas?minhas=true", headers=como("caio")).json()["total"] == 1


def test_seed_tem_renga_aberta_fechada_e_de_convidados(client):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.renga import ConviteRenga, Renga
    from scripts import seed

    with SessionLocal() as db:
        assert seed.seed_fake(db)
        rengas = list(db.scalars(select(Renga)))
        assert any(r.fechada_em is None and r.modo == "aberta" for r in rengas)
        assert any(r.fechada_em is not None for r in rengas)
        assert any(r.modo == "convidados" for r in rengas)
        assert db.scalar(select(ConviteRenga.id).limit(1)) is not None
