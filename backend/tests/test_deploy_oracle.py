"""Deploy na Oracle (docs/deploy-oracle.md): preparo do banco uma vez, Sentry opcional e log de 500."""

import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_preparar_banco_cria_as_tabelas_e_o_seed_uma_vez(monkeypatch):
    from app.db import Base, SessionLocal, engine
    from app.main import preparar_banco
    from app.models.user import User
    from sqlalchemy import func, select

    Base.metadata.drop_all(engine)
    monkeypatch.setenv("SEED_ON_BOOT", "true")
    preparar_banco()
    with SessionLocal() as db:
        total = db.scalar(select(func.count(User.id)))
    assert total > 0
    preparar_banco()
    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id))) == total


def test_preparar_banco_sem_seed_on_boot_so_cria_as_tabelas(monkeypatch):
    from app.db import Base, SessionLocal, engine
    from app.main import preparar_banco
    from app.models.user import User
    from sqlalchemy import select

    Base.metadata.drop_all(engine)
    monkeypatch.delenv("SEED_ON_BOOT", raising=False)
    preparar_banco()
    with SessionLocal() as db:
        assert db.scalar(select(User.id).limit(1)) is None


def test_sentry_fica_desligado_sem_dsn(monkeypatch):
    from app.observabilidade import iniciar_sentry

    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert iniciar_sentry() is False
    monkeypatch.setenv("SENTRY_DSN", "  ")
    assert iniciar_sentry() is False


def test_erro_nao_tratado_vira_500_e_uma_linha_json_no_log(caplog):
    from app.observabilidade import erro_interno

    app = FastAPI()
    app.add_exception_handler(Exception, erro_interno)

    @app.get("/quebra")
    def quebra():
        raise ValueError("deu ruim")

    with caplog.at_level(logging.ERROR, logger="verso.erros"):
        r = TestClient(app, raise_server_exceptions=False).get("/quebra")
    assert r.status_code == 500
    assert r.json() == {"detail": "Erro interno do servidor."}
    linha = json.loads(caplog.records[-1].getMessage())
    assert linha == {
        "evento": "erro_interno",
        "metodo": "GET",
        "rota": "/quebra",
        "tipo": "ValueError",
        "mensagem": "deu ruim",
    }
