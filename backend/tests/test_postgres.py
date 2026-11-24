"""Integração com Postgres (o banco do deploy, no Supabase). Opcional.

Pulado sem TEST_POSTGRES_URL. Para rodar, num Postgres descartável:
    docker run -d --name verso-pg -e POSTGRES_PASSWORD=teste -p 54329:5432 postgres:16
    TEST_POSTGRES_URL=postgresql://postgres:teste@localhost:54329/postgres make test
Com a variável, a suíte inteira roda no Postgres (ver conftest.py).
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, inspect, select
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRES_URL"), reason="defina TEST_POSTGRES_URL para rodar"
)


def test_o_banco_e_postgres_com_psycopg():
    from app.db import engine

    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"


def test_boot_com_seed_login_feed_e_repost_no_postgres(monkeypatch):
    from app.db import Base, engine
    from app.main import app

    Base.metadata.drop_all(engine)
    monkeypatch.setenv("SEED_ON_BOOT", "true")
    with TestClient(app) as c:
        r = c.post("/auth/login", json={"username": "marina_letras", "password": "verso123"})
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['token']}"}

        feed = c.get("/feed", headers=headers).json()
        assert feed["total"] > 0
        assert c.get("/tags/trending", headers=headers).json()["items"]

        alvo_id = next(
            p["id"]
            for p in feed["items"]
            if p["repost_de_id"] is None and p["autor"]["username"] != "marina_letras"
        )
        assert c.post(f"/posts/{alvo_id}/repostar", headers=headers).status_code == 204
        # repostar de novo é idempotente (o índice parcial segura o duplicado)
        assert c.post(f"/posts/{alvo_id}/repostar", headers=headers).status_code == 204


def test_indice_parcial_do_repost_puro_existe_e_vale_no_postgres(client):
    from app.db import SessionLocal, engine
    from app.models.post import Post
    from app.models.user import User

    indices = {i["name"]: i for i in inspect(engine).get_indexes("posts")}
    assert indices["uq_repost_puro"]["unique"]

    with SessionLocal() as db:
        db.add_all([User(username="ana", name="Ana"), User(username="bia", name="Bia")])
        db.commit()
        ana, bia = db.scalars(select(User).order_by(User.username)).all()
        original = Post(autor_id=bia.id, texto="um poema")
        db.add(original)
        db.commit()

        repost = {"autor_id": ana.id, "repost_de_id": original.id, "texto": ""}
        citacao = {"autor_id": ana.id, "repost_de_id": original.id, "texto": "cito"}
        db.execute(insert(Post), [repost, citacao, citacao])  # citações repetem
        db.commit()
        with pytest.raises(IntegrityError):
            db.execute(insert(Post), [repost])
            db.commit()
