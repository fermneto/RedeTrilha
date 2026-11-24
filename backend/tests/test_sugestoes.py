"""Sugestões de quem seguir: a tela depois do cadastro."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models.post import Post
from app.models.user import User

BASE = datetime(2026, 11, 20, tzinfo=UTC)


def _poema(autor_id: int, texto: str, data: datetime) -> None:
    with SessionLocal() as db:
        db.add(Post(autor_id=autor_id, texto=texto, created_at=data))
        db.commit()


def _id(username: str) -> int:
    with SessionLocal() as db:
        return db.scalar(select(User.id).where(User.username == username))


def _consagrado(username: str) -> int:
    with SessionLocal() as db:
        user = User(username=username, name=username.title(), consagrado=True)
        db.add(user)
        db.commit()
        return user.id


def _usernames(client, como, quem: str = "ana") -> list[str]:
    r = client.get("/sugestoes", headers=como(quem))
    assert r.status_code == 200, r.text
    return [u["username"] for u in r.json()["items"]]


def test_nao_sugere_a_propria_pessoa_nem_quem_ela_segue(client, como, criar_usuario):
    criar_usuario("davi")
    for i, nome in enumerate(("ana", "bia", "caio", "davi")):
        _poema(_id(nome), f"poema de {nome}", BASE + timedelta(hours=i))
    assert _usernames(client, como) == ["davi", "caio", "bia"]

    assert client.post("/usuarios/caio/follow", headers=como("ana")).status_code == 204
    assert _usernames(client, como) == ["davi", "bia"]


def test_conta_sem_poema_nao_entra(client, como):
    _poema(_id("bia"), "um poema", BASE)
    assert _usernames(client, como) == ["bia"]


def test_intercala_poetas_da_rede_e_consagrados(client, como):
    for i, nome in enumerate(("bilac", "pessoa", "cecilia")):
        _poema(_consagrado(nome), "soneto", BASE + timedelta(days=1, hours=i))
    _poema(_id("bia"), "da bia", BASE)
    _poema(_id("caio"), "do caio", BASE + timedelta(hours=1))

    assert _usernames(client, como) == ["caio", "cecilia", "bia", "pessoa", "bilac"]
    corpo = client.get("/sugestoes?offset=1&limit=2", headers=como("ana")).json()
    assert ([u["username"] for u in corpo["items"]], corpo["total"]) == (["cecilia", "bia"], 5)


def test_card_traz_contagem_e_trecho_do_ultimo_poema(client, como):
    bia = _id("bia")
    _poema(bia, "antigo", BASE)
    _poema(bia, "  primeiro verso, recuado\nsegundo verso  \nterceiro", BASE + timedelta(hours=1))

    card = client.get("/sugestoes", headers=como("ana")).json()["items"][0]
    assert card["username"] == "bia"
    assert card["poemas"] == 2
    assert card["consagrado"] is False
    assert card["trecho"] == "  primeiro verso, recuado\nsegundo verso  "
