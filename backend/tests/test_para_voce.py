"""Feed "Para você": a rede inteira, cronológica pela atividade, mesmo sem seguir ninguém."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models.comentario import Comentario
from app.models.post import Post
from app.models.renga import EstrofeRenga
from app.models.user import User

# Meia-noite UTC: começo de uma janela de 3 horas (JANELA_DO_CONSAGRADO).
BASE = datetime(2026, 11, 20, tzinfo=UTC)


def _datar(model, id_: int, data: datetime) -> None:
    with SessionLocal() as db:
        db.get(model, id_).created_at = data
        db.commit()


def _poema(client, como, autor: str, texto: str, data: datetime | None = None) -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201
    if data is not None:
        _datar(Post, r.json()["id"], data)
    return r.json()["id"]


def _consagrado(username: str = "bilac") -> int:
    with SessionLocal() as db:
        user = User(username=username, name=username.title(), consagrado=True)
        db.add(user)
        db.commit()
        return user.id


def _poema_de_consagrado(
    autor_id: int, texto: str, data: datetime, idioma: str | None = None
) -> int:
    with SessionLocal() as db:
        post = Post(autor_id=autor_id, texto=texto, created_at=data, idioma=idioma)
        db.add(post)
        db.commit()
        return post.id


def _comentar(client, como, autor: str, post_id: int, data: datetime, ancora=None) -> int:
    corpo = {"texto": "o verso 2 quebra o ritmo", "ancora": ancora}
    r = client.post(f"/posts/{post_id}/comentarios", json=corpo, headers=como(autor))
    assert r.status_code == 201, r.text
    _datar(Comentario, r.json()["id"], data)
    return r.json()["id"]


def _renga(client, como, criador: str, data: datetime) -> int:
    corpo = {"titulo": "Renga do RU", "primeira_estrofe": "fila do RU\n  às onze"}
    r = client.post("/rengas", json=corpo, headers=como(criador))
    assert r.status_code == 201
    renga = r.json()
    _datar(EstrofeRenga, renga["estrofes"][0]["id"], data)
    return renga["id"]


def _para_voce(client, como, quem: str = "ana", **params) -> dict:
    r = client.get("/feed/para-voce", params=params, headers=como(quem))
    assert r.status_code == 200, r.text
    return r.json()


def _resumo(corpo: dict) -> list:
    return [
        ("poema", i["texto"], i["subiu_por"], [u["username"] for u in i["comentado_por"]])
        if i["tipo"] == "poema"
        else ("renga", i["renga"]["id"], i["atividade"])
        for i in corpo["items"]
    ]


def test_usuario_sem_follows_ve_a_rede(client, como):
    _poema(client, como, "bia", "chuva\nno telhado")
    assert client.get("/feed", headers=como("ana")).json()["items"] == []

    corpo = _para_voce(client, como)
    assert _resumo(corpo) == [("poema", "chuva\nno telhado", None, [])]
    assert corpo["total"] == 1


def test_mistura_traz_os_quatro_tipos_em_ordem_cronologica(client, como):
    bilac = _consagrado()
    comentado = _poema(client, como, "caio", "poema antigo", BASE)
    _poema_de_consagrado(bilac, "Ora (direis) ouvir estrelas!", BASE + timedelta(hours=1))
    renga_id = _renga(client, como, "bia", BASE + timedelta(hours=2))
    _poema(client, como, "bia", "poema novo", BASE + timedelta(hours=3))
    _comentar(client, como, "bia", comentado, BASE + timedelta(hours=4))

    assert _resumo(_para_voce(client, como)) == [
        ("poema", "poema antigo", "comentario", ["bia"]),
        ("poema", "poema novo", None, []),
        ("renga", renga_id, "abriu"),
        ("poema", "Ora (direis) ouvir estrelas!", None, []),
    ]


def test_poema_que_recebe_critica_sobe(client, como):
    antigo = _poema(client, como, "bia", "um\ndois\ntres", BASE)
    _poema(client, como, "caio", "do caio", BASE + timedelta(hours=1))
    assert [i["texto"] for i in _para_voce(client, como)["items"]] == ["do caio", "um\ndois\ntres"]

    _comentar(client, como, "ana", antigo, BASE + timedelta(hours=2), {"verso_inicio": 2, "verso_fim": 3})
    assert _resumo(_para_voce(client, como))[0] == ("poema", "um\ndois\ntres", "critica", ["ana"])

    _comentar(client, como, "caio", antigo, BASE + timedelta(hours=3))
    assert _resumo(_para_voce(client, como)) == [
        ("poema", "um\ndois\ntres", "comentario", ["caio", "ana"]),
        ("poema", "do caio", None, []),
    ]


def test_cursor_estavel_com_tipos_misturados_e_mesma_data(client, como):
    # Poema, estrofe e comentário com a mesma data e ids que podem coincidir:
    # o desempate (3·id + tipo) mantém a ordem e o cursor determinísticos.
    for i in range(4):
        _poema(client, como, "bia", f"bia {i}", BASE)
    _renga(client, como, "caio", BASE)
    alvo = _poema(client, como, "caio", "comentado", BASE - timedelta(days=1))
    _comentar(client, como, "ana", alvo, BASE)

    inteiro = _resumo(_para_voce(client, como, limit=100))
    assert len(inteiro) == 6
    assert inteiro == _resumo(_para_voce(client, como, limit=100))

    paginas, cursor = [], None
    while True:
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        corpo = _para_voce(client, como, **params)
        paginas += _resumo(corpo)[: corpo["fim_em"]]
        cursor = corpo["proximo_cursor"]
        if corpo["fim_em"] is not None:
            break
        # Um poema novo no topo não desloca a rolagem.
        _poema(client, como, "caio", f"novo {len(paginas)}", BASE + timedelta(days=1))
    assert paginas == inteiro


def test_rascunhos_e_rengas_fechadas_ficam_de_fora(client, como):
    r = client.post("/rascunhos", json={"texto": "rascunho secreto"}, headers=como("ana"))
    assert r.status_code == 201
    _poema(client, como, "bia", "publicado", BASE)
    renga_id = _renga(client, como, "caio", BASE)
    assert client.post(f"/rengas/{renga_id}/encerrar", headers=como("caio")).status_code == 200

    for quem in ("ana", "bia"):
        assert _resumo(_para_voce(client, como, quem)) == [("poema", "publicado", None, [])]


def _repostar(client, como, quem: str, post_id: int, data: datetime) -> None:
    assert client.post(f"/posts/{post_id}/repostar", headers=como(quem)).status_code == 204
    with SessionLocal() as db:
        repost = db.scalar(
            select(Post).where(Post.autor_id == _id(quem), Post.repost_de_id == post_id)
        )
        repost.created_at = data
        db.commit()


def _id(username: str) -> int:
    with SessionLocal() as db:
        return db.scalar(select(User.id).where(User.username == username))


def test_repost_puro_sobe_o_poema_uma_vez_com_repostado_por(client, como):
    original = _poema(client, como, "bia", "original", BASE)
    _poema(client, como, "caio", "do caio", BASE + timedelta(hours=1))
    _repostar(client, como, "caio", original, BASE + timedelta(hours=2))
    _repostar(client, como, "ana", original, BASE + timedelta(hours=3))

    itens = _para_voce(client, como, "bia")["items"]
    assert [(i["texto"], [u["username"] for u in i["repostado_por"]]) for i in itens] == [
        ("original", ["ana", "caio"]),
        ("do caio", []),
    ]
    assert itens[0]["id"] == original

    # Um comentário depois do repost sobe o poema de novo, agora com o rótulo do comentário.
    _comentar(client, como, "caio", original, BASE + timedelta(hours=4))
    [primeiro, _] = _para_voce(client, como)["items"]
    assert (primeiro["subiu_por"], primeiro["repostado_por"]) == ("comentario", [])


def test_repost_de_poema_apagado_some(client, como):
    original = _poema(client, como, "bia", "vai sumir", BASE)
    _repostar(client, como, "caio", original, BASE + timedelta(hours=1))
    assert client.delete(f"/posts/{original}", headers=como("bia")).status_code == 204
    assert _para_voce(client, como)["items"] == []


def test_consagrados_nao_afogam_a_rede(client, como):
    bilac = _consagrado()
    # 5 poemas na mesma janela de 3 horas: só o mais recente entra.
    mesma_janela = [
        _poema_de_consagrado(bilac, f"soneto {i}", BASE + timedelta(minutes=10 * i)) for i in range(5)
    ]
    _poema_de_consagrado(bilac, "outra janela", BASE + timedelta(hours=4))
    _poema(client, como, "bia", "da bia", BASE + timedelta(hours=1))
    assert [i["texto"] for i in _para_voce(client, como)["items"]] == [
        "outra janela",
        "da bia",
        "soneto 4",
    ]

    # Comentário sobe o poema de consagrado que tinha ficado de fora.
    _comentar(client, como, "caio", mesma_janela[0], BASE + timedelta(hours=5))
    assert _resumo(_para_voce(client, como))[0] == ("poema", "soneto 0", "comentario", ["caio"])


def _textos(corpo: dict) -> list[str]:
    return [i["texto"] for i in corpo["items"]]


def test_a_janela_do_banco_vira_no_mesmo_segundo_que_a_do_core(client, como):
    # A escolha por janela é feita no SQL (desempenho): a borda tem de ser a do
    # `janela_de`, um segundo antes e na hora cheia, inclusive com microssegundos.
    bilac = _consagrado()
    _poema_de_consagrado(bilac, "fim da janela", BASE + timedelta(hours=3, microseconds=-1))
    _poema_de_consagrado(bilac, "antes do fim", BASE + timedelta(hours=2, minutes=59))
    _poema_de_consagrado(bilac, "começo da outra", BASE + timedelta(hours=3))
    assert _textos(_para_voce(client, como)) == ["começo da outra", "fim da janela"]


def test_consagrado_na_lingua_do_navegador_tem_preferencia_na_janela(client, como):
    bilac = _consagrado()
    # Na mesma janela, o poema na língua de quem vê fica mesmo sendo o mais antigo.
    _poema_de_consagrado(bilac, "soneto", BASE + timedelta(minutes=50), "pt")
    _poema_de_consagrado(bilac, "old sonnet", BASE + timedelta(minutes=10), "en")
    _poema_de_consagrado(bilac, "new sonnet", BASE + timedelta(minutes=30), "en")
    _poema_de_consagrado(bilac, "sem idioma", BASE + timedelta(minutes=40))
    assert _textos(_para_voce(client, como, lingua="en")) == ["new sonnet"]
    assert _textos(_para_voce(client, como, lingua="pt")) == ["soneto"]


def test_janela_sem_a_lingua_de_quem_ve_fica_com_o_mais_recente(client, como):
    bilac = _consagrado()
    _poema_de_consagrado(bilac, "poème", BASE + timedelta(minutes=10), "fr")
    _poema_de_consagrado(bilac, "sonnet", BASE + timedelta(minutes=50), "en")
    _poema_de_consagrado(bilac, "soneto", BASE + timedelta(hours=4), "pt")
    assert _textos(_para_voce(client, como, lingua="pt")) == ["soneto", "sonnet"]


def test_sem_lingua_vale_a_dos_poemas_da_pessoa(client, como):
    bilac = _consagrado()
    _poema_de_consagrado(bilac, "soneto", BASE + timedelta(minutes=10), "pt")
    _poema_de_consagrado(bilac, "sonnet", BASE + timedelta(minutes=50), "en")
    for quem, idioma in (("caio", "en"), ("bia", "pt")):
        r = client.post("/posts", json={"texto": "meu", "idioma": idioma}, headers=como(quem))
        assert r.status_code == 201
    do_bilac = {"soneto", "sonnet"}
    assert [t for t in _textos(_para_voce(client, como, "caio")) if t in do_bilac] == ["sonnet"]
    assert [t for t in _textos(_para_voce(client, como, "bia")) if t in do_bilac] == ["soneto"]


def test_sem_lingua_nem_poemas_fica_o_mais_recente(client, como):
    bilac = _consagrado()
    _poema_de_consagrado(bilac, "soneto", BASE + timedelta(minutes=50), "pt")
    _poema_de_consagrado(bilac, "sonnet", BASE + timedelta(minutes=10), "en")
    _poema_de_consagrado(bilac, "poème", BASE + timedelta(minutes=55), "fr")
    assert _textos(_para_voce(client, como)) == ["poème"]


def test_lingua_invalida_da_422(client, como):
    r = client.get("/feed/para-voce?lingua=pt-BR", headers=como("ana"))
    assert r.status_code == 422


def test_cursor_estavel_com_preferencia_pela_lingua(client, como):
    bilac = _consagrado()
    _poema_de_consagrado(bilac, "soneto", BASE + timedelta(minutes=50), "pt")
    _poema_de_consagrado(bilac, "sonnet", BASE + timedelta(minutes=10), "en")
    _poema(client, como, "bia", "da bia", BASE + timedelta(hours=4))
    _poema(client, como, "bia", "outro da bia", BASE + timedelta(hours=5))
    pagina = _para_voce(client, como, limit=1, lingua="en")
    textos = _textos(pagina)
    while pagina["fim_em"] is None:
        pagina = _para_voce(client, como, limit=1, lingua="en", cursor=pagina["proximo_cursor"])
        textos += _textos(pagina)[: pagina["fim_em"]]
    assert textos == ["outro da bia", "da bia", "sonnet"]
    assert textos == _textos(_para_voce(client, como, lingua="en"))


def test_feed_seguindo_nao_traz_rotulo_de_comentario(client, como):
    post_id = _poema(client, como, "ana", "meu poema", BASE)
    _comentar(client, como, "bia", post_id, BASE + timedelta(hours=1))
    item = client.get("/feed", headers=como("ana")).json()["items"][0]
    assert (item["subiu_por"], item["comentado_por"]) == (None, [])


def test_cursor_invalido_da_422(client, como):
    r = client.get("/feed/para-voce?cursor=nao-e-cursor", headers=como("ana"))
    assert r.status_code == 422
