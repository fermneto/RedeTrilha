"""Comentários e crítica ancorada no verso nas rengas, abertas ou fechadas
(services/comentarios_renga.py), sem depender da auth (fixture `como`).

Os versos contam as linhas do texto da renga: as estrofes em ordem, separadas
por uma linha em branco, que conta como verso (como nos poemas).
"""

from app.services.rengas import texto_de

# Versos 1 a 3 (com o 2 recuado); o 4 é a linha em branco; a 2ª estrofe é o 5 e o 6.
PRIMEIRA = "na varanda do CCHLA\n    a chuva escreve primeiro\n— e a gente copia"
SEGUNDA = "o caderno molhado\naprende a ler"
TERCEIRA = "e a tinta corre"


def _renga(client, como, criador: str = "bia", **extra) -> int:
    corpo = {"titulo": "Renga da chuva", "primeira_estrofe": PRIMEIRA, "limite": 3, **extra}
    r = client.post("/rengas", json=corpo, headers=como(criador))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _estrofe(client, como, renga_id: int, autor: str, texto: str) -> None:
    r = client.post(f"/rengas/{renga_id}/estrofes", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201, r.text


def _comentar(client, como, renga_id, texto, autor="ana", parent_id=None, versos=None):
    corpo = {"texto": texto, "parent_id": parent_id}
    if versos is not None:
        corpo["ancora"] = {"verso_inicio": versos[0], "verso_fim": versos[1]}
    return client.post(f"/rengas/{renga_id}/comentarios", json=corpo, headers=como(autor))


def test_texto_da_renga_junta_as_estrofes_com_uma_linha_em_branco():
    assert texto_de([PRIMEIRA, SEGUNDA]).split("\n") == [
        "na varanda do CCHLA",
        "    a chuva escreve primeiro",
        "— e a gente copia",
        "",
        "o caderno molhado",
        "aprende a ler",
    ]


def test_arvore_de_comentarios_na_renga_aberta(client, como):
    renga_id = _renga(client, como)
    r = _comentar(client, como, renga_id, "que começo")
    assert r.status_code == 201, r.text
    raiz = r.json()
    assert (raiz["renga_id"], raiz["parent_id"], raiz["ancora"], raiz["autor"]["username"]) == (
        renga_id,
        None,
        None,
        "ana",
    )
    resposta = _comentar(client, como, renga_id, "concordo", "caio", raiz["id"]).json()
    _comentar(client, como, renga_id, "eu também", "bia", resposta["id"])

    pagina = client.get(f"/rengas/{renga_id}/comentarios", headers=como("caio")).json()
    assert pagina["total"] == 1
    [item] = pagina["items"]
    assert item["total_respostas"] == 1
    assert item["respostas"][0]["texto"] == "concordo"
    assert item["respostas"][0]["respostas"][0]["texto"] == "eu também"

    respostas = client.get(
        f"/rengas/{renga_id}/comentarios/{raiz['id']}/respostas", headers=como("ana")
    ).json()
    assert [c["texto"] for c in respostas["items"]] == ["concordo"]
    # A contagem do card conta respostas, como a dos poemas.
    assert client.get(f"/rengas/{renga_id}", headers=como("ana")).json()["comentarios"] == 3


def test_critica_ancorada_conta_as_estrofes_juntas_com_a_linha_em_branco(client, como):
    renga_id = _renga(client, como)
    _estrofe(client, como, renga_id, "caio", SEGUNDA)

    r = _comentar(client, como, renga_id, "a virada", versos=(3, 5))
    assert r.status_code == 201, r.text
    assert r.json()["ancora"] == {
        "verso_inicio": 3,
        "verso_fim": 5,
        "trecho": "— e a gente copia\n\no caderno molhado",
    }
    _comentar(client, como, renga_id, "o recuo", "caio", versos=(2, 2))

    versos = client.get(f"/rengas/{renga_id}/comentarios/versos", headers=como("ana")).json()
    assert versos["items"] == [
        {"verso": 2, "comentarios": 1},
        {"verso": 3, "comentarios": 1},
        {"verso": 4, "comentarios": 1},
        {"verso": 5, "comentarios": 1},
    ]
    so_5 = client.get(f"/rengas/{renga_id}/comentarios?verso=5", headers=como("ana")).json()
    assert [c["texto"] for c in so_5["items"]] == ["a virada"]
    assert so_5["items"][0]["ancora"]["trecho"].endswith("o caderno molhado")


def test_a_renga_cresce_e_os_numeros_dos_versos_comentados_nao_mudam(client, como):
    renga_id = _renga(client, como)
    antes = _comentar(client, como, renga_id, "o recuo", versos=(2, 2)).json()["ancora"]
    # Verso 5 ainda não existe na renga de uma estrofe.
    assert _comentar(client, como, renga_id, "cedo", versos=(5, 5)).status_code == 422

    _estrofe(client, como, renga_id, "caio", SEGUNDA)
    _estrofe(client, como, renga_id, "ana", TERCEIRA)

    renga = client.get(f"/rengas/{renga_id}", headers=como("ana")).json()
    assert renga["fechada"] is True
    [depois] = client.get(f"/rengas/{renga_id}/comentarios", headers=como("ana")).json()["items"]
    assert depois["ancora"] == antes == {
        "verso_inicio": 2,
        "verso_fim": 2,
        "trecho": "    a chuva escreve primeiro",
    }
    # Na renga fechada também se comenta, e a 3ª estrofe é o verso 8.
    r = _comentar(client, como, renga_id, "o fecho", "caio", versos=(8, 8))
    assert r.status_code == 201, r.text
    assert r.json()["ancora"]["trecho"] == TERCEIRA


def test_ancora_invalida_da_422(client, como):
    renga_id = _renga(client, como)
    _estrofe(client, como, renga_id, "caio", SEGUNDA)
    raiz = _comentar(client, como, renga_id, "raiz").json()

    assert _comentar(client, como, renga_id, "x", versos=(3, 2)).status_code == 422
    assert _comentar(client, como, renga_id, "x", versos=(0, 1)).status_code == 422
    assert _comentar(client, como, renga_id, "x", versos=(6, 7)).status_code == 422
    # Só a linha em branco entre as estrofes.
    assert _comentar(client, como, renga_id, "x", versos=(4, 4)).status_code == 422
    # Resposta herda o trecho do pai.
    assert (
        _comentar(client, como, renga_id, "x", parent_id=raiz["id"], versos=(1, 1)).status_code
        == 422
    )
    assert _comentar(client, como, renga_id, "  \n ").status_code == 422


def test_pai_de_outra_renga_ou_inexistente_da_404(client, como):
    renga_id = _renga(client, como)
    outra = _renga(client, como, "caio")
    alheio = _comentar(client, como, outra, "lá").json()

    assert _comentar(client, como, renga_id, "aqui", parent_id=alheio["id"]).status_code == 404
    assert _comentar(client, como, renga_id, "aqui", parent_id=999).status_code == 404
    assert _comentar(client, como, 999, "aqui").status_code == 404
    assert (
        client.get(
            f"/rengas/{renga_id}/comentarios/{alheio['id']}/respostas", headers=como("ana")
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/rengas/{renga_id}/comentarios/{alheio['id']}", headers=como("ana")).status_code
        == 404
    )


def test_so_o_autor_apaga_e_com_respostas_vira_marcador(client, como):
    renga_id = _renga(client, como)
    sozinho = _comentar(client, como, renga_id, "sozinho", versos=(1, 1)).json()
    com_resposta = _comentar(client, como, renga_id, "com resposta").json()
    _comentar(client, como, renga_id, "respondo", "caio", com_resposta["id"])

    rota = f"/rengas/{renga_id}/comentarios"
    # Nem a criadora da renga apaga o comentário dos outros, como o autor do poema.
    assert client.delete(f"{rota}/{sozinho['id']}", headers=como("bia")).status_code == 403
    r = client.delete(f"{rota}/{sozinho['id']}", headers=como("ana"))
    assert r.json() == {"resultado": "apagado", "total_respostas": 0}
    assert client.get(f"{rota}/versos", headers=como("ana")).json()["items"] == []

    r = client.delete(f"{rota}/{com_resposta['id']}", headers=como("ana"))
    assert r.json() == {"resultado": "removido", "total_respostas": 1}
    [marcador] = client.get(rota, headers=como("bia")).json()["items"]
    assert (marcador["removido"], marcador["texto"], marcador["autor"]) == (True, "", None)
    assert [c["texto"] for c in marcador["respostas"]] == ["respondo"]
    # Marcador não recebe resposta nova.
    assert _comentar(client, como, renga_id, "tarde", parent_id=com_resposta["id"]).status_code == 404


def test_renga_de_convidados_recebe_comentario_de_quem_nao_escreve(client, como):
    renga_id = _renga(client, como, modo="convidados", convidados=["caio"])
    assert _comentar(client, como, renga_id, "leio daqui", "ana").status_code == 201


def test_bloqueio_com_a_criadora(client, como):
    renga_id = _renga(client, como)
    escondido = _comentar(client, como, renga_id, "do caio", "caio").json()
    _comentar(client, como, renga_id, "da ana", "ana")
    assert client.post("/usuarios/caio/bloqueio", headers=como("bia")).status_code == 204

    rota = f"/rengas/{renga_id}/comentarios"
    for caminho in [rota, f"{rota}/versos", f"{rota}/{escondido['id']}/respostas"]:
        assert client.get(caminho, headers=como("caio")).status_code == 404, caminho
    assert _comentar(client, como, renga_id, "de novo", "caio").status_code == 404
    pagina = client.get(rota, headers=como("ana")).json()
    assert [c["texto"] for c in pagina["items"]] == ["da ana"]


def test_rotas_exigem_login(client):
    assert client.get("/rengas/1/comentarios").status_code == 401
    assert client.post("/rengas/1/comentarios", json={"texto": "x"}).status_code == 401
    assert client.delete("/rengas/1/comentarios/1").status_code == 401


def test_contagem_de_comentarios_na_lista_e_no_feed(client, como):
    renga_id = _renga(client, como)
    _comentar(client, como, renga_id, "um")
    _comentar(client, como, renga_id, "dois", "caio")
    [item] = client.get("/rengas", headers=como("ana")).json()["items"]
    assert item["comentarios"] == 2
    client.post("/usuarios/bia/follow", headers=como("ana"))
    rengas = [i for i in client.get("/feed", headers=como("ana")).json()["items"] if i.get("tipo") == "renga"]
    assert rengas[0]["renga"]["comentarios"] == 2
