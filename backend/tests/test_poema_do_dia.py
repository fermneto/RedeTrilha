"""GET /poemas/do-dia: um poema de consagrado escolhido pelo dia UTC."""

from datetime import date

from sqlalchemy import select


def _consagrado_com_poemas(username: str, textos: list[str]) -> list[int]:
    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.user import User

    with SessionLocal() as db:
        poeta = User(username=username, name=username.title(), consagrado=True, morte=1914)
        db.add(poeta)
        db.flush()
        posts = [
            Post(autor_id=poeta.id, texto=t, fonte="https://pt.wikisource.org")
            for t in textos
        ]
        db.add_all(posts)
        db.commit()
        return [p.id for p in posts]


def test_sem_poemas_de_consagrados_da_404(client, como):
    client.post("/posts", json={"texto": "verso de quem escreve hoje"}, headers=como("ana"))
    r = client.get("/poemas/do-dia", headers=como("ana"))
    assert r.status_code == 404


def test_ignora_poemas_de_quem_nao_e_consagrado(client, como):
    for i in range(5):
        client.post("/posts", json={"texto": f"ana {i}"}, headers=como("ana"))
    [so_um] = _consagrado_com_poemas("augusto", ["Versos íntimos\n\n  Vês?"])

    r = client.get("/poemas/do-dia", headers=como("ana"))
    assert r.status_code == 200
    assert r.json()["id"] == so_um
    assert r.json()["texto"] == "Versos íntimos\n\n  Vês?"
    assert r.json()["autor"]["consagrado"] is True


def test_mesmo_dia_da_o_mesmo_poema(client, como):
    _consagrado_com_poemas("augusto", [f"poema {i}" for i in range(7)])
    primeiro = client.get("/poemas/do-dia", headers=como("ana")).json()["id"]
    segundo = client.get("/poemas/do-dia", headers=como("ana")).json()["id"]
    assert primeiro == segundo


def test_escolha_segue_o_hash_da_data(client, como):
    from app.db import SessionLocal
    from app.models.user import User
    from app.services.poema_do_dia import indice_do_dia, poema_do_dia

    ids = _consagrado_com_poemas("augusto", [f"poema {i}" for i in range(7)])
    with SessionLocal() as db:
        ana = db.scalar(select(User).where(User.username == "ana"))
        for dia in (date(2026, 11, 24), date(2026, 11, 25), date(2027, 1, 1)):
            escolhido = poema_do_dia(db, ana, dia).id
            assert escolhido == ids[indice_do_dia(dia, len(ids))]
            assert poema_do_dia(db, ana, dia).id == escolhido


def test_indice_do_dia_nao_depende_da_maquina():
    from app.services.poema_do_dia import indice_do_dia

    # sha256("2026-11-24") é fixo: não muda com PYTHONHASHSEED nem entre máquinas.
    assert indice_do_dia(date(2026, 11, 24), 1000) == 61


def test_rota_exige_login(client):
    assert client.get("/poemas/do-dia").status_code == 401
