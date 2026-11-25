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


def _deploy(nome: str) -> str:
    from pathlib import Path

    return (Path(__file__).resolve().parents[2] / "deploy" / "oracle" / nome).read_text()


def _blocos_dos_servicos(compose: str) -> dict[str, str]:
    """O texto de cada serviço do compose.yaml (dois espaços de recuo), sem um parser de YAML."""
    import re

    servicos = compose.split("\nservices:\n", 1)[1].split("\nnetworks:\n", 1)[0]
    partes = re.split(r"^  ([a-z0-9-]+):\n", servicos, flags=re.M)
    return dict(zip(partes[1::2], partes[2::2]))


def test_compose_db_sem_porta_publica_e_api_espera_o_banco():
    blocos = _blocos_dos_servicos(_deploy("compose.yaml"))
    assert "ports:" not in blocos["db"]
    assert "pg_isready" in blocos["db"]
    for servico in ("seed", "api", "backup"):
        assert "db:\n        condition: service_healthy" in blocos[servico]


def test_max_connections_cabe_os_workers_do_env_example():
    """WEB_CONCURRENCY_MAX x (pool + overflow + o LISTEN das mensagens) + folga <= max_connections."""
    import re

    env = dict(
        linha.split("=", 1)
        for linha in _deploy(".env.example").splitlines()
        if linha and not linha.startswith("#")
    )
    maximo = int(re.search(r"max_connections=(\d+)", _deploy("compose.yaml")).group(1))
    # + 1: a conexão do LISTEN das mensagens, fora do pool (app/tempo_real.py).
    por_worker = int(env["DB_POOL_SIZE"]) + int(env["DB_MAX_OVERFLOW"]) + 1
    folga = 3 + 5  # reservadas ao superusuário + backup, restauração e psql
    assert int(env["WEB_CONCURRENCY_MAX"]) * por_worker + folga <= maximo
    assert int(env["WEB_CONCURRENCY"]) <= int(env["WEB_CONCURRENCY_MAX"])
