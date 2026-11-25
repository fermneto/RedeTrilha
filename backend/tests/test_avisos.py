"""Avisos (decisão 16, services/avisos.py): cada evento, o agrupamento, quem não
recebe (quem agiu, consagrado, bloqueio), desfazer, ler e a paginação.

Usa a fixture `como` (sem bcrypt por conta). As contas dela nascem sem senha, como
os consagrados; aqui ganham uma (`com_login`), porque conta sem login não recebe aviso.
"""

import asyncio
import json

import httpx
import pytest
from sqlalchemy import update

from app.core import avisos as regras
from test_mensagens_stream import entrar, ler_eventos, servidor  # noqa: F401

POEMA = "primeiro verso\nsegundo verso\n\nquarto verso"


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


def _poema(client, eu, autor="bia", texto=POEMA, **extra) -> int:
    r = client.post("/posts", json={"titulo": "Chuva", "texto": texto, **extra}, headers=eu(autor))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _avisos(client, eu, quem="bia", **params) -> dict:
    r = client.get("/avisos", params=params, headers=eu(quem))
    assert r.status_code == 200, r.text
    return r.json()


def _tipos(client, eu, quem="bia") -> list[tuple[str, list[str]]]:
    return [
        (a["tipo"], [u["username"] for u in a["atores"]]) for a in _avisos(client, eu, quem)["items"]
    ]


def _nao_lidos(client, eu, quem="bia") -> int:
    return client.get("/avisos/resumo", headers=eu(quem)).json()["nao_lidos"]


def _comentar(client, eu, post_id, autor="ana", **corpo):
    r = client.post(
        f"/posts/{post_id}/comentarios", json={"texto": "bonito", **corpo}, headers=eu(autor)
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------- core ----------


def test_destinatarios_sem_o_ator_sem_excluidos_e_sem_repetir():
    candidatos = [(2, "resposta"), (1, "comentario"), (2, "comentario"), (None, "x"), (3, "c"), (4, "c")]
    assert regras.destinatarios(1, candidatos, {4}) == [(2, "resposta"), (3, "c")]


def test_estrofes_tocadas_contam_a_linha_em_branco_entre_elas():
    estrofes = ["a\nb\nc", "d\ne", "f"]  # versos 1-3, branco 4, 5-6, branco 7, 8
    assert regras.estrofes_tocadas(estrofes, 2, 2) == [0]
    assert regras.estrofes_tocadas(estrofes, 3, 5) == [0, 1]
    assert regras.estrofes_tocadas(estrofes, 4, 4) == []
    assert regras.estrofes_tocadas(estrofes, 6, 8) == [1, 2]


def test_trecho_e_a_primeira_linha_com_texto_cortada():
    assert regras.trecho("\n   \n  verso um  \nverso dois") == "verso um"
    assert regras.trecho("x" * 200, limite=10) == "x" * 9 + "…"


# ---------- eventos ----------


def test_curtidas_e_reposts_do_mesmo_poema_viram_uma_linha(client, eu):
    post_id = _poema(client, eu)
    for quem in ("ana", "caio", "dani"):
        assert client.post(f"/posts/{post_id}/curtir", headers=eu(quem)).status_code == 204
    assert client.post(f"/posts/{post_id}/repostar", headers=eu("ana")).status_code == 204

    itens = _avisos(client, eu)["items"]
    assert [(a["tipo"], a["total_atores"]) for a in itens] == [("repost", 1), ("curtida", 3)]
    curtida = itens[1]
    assert [u["username"] for u in curtida["atores"]] == ["dani", "caio"]
    assert (curtida["post_id"], curtida["titulo"], curtida["trecho"]) == (post_id, "Chuva", "primeiro verso")
    assert _nao_lidos(client, eu) == 2


def _datar(datas: dict[str, str]) -> None:
    """Muda a data (UTC) dos avisos de curtida de cada ator."""
    from datetime import datetime

    from app.db import SessionLocal
    from app.models.aviso import Aviso
    from app.models.user import User

    with SessionLocal() as db:
        for username, quando in datas.items():
            ator = db.query(User.id).filter(User.username == username).scalar()
            db.execute(
                update(Aviso).where(Aviso.ator_id == ator).values(created_at=datetime.fromisoformat(quando))
            )
        db.commit()


def test_curtidas_agrupam_por_dia_de_brasilia(client, eu):
    post_id = _poema(client, eu)
    for quem in ("ana", "caio", "dani"):
        client.post(f"/posts/{post_id}/curtir", headers=eu(quem))
    # 02:00 UTC do dia 20 ainda é dia 19 em Brasília (23:00); 04:00 e 20:00 UTC são dia 20.
    _datar({"ana": "2026-11-20 02:00:00", "caio": "2026-11-20 04:00:00", "dani": "2026-11-20 20:00:00"})

    itens = _avisos(client, eu)["items"]
    assert [(a["tipo"], a["total_atores"], [u["username"] for u in a["atores"]]) for a in itens] == [
        ("curtida", 2, ["dani", "caio"]),
        ("curtida", 1, ["ana"]),
    ]
    assert _nao_lidos(client, eu) == 2
    # Paginando de uma em uma, as duas linhas do mesmo poema aparecem uma vez cada.
    primeira = _avisos(client, eu, limit=1)
    segunda = _avisos(client, eu, limit=1, cursor=primeira["proximo_cursor"])
    assert [a["total_atores"] for a in primeira["items"] + segunda["items"]] == [2, 1]
    assert segunda["proximo_cursor"] is None
    # Lida a linha de ontem só, o contador fica com a de hoje.
    client.post("/avisos/lidos", json={"ate": itens[1]["id"]}, headers=eu("bia"))
    assert _nao_lidos(client, eu) == 1


def test_curtir_um_repost_puro_avisa_o_autor_do_original(client, eu):
    post_id = _poema(client, eu)
    client.post(f"/posts/{post_id}/repostar", headers=eu("ana"))
    from app.db import SessionLocal
    from app.models.post import Post

    with SessionLocal() as db:
        repost_id = db.query(Post.id).filter(Post.repost_de_id == post_id).scalar()
    client.post(f"/posts/{repost_id}/curtir", headers=eu("caio"))
    assert ("curtida", ["caio"]) in _tipos(client, eu)
    assert [t for t, _ in _tipos(client, eu, "ana")] == []


def test_novo_seguidor_e_deixar_de_seguir(client, eu):
    assert client.post("/usuarios/bia/follow", headers=eu("ana")).status_code == 204
    assert _tipos(client, eu) == [("seguidor", ["ana"])]
    client.delete("/usuarios/bia/follow", headers=eu("ana"))
    assert _tipos(client, eu) == []


def test_citacao_avisa_o_autor_do_citado_e_mostra_o_texto_de_quem_citou(client, eu):
    post_id = _poema(client, eu)
    citacao = _poema(client, eu, "ana", "> segundo verso\n\nisso me pegou", repost_de_id=post_id)
    aviso = _avisos(client, eu)["items"][0]
    assert (aviso["tipo"], aviso["post_id"], aviso["titulo"], aviso["trecho"]) == (
        "citacao",
        citacao,
        "Chuva",
        "> segundo verso",
    )
    client.delete(f"/posts/{citacao}", headers=eu("ana"))
    assert _tipos(client, eu) == []


def test_comentario_critica_e_resposta_no_poema(client, eu):
    post_id = _poema(client, eu)
    comentario = _comentar(client, eu, post_id, "ana", texto="gostei do fim")
    _comentar(client, eu, post_id, "caio", texto="o 2 manca", ancora={"verso_inicio": 2, "verso_fim": 4})
    _comentar(client, eu, post_id, "dani", texto="discordo", parent_id=comentario)

    assert _tipos(client, eu) == [
        ("comentario", ["dani"]),
        ("critica", ["caio"]),
        ("comentario", ["ana"]),
    ]
    critica = _avisos(client, eu)["items"][1]
    assert (critica["verso_inicio"], critica["verso_fim"], critica["trecho"]) == (2, 4, "o 2 manca")
    resposta = _avisos(client, eu, "ana")["items"]
    assert [(a["tipo"], a["comentario_id"], a["trecho"]) for a in resposta] == [
        ("resposta", resposta[0]["comentario_id"], "discordo")
    ]


def test_a_dona_que_responde_no_proprio_poema_avisa_so_quem_foi_respondido(client, eu):
    post_id = _poema(client, eu)
    comentario = _comentar(client, eu, post_id, "ana")
    _comentar(client, eu, post_id, "bia", texto="obrigada", parent_id=comentario)
    assert [t for t, _ in _tipos(client, eu)] == ["comentario"]
    assert _tipos(client, eu, "ana") == [("resposta", ["bia"])]


def test_apagar_comentario_ou_poema_apaga_os_avisos(client, eu):
    post_id = _poema(client, eu)
    sem_resposta = _comentar(client, eu, post_id, "ana")
    com_resposta = _comentar(client, eu, post_id, "caio")
    _comentar(client, eu, post_id, "dani", parent_id=com_resposta)
    client.delete(f"/comentarios/{sem_resposta}", headers=eu("ana"))
    # Com resposta vira o marcador "comentário removido": o aviso sai também.
    client.delete(f"/comentarios/{com_resposta}", headers=eu("caio"))
    assert _tipos(client, eu) == [("comentario", ["dani"])]

    client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
    client.post(f"/posts/{post_id}/repostar", headers=eu("caio"))
    client.delete(f"/posts/{post_id}", headers=eu("bia"))
    assert _tipos(client, eu) == [] and _nao_lidos(client, eu) == 0
    assert _tipos(client, eu, "caio") == []


def test_descurtir_e_desfazer_repost_tiram_o_aviso(client, eu):
    post_id = _poema(client, eu)
    client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
    client.post(f"/posts/{post_id}/curtir", headers=eu("caio"))
    client.post(f"/posts/{post_id}/repostar", headers=eu("ana"))
    client.delete(f"/posts/{post_id}/curtir", headers=eu("ana"))
    client.delete(f"/posts/{post_id}/repostar", headers=eu("ana"))
    assert _tipos(client, eu) == [("curtida", ["caio"])]


def test_curtir_duas_vezes_nao_duplica_o_aviso(client, eu):
    post_id = _poema(client, eu)
    client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
    client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
    assert _avisos(client, eu)["items"][0]["total_atores"] == 1


# ---------- rengas ----------


def _renga(client, eu, criador="bia", **extra) -> int:
    corpo = {"titulo": "Renga da chuva", "primeira_estrofe": "a\nb\nc", "limite": 8, **extra}
    r = client.post("/rengas", json=corpo, headers=eu(criador))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _estrofe(client, eu, renga_id, autor, texto):
    r = client.post(f"/rengas/{renga_id}/estrofes", json={"texto": texto}, headers=eu(autor))
    assert r.status_code == 201, r.text


def test_estrofe_nova_avisa_o_criador_e_quem_ja_escreveu(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, renga_id, "ana", "d\ne")
    _estrofe(client, eu, renga_id, "caio", "f")
    assert _tipos(client, eu) == [("estrofe", ["caio"]), ("estrofe", ["ana"])]
    assert _tipos(client, eu, "ana") == [("estrofe", ["caio"])]
    aviso = _avisos(client, eu, "ana")["items"][0]
    assert (aviso["renga_id"], aviso["titulo"], aviso["trecho"]) == (renga_id, "Renga da chuva", "f")
    assert _tipos(client, eu, "caio") == []


def test_convite_para_renga(client, eu):
    renga_id = _renga(client, eu, modo="convidados", convidados=["ana"])
    assert _tipos(client, eu, "ana") == [("convite", ["bia"])]
    client.post(f"/rengas/{renga_id}/convites", json={"usernames": ["ana", "caio"]}, headers=eu("bia"))
    assert _tipos(client, eu, "caio") == [("convite", ["bia"])]
    assert len(_tipos(client, eu, "ana")) == 1


def test_comentario_na_renga_avisa_criador_e_autores_e_a_critica_so_os_tocados(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, renga_id, "ana", "d\ne")  # versos 5 e 6
    _estrofe(client, eu, renga_id, "caio", "f")  # verso 8
    url = f"/rengas/{renga_id}/comentarios"

    geral = client.post(url, json={"texto": "que renga"}, headers=eu("dani")).json()
    for quem in ("bia", "ana", "caio"):
        assert ("comentario", ["dani"]) in _tipos(client, eu, quem)

    corpo = {"texto": "o 5 é lindo", "ancora": {"verso_inicio": 5, "verso_fim": 6}}
    client.post(url, json=corpo, headers=eu("dani"))
    assert _tipos(client, eu, "ana")[0] == ("critica", ["dani"])
    assert _tipos(client, eu, "bia")[0] == ("critica", ["dani"])
    assert _tipos(client, eu, "caio")[0] == ("comentario", ["dani"])
    critica = _avisos(client, eu, "ana")["items"][0]
    assert (critica["verso_inicio"], critica["verso_fim"]) == (5, 6)

    client.post(url, json={"texto": "concordo", "parent_id": geral["id"]}, headers=eu("ana"))
    assert _tipos(client, eu, "dani") == [("resposta", ["ana"])]
    client.delete(f"{url}/{geral['id']}", headers=eu("dani"))
    assert ("comentario", ["dani"]) not in _tipos(client, eu, "caio")


# ---------- quem não recebe ----------


def test_consagrado_nao_recebe_aviso(client, eu, criar_usuario):
    from app.db import SessionLocal
    from app.models.post import Post

    pessoa_id = criar_usuario("camoes")
    with SessionLocal() as db:
        poema = Post(autor_id=pessoa_id, texto="Amor é fogo que arde sem se ver")
        db.add(poema)
        db.commit()
        post_id = poema.id
    assert client.post(f"/posts/{post_id}/curtir", headers=eu("ana")).status_code == 204
    assert client.post("/usuarios/camoes/follow", headers=eu("ana")).status_code == 204
    from app.models.aviso import Aviso

    with SessionLocal() as db:
        assert db.query(Aviso).count() == 0


def test_bloqueio_nos_dois_sentidos(client, eu):
    post_id = _poema(client, eu)
    comentario = _comentar(client, eu, post_id, "ana")
    # A ana bloqueia o caio: ele responde no poema da bia, mas a ana não é avisada.
    client.post("/usuarios/caio/bloqueio", headers=eu("ana"))
    _comentar(client, eu, post_id, "caio", parent_id=comentario)
    assert _tipos(client, eu, "ana") == []
    assert ("comentario", ["caio"]) in _tipos(client, eu)

    # A bia bloqueia a dani depois de ser curtida por ela: o aviso some da leitura.
    client.post(f"/posts/{post_id}/curtir", headers=eu("dani"))
    assert _nao_lidos(client, eu) == 3
    client.post("/usuarios/dani/bloqueio", headers=eu("bia"))
    assert ("curtida", ["dani"]) not in _tipos(client, eu)
    assert _nao_lidos(client, eu) == 2


def test_quem_tem_bloqueio_com_o_criador_nao_e_avisado_na_renga(client, eu):
    renga_id = _renga(client, eu)
    _estrofe(client, eu, renga_id, "ana", "d")
    client.post("/usuarios/ana/bloqueio", headers=eu("bia"))
    client.post(f"/rengas/{renga_id}/comentarios", json={"texto": "oi"}, headers=eu("caio"))
    assert _tipos(client, eu, "ana") == []
    assert _tipos(client, eu, "bia")[0] == ("comentario", ["caio"])


def test_curtir_o_proprio_poema_nao_avisa(client, eu):
    post_id = _poema(client, eu)
    client.post(f"/posts/{post_id}/curtir", headers=eu("bia"))
    _comentar(client, eu, post_id, "bia")
    assert _tipos(client, eu) == []


# ---------- ler e paginar ----------


def test_marcar_lidos_zera_o_contador_ate_o_que_a_tela_mostrou(client, eu):
    post_id = _poema(client, eu)
    client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
    visto = _avisos(client, eu)["items"][0]["id"]
    client.post("/usuarios/bia/follow", headers=eu("caio"))
    assert client.post("/avisos/lidos", json={"ate": visto}, headers=eu("bia")).status_code == 204
    assert _nao_lidos(client, eu) == 1
    assert [a["lido"] for a in _avisos(client, eu)["items"]] == [False, True]
    # Curtida nova num grupo lido: a linha volta a ficar não lida.
    client.post(f"/posts/{post_id}/curtir", headers=eu("dani"))
    assert _nao_lidos(client, eu) == 2
    assert client.post("/avisos/lidos", headers=eu("bia")).status_code == 204
    assert _nao_lidos(client, eu) == 0


def test_paginacao_por_cursor_sem_repetir_nem_pular(client, eu):
    poemas = [_poema(client, eu, texto=f"poema {i}") for i in range(5)]
    for post_id in poemas:
        client.post(f"/posts/{post_id}/curtir", headers=eu("ana"))
        _comentar(client, eu, post_id, "caio")
    # A curtida nova sobe a linha do primeiro poema para o topo.
    client.post(f"/posts/{poemas[0]}/curtir", headers=eu("dani"))

    vistos, cursor = [], None
    while True:
        params = {"limit": 3, **({"cursor": cursor} if cursor else {})}
        pagina = _avisos(client, eu, **params)
        vistos += [(a["tipo"], a["post_id"]) for a in pagina["items"]]
        cursor = pagina["proximo_cursor"]
        if cursor is None:
            break
    assert len(vistos) == len(set(vistos)) == 10
    assert vistos[0] == ("curtida", poemas[0])
    assert vistos[1] == ("comentario", poemas[4])
    assert client.get("/avisos?cursor=xx", headers=eu("bia")).status_code == 422


def test_rotas_pedem_login(client):
    assert client.get("/avisos").status_code == 401
    assert client.get("/avisos/resumo").status_code == 401
    assert client.post("/avisos/lidos").status_code == 401


# ---------- tempo real ----------


def test_aviso_chega_pelo_stream_das_mensagens(servidor):  # noqa: F811
    ana, bia = entrar(servidor, "ana"), entrar(servidor, "bia")
    with httpx.Client(base_url=servidor, headers=bia) as c:
        post_id = c.post("/posts", json={"texto": POEMA}).json()["id"]

    async def cenario():
        async with httpx.AsyncClient(base_url=servidor, timeout=10) as c:
            async with c.stream("GET", "/mensagens/stream", headers=bia) as r:
                linhas = r.aiter_lines()
                await ler_eventos(linhas, "pronto")
                await c.post(f"/posts/{post_id}/curtir", headers=ana)
                eventos = await ler_eventos(linhas, "aviso")
                assert eventos[-1] == ("aviso", json.dumps({}))

    asyncio.run(cenario())
