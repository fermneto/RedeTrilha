"""Sugestões de quem seguir: exclusões e a ordem pela nota com pesos."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models.atributos_consagrado import AtributosConsagrado
from app.models.post import Post
from app.models.user import User

BASE = datetime(2026, 11, 20, tzinfo=UTC)


def _poema(autor_id: int, data: datetime = BASE, forma: str | None = None, idioma: str = "pt") -> None:
    with SessionLocal() as db:
        db.add(Post(autor_id=autor_id, texto="um verso", forma=forma, idioma=idioma, created_at=data))
        db.commit()


def _id(username: str) -> int:
    with SessionLocal() as db:
        return db.scalar(select(User.id).where(User.username == username))


def _consagrado(username: str, escolas: list[str] | None = None, pais: str | None = None) -> int:
    with SessionLocal() as db:
        user = User(username=username, name=username.title(), consagrado=True)
        db.add(user)
        db.flush()
        db.add(AtributosConsagrado(user_id=user.id, escolas=escolas or [], pais=pais))
        db.commit()
        return user.id


def _usernames(client, como, quem: str = "ana", **params) -> list[str]:
    r = client.get("/sugestoes", params=params, headers=como(quem))
    assert r.status_code == 200, r.text
    return [u["username"] for u in r.json()["items"]]


def _preferir(client, como, quem: str, **corpo) -> None:
    assert client.put("/preferencias", json=corpo, headers=como(quem)).status_code == 200


def test_nao_sugere_a_propria_pessoa_nem_quem_ela_segue(client, como, criar_usuario):
    criar_usuario("davi")
    for i, nome in enumerate(("ana", "bia", "caio", "davi")):
        _poema(_id(nome), BASE + timedelta(hours=i))
    assert _usernames(client, como) == ["davi", "caio", "bia"]

    assert client.post("/usuarios/caio/follow", headers=como("ana")).status_code == 204
    assert _usernames(client, como) == ["davi", "bia"]


def test_conta_sem_poema_nao_entra(client, como):
    _poema(_id("bia"))
    assert _usernames(client, como) == ["bia"]


def test_escolas_em_comum_sobem_o_consagrado(client, como):
    _consagrado("bilac", ["parnasianismo"])
    _consagrado("cruz_e_sousa", ["simbolismo"])
    for nome in ("bilac", "cruz_e_sousa"):
        _poema(_id(nome))
    assert _usernames(client, como) == ["cruz_e_sousa", "bilac"]

    _preferir(client, como, "ana", escolas=["parnasianismo"])
    assert _usernames(client, como) == ["bilac", "cruz_e_sousa"]


def test_escolas_do_poeta_comum_vem_das_preferencias_dele(client, como):
    _poema(_id("bia"), BASE + timedelta(hours=1))
    _poema(_id("caio"))
    _preferir(client, como, "caio", escolas=["popular_cordel"])
    _preferir(client, como, "ana", escolas=["popular_cordel"])

    corpo = client.get("/sugestoes", headers=como("ana")).json()
    assert [(u["username"], u["escolas"]) for u in corpo["items"]] == [
        ("caio", ["popular_cordel"]),
        ("bia", []),
    ]


def test_formas_escritas_contam_no_gosto(client, como):
    _poema(_id("bia"), BASE + timedelta(hours=1))
    _poema(_id("caio"), forma="haicai")
    _preferir(client, como, "ana", formas=["haicai"])
    assert _usernames(client, como) == ["caio", "bia"]


def test_mesma_lingua_do_navegador_sobe(client, como):
    _poema(_id("bia"), BASE + timedelta(hours=1), idioma="pt")
    _poema(_id("caio"), idioma="en")
    assert _usernames(client, como, lingua="pt") == ["bia", "caio"]
    assert _usernames(client, como, lingua="en") == ["caio", "bia"]
    assert client.get("/sugestoes?lingua=portugues", headers=como("ana")).status_code == 422


def test_mesmo_estado_vale_mais_que_o_mesmo_pais(client, como, criar_usuario):
    criar_usuario("davi")
    for i, nome in enumerate(("bia", "caio", "davi")):
        _poema(_id(nome), BASE + timedelta(hours=i))
    _preferir(client, como, "bia", pais="BR", uf="PB")
    _preferir(client, como, "caio", pais="BR", uf="SP")
    _preferir(client, como, "ana", pais="BR", uf="PB")
    assert _usernames(client, como) == ["bia", "caio", "davi"]


def test_seguidores_sobem_a_conta(client, como, criar_usuario):
    criar_usuario("davi")
    _poema(_id("bia"), BASE + timedelta(hours=1))
    _poema(_id("caio"))
    assert client.post("/usuarios/caio/follow", headers=como("davi")).status_code == 204
    corpo = client.get("/sugestoes", headers=como("ana")).json()
    assert [(u["username"], u["seguidores"]) for u in corpo["items"]] == [("caio", 1), ("bia", 0)]


def test_card_traz_o_perfil_sem_trecho(client, como):
    _poema(_id("bia"))
    _poema(_id("bia"), BASE + timedelta(hours=1))
    card = client.get("/sugestoes", headers=como("ana")).json()["items"][0]
    assert (card["username"], card["poemas"], card["seguidores"], card["sigo"]) == ("bia", 2, 0, False)
    assert "trecho" not in card
