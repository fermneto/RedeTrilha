"""Mensagens diretas: caixa e pedidos, bloqueio, silenciar, não lidas, visto,
poema compartilhado, limites e privacidade. O tempo real está em
tests/test_mensagens_stream.py."""

import pytest

from app.core.caixa_de_entrada import avancar_leitura, situacao_de_quem_recebe
from app.core.limites import MENSAGEM_MAX_CARACTERES


def abrir(client, como, quem: str, com: str) -> dict:
    r = client.post("/mensagens/conversas", json={"username": com}, headers=como(quem))
    assert r.status_code == 200, r.text
    return r.json()


def enviar(client, como, quem: str, conversa_id: int, texto: str = "oi", **extra) -> dict:
    r = client.post(
        f"/mensagens/conversas/{conversa_id}/mensagens", json={"texto": texto, **extra}, headers=como(quem)
    )
    assert r.status_code == 201, r.text
    return r.json()


def caixa(client, como, quem: str, aba: str = "conversas") -> list[dict]:
    r = client.get(f"/mensagens/conversas?aba={aba}", headers=como(quem))
    assert r.status_code == 200, r.text
    return r.json()["items"]


def resumo(client, como, quem: str) -> dict:
    return client.get("/mensagens/resumo", headers=como(quem)).json()


# ---------- core ----------


def test_core_situacao_e_leitura():
    assert situacao_de_quem_recebe(True) == "caixa"
    assert situacao_de_quem_recebe(False) == "pedido"
    assert avancar_leitura(0, None, 9) == 9
    assert avancar_leitura(5, 3, 9) == 5  # nunca para trás
    assert avancar_leitura(5, 50, 9) == 9  # nunca além da última
    assert avancar_leitura(0, None, None) == 0


# ---------- caixa e pedidos ----------


def test_de_quem_voce_segue_cai_na_caixa(client, como):
    client.post("/usuarios/ana/follow", headers=como("bia"))
    conversa = abrir(client, como, "ana", "bia")
    enviar(client, como, "ana", conversa["id"], "bom dia")

    itens = caixa(client, como, "bia")
    assert [i["outro"]["username"] for i in itens] == ["ana"]
    assert itens[0]["ultima_mensagem"]["texto"] == "bom dia"
    assert itens[0]["nao_lidas"] == 1
    assert caixa(client, como, "bia", "pedidos") == []


def test_de_quem_voce_nao_segue_vira_pedido_e_aceitar_leva_para_a_caixa(client, como):
    conversa = abrir(client, como, "ana", "bia")
    enviar(client, como, "ana", conversa["id"])

    assert caixa(client, como, "bia") == []
    assert [i["id"] for i in caixa(client, como, "bia", "pedidos")] == [conversa["id"]]
    assert resumo(client, como, "bia") == {"nao_lidas": 0, "pedidos": 1}
    # Quem mandou vê a conversa na própria caixa, como qualquer outra.
    assert [i["id"] for i in caixa(client, como, "ana")] == [conversa["id"]]

    assert client.post(f"/mensagens/conversas/{conversa['id']}/aceitar", headers=como("bia")).status_code == 204
    assert [i["id"] for i in caixa(client, como, "bia")] == [conversa["id"]]
    assert caixa(client, como, "bia", "pedidos") == []
    assert resumo(client, como, "bia") == {"nao_lidas": 1, "pedidos": 0}


def test_responder_um_pedido_o_aceita(client, como):
    conversa = abrir(client, como, "ana", "bia")
    enviar(client, como, "ana", conversa["id"])
    enviar(client, como, "bia", conversa["id"], "oi, ana")
    assert [i["id"] for i in caixa(client, como, "bia")] == [conversa["id"]]


def test_recusar_tira_o_pedido_da_lista_para_sempre(client, como):
    conversa = abrir(client, como, "ana", "bia")
    enviar(client, como, "ana", conversa["id"])
    assert client.post(f"/mensagens/conversas/{conversa['id']}/recusar", headers=como("bia")).status_code == 204

    enviar(client, como, "ana", conversa["id"], "ainda aí?")
    # Abrir de novo pelo lado de quem mandou também não reaparece para a bia.
    assert abrir(client, como, "ana", "bia")["id"] == conversa["id"]
    assert caixa(client, como, "bia") == caixa(client, como, "bia", "pedidos") == []
    assert resumo(client, como, "bia") == {"nao_lidas": 0, "pedidos": 0}
    # Quem mandou não é avisado: a conversa dela continua igual.
    assert abrir(client, como, "ana", "bia")["situacao"] == "caixa"
    assert len(caixa(client, como, "ana")) == 1


def test_so_um_pedido_se_recusa(client, como):
    conversa = abrir(client, como, "ana", "bia")
    r = client.post(f"/mensagens/conversas/{conversa['id']}/recusar", headers=como("ana"))
    assert r.status_code == 409


def test_abrir_de_novo_acha_a_mesma_conversa_dos_dois_lados(client, como):
    a = abrir(client, como, "ana", "bia")
    b = abrir(client, como, "bia", "ana")
    assert a["id"] == b["id"]
    assert a["outro"]["username"] == "bia" and b["outro"]["username"] == "ana"


def test_conversa_sem_mensagem_nao_aparece_na_caixa(client, como):
    abrir(client, como, "ana", "bia")
    assert caixa(client, como, "ana") == []


def test_caixa_pela_ultima_atividade_com_cursor(client, como):
    com_bia = abrir(client, como, "ana", "bia")["id"]
    com_caio = abrir(client, como, "ana", "caio")["id"]
    enviar(client, como, "ana", com_bia)
    enviar(client, como, "ana", com_caio)
    assert [i["id"] for i in caixa(client, como, "ana")] == [com_caio, com_bia]

    enviar(client, como, "bia", com_bia, "voltei")
    primeira = client.get("/mensagens/conversas?limit=1", headers=como("ana")).json()
    assert [i["id"] for i in primeira["items"]] == [com_bia]
    r = client.get(f"/mensagens/conversas?limit=1&cursor={primeira['proximo_cursor']}", headers=como("ana"))
    assert [i["id"] for i in r.json()["items"]] == [com_caio]
    assert r.json()["proximo_cursor"] is None
    assert client.get("/mensagens/conversas?cursor=abc", headers=como("ana")).status_code == 422


# ---------- quem pode ----------


def test_consagrado_nao_recebe_nem_manda(client, como, criar_usuario):
    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        db.add(User(username="bilac", name="Olavo Bilac", consagrado=True))
        db.commit()
    r = client.post("/mensagens/conversas", json={"username": "bilac"}, headers=como("ana"))
    assert r.status_code == 422
    assert "consagrados" in r.json()["detail"]
    r = client.post("/mensagens/conversas", json={"username": "ana"}, headers=como("bilac"))
    assert r.status_code == 403


def test_nao_manda_para_si_nem_para_quem_nao_existe(client, como):
    assert client.post("/mensagens/conversas", json={"username": "ana"}, headers=como("ana")).status_code == 422
    assert client.post("/mensagens/conversas", json={"username": "zz"}, headers=como("ana")).status_code == 404


def test_bloqueio(client, como):
    conversa = abrir(client, como, "ana", "bia")["id"]
    enviar(client, como, "ana", conversa)
    assert client.post("/usuarios/ana/bloqueio", headers=como("bia")).status_code == 204
    assert client.post("/usuarios/ana/bloqueio", headers=como("bia")).status_code == 204  # idempotente

    # Quem foi bloqueado não manda nem abre a conversa.
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"texto": "oi"}, headers=como("ana"))
    assert r.status_code == 403
    assert client.post("/mensagens/conversas", json={"username": "bia"}, headers=como("ana")).status_code == 403
    vista_pela_ana = client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()
    assert vista_pela_ana["pode_responder"] is False and vista_pela_ana["bloqueei"] is False

    # Quem bloqueou também não manda, até desbloquear.
    detalhe = client.get(f"/mensagens/conversas/{conversa}", headers=como("bia")).json()
    assert detalhe["bloqueei"] is True and detalhe["pode_responder"] is False
    assert "Desbloqueie" in detalhe["motivo"]
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"texto": "oi"}, headers=como("bia"))
    assert r.status_code == 403
    # O histórico continua.
    assert len(client.get(f"/mensagens/conversas/{conversa}/mensagens", headers=como("bia")).json()["items"]) == 1

    assert client.delete("/usuarios/ana/bloqueio", headers=como("bia")).status_code == 204
    enviar(client, como, "ana", conversa, "de volta")
    assert client.post("/usuarios/bia/bloqueio", headers=como("bia")).status_code == 422


def test_silenciar_nao_conta_nas_nao_lidas(client, como):
    client.post("/usuarios/ana/follow", headers=como("bia"))
    conversa = abrir(client, como, "ana", "bia")["id"]
    enviar(client, como, "ana", conversa)
    assert resumo(client, como, "bia")["nao_lidas"] == 1

    assert client.post(f"/mensagens/conversas/{conversa}/silenciar", headers=como("bia")).status_code == 204
    assert resumo(client, como, "bia")["nao_lidas"] == 0
    item = caixa(client, como, "bia")[0]
    assert item["silenciada"] is True and item["nao_lidas"] == 1

    assert client.delete(f"/mensagens/conversas/{conversa}/silenciar", headers=como("bia")).status_code == 204
    assert resumo(client, como, "bia")["nao_lidas"] == 1


# ---------- não lidas e visto ----------


def test_nao_lidas_e_visto(client, como):
    client.post("/usuarios/ana/follow", headers=como("bia"))
    conversa = abrir(client, como, "ana", "bia")["id"]
    primeira = enviar(client, como, "ana", conversa, "um")
    segunda = enviar(client, como, "ana", conversa, "dois")
    assert caixa(client, como, "bia")[0]["nao_lidas"] == 2
    assert client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()["visto_ate"] == 0

    lida = client.post(f"/mensagens/conversas/{conversa}/lida", json={"ate": primeira["id"]}, headers=como("bia"))
    assert lida.status_code == 204
    assert caixa(client, como, "bia")[0]["nao_lidas"] == 1
    assert client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()["visto_ate"] == primeira["id"]

    client.post(f"/mensagens/conversas/{conversa}/lida", json={}, headers=como("bia"))
    assert caixa(client, como, "bia")[0]["nao_lidas"] == 0
    assert resumo(client, como, "bia")["nao_lidas"] == 0
    detalhe = client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()
    assert detalhe["visto_ate"] == segunda["id"]

    # Responder marca como lido o que veio antes.
    enviar(client, como, "ana", conversa, "três")
    enviar(client, como, "bia", conversa, "li tudo")
    assert resumo(client, como, "bia")["nao_lidas"] == 0


def test_ler_um_pedido_nao_da_visto_a_quem_mandou(client, como):
    conversa = abrir(client, como, "ana", "bia")["id"]
    mensagem = enviar(client, como, "ana", conversa)
    client.post(f"/mensagens/conversas/{conversa}/lida", json={}, headers=como("bia"))
    assert client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()["visto_ate"] is None
    client.post(f"/mensagens/conversas/{conversa}/aceitar", headers=como("bia"))
    assert client.get(f"/mensagens/conversas/{conversa}", headers=como("ana")).json()["visto_ate"] == mensagem["id"]


# ---------- poema compartilhado ----------


def test_compartilhar_poema_inclusive_apagado_e_repost(client, como):
    poema = client.post("/posts", json={"titulo": "Mar", "texto": "a maré\nde ontem"}, headers=como("caio")).json()
    client.post(f"/posts/{poema['id']}/repostar", headers=como("bia"))
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.post import Post

    with SessionLocal() as db:
        repost_id = db.scalar(select(Post.id).where(Post.repost_de_id == poema["id"], Post.texto == ""))
    conversa = abrir(client, como, "ana", "bia")["id"]

    so_poema = enviar(client, como, "ana", conversa, "", post_id=poema["id"])
    assert so_poema["post"]["titulo"] == "Mar" and so_poema["post_removido"] is False
    # Compartilhar um repost puro compartilha o original.
    do_repost = enviar(client, como, "ana", conversa, "olha este", post_id=repost_id)
    assert do_repost["post"]["id"] == poema["id"]
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"post_id": 999}, headers=como("ana"))
    assert r.status_code == 404

    assert client.delete(f"/posts/{poema['id']}", headers=como("caio")).status_code == 204
    itens = client.get(f"/mensagens/conversas/{conversa}/mensagens", headers=como("bia")).json()["items"]
    assert [(m["post"], m["post_removido"], m["texto"]) for m in itens] == [
        (None, True, ""),
        (None, True, "olha este"),
    ]


# ---------- limites ----------


def test_texto_preserva_quebras_e_tem_limite(client, como):
    conversa = abrir(client, como, "ana", "bia")["id"]
    verso = "  primeiro verso, recuado  \n\n   segundo, mais ainda\n"
    assert enviar(client, como, "ana", conversa, verso)["texto"] == verso

    for texto in ["", "  \n "]:
        r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"texto": texto}, headers=como("ana"))
        assert r.status_code == 422
    longo = "a" * (MENSAGEM_MAX_CARACTERES + 1)
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"texto": longo}, headers=como("ana"))
    assert r.status_code == 422
    assert str(MENSAGEM_MAX_CARACTERES) in r.text
    enviar(client, como, "ana", conversa, "a" * MENSAGEM_MAX_CARACTERES)


def test_limite_de_mensagens_por_minuto(client, como, monkeypatch):
    from app.services import mensagens

    monkeypatch.setattr(mensagens, "MENSAGENS_POR_MINUTO", 3)
    conversa = abrir(client, como, "ana", "bia")["id"]
    for i in range(3):
        enviar(client, como, "ana", conversa, f"verso {i}")
    r = client.post(f"/mensagens/conversas/{conversa}/mensagens", json={"texto": "mais"}, headers=como("ana"))
    assert r.status_code == 429
    # O limite é por pessoa: a bia continua mandando.
    enviar(client, como, "bia", conversa, "calma")


# ---------- privacidade e paginação ----------


@pytest.mark.parametrize(
    ("metodo", "caminho", "corpo"),
    [
        ("get", "", None),
        ("get", "/mensagens", None),
        ("post", "/mensagens", {"texto": "oi"}),
        ("post", "/lida", {}),
        ("post", "/aceitar", None),
        ("post", "/recusar", None),
        ("post", "/silenciar", None),
    ],
)
def test_quem_nao_participa_recebe_404(client, como, metodo, caminho, corpo):
    conversa = abrir(client, como, "ana", "bia")["id"]
    enviar(client, como, "ana", conversa)
    extra = {"json": corpo} if corpo is not None else {}
    r = getattr(client, metodo)(f"/mensagens/conversas/{conversa}{caminho}", headers=como("caio"), **extra)
    assert r.status_code == 404
    assert client.get("/mensagens/conversas/999", headers=como("ana")).status_code == 404


def test_sem_login_e_401(client):
    assert client.get("/mensagens/conversas").status_code == 401
    assert client.get("/mensagens/stream").status_code == 401


def test_mensagens_por_cursor_antes_e_depois(client, como):
    conversa = abrir(client, como, "ana", "bia")["id"]
    ids = [enviar(client, como, "ana", conversa, f"m{i}")["id"] for i in range(5)]
    url = f"/mensagens/conversas/{conversa}/mensagens"

    recentes = client.get(f"{url}?limit=2", headers=como("bia")).json()
    assert [m["id"] for m in recentes["items"]] == ids[3:]
    antes = client.get(f"{url}?limit=2&antes={recentes['proximo_cursor']}", headers=como("bia")).json()
    assert [m["id"] for m in antes["items"]] == ids[1:3]
    inicio = client.get(f"{url}?limit=2&antes={antes['proximo_cursor']}", headers=como("bia")).json()
    assert [m["id"] for m in inicio["items"]] == ids[:1] and inicio["proximo_cursor"] is None

    # Ao reconectar, o cliente busca o que perdeu com `depois`.
    depois = client.get(f"{url}?limit=3&depois={ids[0]}", headers=como("bia")).json()
    assert [m["id"] for m in depois["items"]] == ids[1:4]
    resto = client.get(f"{url}?limit=3&depois={depois['proximo_cursor']}", headers=como("bia")).json()
    assert [m["id"] for m in resto["items"]] == ids[4:] and resto["proximo_cursor"] is None
    assert client.get(f"{url}?antes=3&depois=1", headers=como("bia")).status_code == 422
