"""As dicas do livro já vistas: na conta, por pessoa, e o "rever as dicas"."""


def test_sem_nada_visto_vem_vazio(client, como):
    r = client.get("/dicas", headers=como("ana"))
    assert (r.status_code, r.json()) == (200, {"vistas": []})


def test_marcar_e_idempotente_e_so_da_propria_pessoa(client, como):
    assert client.put("/dicas/lombada", headers=como("ana")).json() == {"vistas": ["lombada"]}
    r = client.put("/dicas/virar_pagina", headers=como("ana"))
    # Na ordem das dicas, não na ordem em que foram vistas.
    assert (r.status_code, r.json()) == (200, {"vistas": ["virar_pagina", "lombada"]})
    assert client.put("/dicas/lombada", headers=como("ana")).json() == {"vistas": ["virar_pagina", "lombada"]}
    assert client.get("/dicas", headers=como("ana")).json() == {"vistas": ["virar_pagina", "lombada"]}
    assert client.get("/dicas", headers=como("bia")).json() == {"vistas": []}


def test_rever_as_dicas_zera_so_as_minhas(client, como):
    client.put("/dicas/acoes", headers=como("ana"))
    client.put("/dicas/escrever", headers=como("bia"))
    r = client.delete("/dicas", headers=como("ana"))
    assert (r.status_code, r.json()) == (200, {"vistas": []})
    assert client.get("/dicas", headers=como("ana")).json() == {"vistas": []}
    assert client.get("/dicas", headers=como("bia")).json() == {"vistas": ["escrever"]}


def test_dica_desconhecida_da_422(client, como):
    r = client.put("/dicas/tour_inteiro", headers=como("ana"))
    assert r.status_code == 422


def test_dicas_exigem_login(client):
    assert client.get("/dicas").status_code == 401
    assert client.put("/dicas/acoes").status_code == 401
    assert client.delete("/dicas").status_code == 401
