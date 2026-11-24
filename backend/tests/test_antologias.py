"""Antologias: coleções curadas de poemas, como "Poemas de chuva"."""

import pytest
from sqlalchemy import select


@pytest.fixture()
def ana(logar):
    return logar("ana", "Ana")


@pytest.fixture()
def bia(logar):
    return logar("bia", "Bia")


def _poema(client, autor: dict, texto: str = "chove\n\nna rua") -> int:
    r = client.post("/posts", json={"texto": texto}, headers=autor)
    assert r.status_code == 201
    return r.json()["id"]


def _antologia(client, dono: dict, nome: str = "Poemas de chuva") -> int:
    r = client.post("/antologias", json={"nome": nome}, headers=dono)
    assert r.status_code == 201
    return r.json()["id"]


def test_criar_antologia_comeca_vazia(client, ana):
    r = client.post(
        "/antologias",
        json={"nome": "Poemas de chuva", "descricao": "para dias cinzas"},
        headers=ana,
    )

    assert r.status_code == 201
    corpo = r.json()
    assert corpo["nome"] == "Poemas de chuva"
    assert corpo["descricao"] == "para dias cinzas"
    assert corpo["qtd"] == 0
    assert corpo["dono"]["username"] == "ana"


def test_descricao_e_opcional(client, ana):
    r = client.post("/antologias", json={"nome": "Sem descrição"}, headers=ana)
    assert (r.status_code, r.json()["descricao"]) == (201, None)


def test_nome_em_branco_da_422(client, ana):
    assert client.post("/antologias", json={"nome": "   "}, headers=ana).status_code == 422
    assert client.post("/antologias", json={}, headers=ana).status_code == 422


def test_rotas_exigem_login(client):
    assert client.post("/antologias", json={"nome": "x"}).status_code == 401
    assert client.get("/antologias").status_code == 401
    assert client.get("/antologias/1").status_code == 401


def test_minhas_antologias_so_do_usuario_atual(client, ana, bia):
    _antologia(client, ana, "Chuva")
    _antologia(client, ana, "Mar")
    _antologia(client, bia, "Da Bia")

    r = client.get("/antologias", headers=ana)

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["total"] == 2
    assert {item["nome"] for item in corpo["items"]} == {"Chuva", "Mar"}
    assert set(corpo) == {"items", "total", "offset", "limit"}


def test_antologias_de_outro_usuario(client, ana, bia):
    antologia_id = _antologia(client, bia, "Da Bia")
    client.post(
        f"/antologias/{antologia_id}/poemas",
        json={"post_id": _poema(client, bia)},
        headers=bia,
    )

    r = client.get("/usuarios/bia/antologias", headers=ana)

    assert r.status_code == 200
    assert [(i["nome"], i["qtd"]) for i in r.json()["items"]] == [("Da Bia", 1)]


def test_antologias_de_usuario_inexistente_da_404(client, ana):
    assert client.get("/usuarios/ninguem/antologias", headers=ana).status_code == 404


def test_detalhe_traz_poemas_na_ordem_de_insercao(client, ana, bia):
    antologia_id = _antologia(client, ana)
    primeiro = _poema(client, bia, "primeiro")
    segundo = _poema(client, ana, "segundo")
    terceiro = _poema(client, bia, "terceiro")
    for post_id in (segundo, terceiro, primeiro):
        r = client.post(
            f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana
        )
        assert r.status_code == 204

    r = client.get(f"/antologias/{antologia_id}", headers=ana)

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["qtd"] == 3
    assert [p["id"] for p in corpo["poemas"]] == [segundo, terceiro, primeiro]
    assert corpo["poemas"][0]["autor"]["username"] == "ana"


def test_detalhe_usa_post_out_com_curtidas_do_leitor(client, ana, bia):
    antologia_id = _antologia(client, ana)
    post_id = _poema(client, bia, "verso\n  com recuo\n")
    client.post(f"/posts/{post_id}/curtir", headers=bia)
    client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)

    poema = client.get(f"/antologias/{antologia_id}", headers=bia).json()["poemas"][0]

    assert poema["texto"] == "verso\n  com recuo\n"
    assert (poema["curtidas"], poema["curti"]) == (1, True)


def test_leitura_publica_para_outro_usuario(client, ana, bia):
    antologia_id = _antologia(client, ana)
    client.post(
        f"/antologias/{antologia_id}/poemas",
        json={"post_id": _poema(client, ana)},
        headers=ana,
    )

    r = client.get(f"/antologias/{antologia_id}", headers=bia)

    assert (r.status_code, r.json()["qtd"]) == (200, 1)


def test_poema_repetido_nao_duplica(client, ana):
    antologia_id = _antologia(client, ana)
    post_id = _poema(client, ana)

    for _ in range(2):
        r = client.post(
            f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana
        )
        assert r.status_code == 204

    r = client.get(f"/antologias/{antologia_id}", headers=ana)
    assert [p["id"] for p in r.json()["poemas"]] == [post_id]
    assert client.get("/antologias", headers=ana).json()["items"][0]["qtd"] == 1


def test_remover_poema(client, ana):
    antologia_id = _antologia(client, ana)
    fica = _poema(client, ana, "fica")
    sai = _poema(client, ana, "sai")
    for post_id in (fica, sai):
        client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)

    r = client.delete(f"/antologias/{antologia_id}/poemas/{sai}", headers=ana)
    assert r.status_code == 204
    r = client.delete(f"/antologias/{antologia_id}/poemas/{sai}", headers=ana)
    assert r.status_code == 204

    r = client.get(f"/antologias/{antologia_id}", headers=ana)
    assert [p["id"] for p in r.json()["poemas"]] == [fica]


def test_poema_readicionado_vai_para_o_fim(client, ana):
    antologia_id = _antologia(client, ana)
    a, b = _poema(client, ana, "a"), _poema(client, ana, "b")
    for post_id in (a, b):
        client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)
    client.delete(f"/antologias/{antologia_id}/poemas/{a}", headers=ana)
    client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": a}, headers=ana)

    r = client.get(f"/antologias/{antologia_id}", headers=ana)
    assert [p["id"] for p in r.json()["poemas"]] == [b, a]


def test_escrita_de_outro_usuario_da_403(client, ana, bia):
    antologia_id = _antologia(client, ana)
    post_id = _poema(client, ana)
    client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)

    r = client.post(
        f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=bia
    )
    assert r.status_code == 403
    r = client.delete(f"/antologias/{antologia_id}/poemas/{post_id}", headers=bia)
    assert r.status_code == 403

    assert client.get(f"/antologias/{antologia_id}", headers=ana).json()["qtd"] == 1


def test_antologia_inexistente_da_404(client, ana):
    post_id = _poema(client, ana)

    assert client.get("/antologias/999", headers=ana).status_code == 404
    r = client.post("/antologias/999/poemas", json={"post_id": post_id}, headers=ana)
    assert r.status_code == 404
    assert client.delete(f"/antologias/999/poemas/{post_id}", headers=ana).status_code == 404


def test_adicionar_poema_inexistente_da_404(client, ana):
    antologia_id = _antologia(client, ana)

    r = client.post("/antologias/999/poemas", json={"post_id": 999}, headers=ana)
    assert r.status_code == 404
    r = client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": 999}, headers=ana)
    assert r.status_code == 404


def test_apagar_poema_tira_das_antologias(client, ana, bia):
    from app.db import SessionLocal
    from app.models.antologia import AntologiaPoema

    da_ana = _antologia(client, ana)
    da_bia = _antologia(client, bia)
    post_id = _poema(client, bia)
    client.post(f"/antologias/{da_ana}/poemas", json={"post_id": post_id}, headers=ana)
    client.post(f"/antologias/{da_bia}/poemas", json={"post_id": post_id}, headers=bia)

    assert client.delete(f"/posts/{post_id}", headers=bia).status_code == 204

    assert client.get(f"/antologias/{da_ana}", headers=ana).json()["poemas"] == []
    with SessionLocal() as db:
        restantes = db.scalars(select(AntologiaPoema).where(AntologiaPoema.post_id == post_id))
        assert restantes.all() == []


def _privada(client, dono: dict, nome: str = "Diário") -> int:
    r = client.post("/antologias", json={"nome": nome, "publica": False}, headers=dono)
    assert (r.status_code, r.json()["publica"]) == (201, False)
    return r.json()["id"]


def test_antologia_nasce_publica(client, ana):
    r = client.post("/antologias", json={"nome": "Chuva"}, headers=ana)
    assert r.json()["publica"] is True


def test_privada_aparece_so_para_o_dono(client, ana, bia):
    _antologia(client, ana, "Pública")
    _privada(client, ana, "Privada")

    minhas = client.get("/antologias", headers=ana).json()
    assert {i["nome"] for i in minhas["items"]} == {"Pública", "Privada"}
    vistas_pelo_dono = client.get("/usuarios/ana/antologias", headers=ana).json()
    assert vistas_pelo_dono["total"] == 2

    vistas_por_outro = client.get("/usuarios/ana/antologias", headers=bia).json()
    assert [i["nome"] for i in vistas_por_outro["items"]] == ["Pública"]
    assert vistas_por_outro["total"] == 1


def test_privada_de_outro_da_404_em_tudo(client, ana, bia):
    antologia_id = _privada(client, ana)
    post_id = _poema(client, ana)
    client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)

    assert client.get(f"/antologias/{antologia_id}", headers=ana).status_code == 200
    assert client.get(f"/antologias/{antologia_id}", headers=bia).status_code == 404
    r = client.post(
        f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=bia
    )
    assert r.status_code == 404
    r = client.delete(f"/antologias/{antologia_id}/poemas/{post_id}", headers=bia)
    assert r.status_code == 404
    r = client.patch(f"/antologias/{antologia_id}", json={"nome": "x"}, headers=bia)
    assert r.status_code == 404
    assert client.delete(f"/antologias/{antologia_id}", headers=bia).status_code == 404
    assert client.get(f"/antologias/{antologia_id}", headers=ana).json()["qtd"] == 1


def test_patch_parcial_renomeia_e_mantem_o_resto(client, ana):
    r = client.post("/antologias", json={"nome": "Chuva", "descricao": "cinza"}, headers=ana)
    antologia_id = r.json()["id"]
    client.post(
        f"/antologias/{antologia_id}/poemas",
        json={"post_id": _poema(client, ana)},
        headers=ana,
    )

    r = client.patch(f"/antologias/{antologia_id}", json={"nome": "Garoa"}, headers=ana)

    assert r.status_code == 200
    corpo = r.json()
    assert (corpo["nome"], corpo["descricao"], corpo["publica"], corpo["qtd"]) == (
        "Garoa",
        "cinza",
        True,
        1,
    )
    r = client.patch(f"/antologias/{antologia_id}", json={"descricao": None}, headers=ana)
    assert r.json()["descricao"] is None
    assert client.get(f"/antologias/{antologia_id}", headers=ana).json()["nome"] == "Garoa"


def test_patch_torna_privada_e_publica_de_novo(client, ana, bia):
    antologia_id = _antologia(client, ana)

    r = client.patch(f"/antologias/{antologia_id}", json={"publica": False}, headers=ana)
    assert (r.status_code, r.json()["publica"]) == (200, False)
    assert client.get(f"/antologias/{antologia_id}", headers=bia).status_code == 404

    client.patch(f"/antologias/{antologia_id}", json={"publica": True}, headers=ana)
    assert client.get(f"/antologias/{antologia_id}", headers=bia).status_code == 200


@pytest.mark.parametrize(
    "corpo", [{"nome": "  "}, {"nome": None}, {"publica": None}, {"nome": "x" * 101}]
)
def test_patch_invalido_da_422(client, ana, corpo):
    antologia_id = _antologia(client, ana)
    r = client.patch(f"/antologias/{antologia_id}", json=corpo, headers=ana)
    assert r.status_code == 422


def test_patch_e_delete_de_outro_em_publica_da_403(client, ana, bia):
    antologia_id = _antologia(client, ana)

    r = client.patch(f"/antologias/{antologia_id}", json={"nome": "minha"}, headers=bia)
    assert r.status_code == 403
    assert client.delete(f"/antologias/{antologia_id}", headers=bia).status_code == 403
    r = client.get(f"/antologias/{antologia_id}", headers=ana)
    assert r.json()["nome"] == "Poemas de chuva"


def test_patch_e_delete_de_inexistente_da_404(client, ana):
    assert client.patch("/antologias/999", json={"nome": "x"}, headers=ana).status_code == 404
    assert client.delete("/antologias/999", headers=ana).status_code == 404


def test_apagar_antologia_leva_os_vinculos_e_mantem_os_poemas(client, ana):
    from app.db import SessionLocal
    from app.models.antologia import AntologiaPoema

    antologia_id = _antologia(client, ana)
    post_id = _poema(client, ana)
    client.post(f"/antologias/{antologia_id}/poemas", json={"post_id": post_id}, headers=ana)

    assert client.delete(f"/antologias/{antologia_id}", headers=ana).status_code == 204

    assert client.get(f"/antologias/{antologia_id}", headers=ana).status_code == 404
    assert client.get("/antologias", headers=ana).json()["total"] == 0
    assert client.get(f"/posts/{post_id}", headers=ana).status_code == 200
    with SessionLocal() as db:
        vinculos = db.scalars(
            select(AntologiaPoema).where(AntologiaPoema.antologia_id == antologia_id)
        )
        assert vinculos.all() == []
