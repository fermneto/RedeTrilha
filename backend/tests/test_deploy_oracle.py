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
    """O texto de cada serviço do compose.yaml (dois espaços de recuo), sem um parser de YAML.

    Uma réplica da API (`api_1: *api`) vira o texto da âncora `x-api`.
    """
    import re

    ancora = compose.split("\nx-api: &api\n", 1)[1].split("\nservices:\n", 1)[0]
    servicos = compose.split("\nservices:\n", 1)[1].split("\nnetworks:\n", 1)[0]
    partes = re.split(r"^  ([a-z0-9_-]+):( \*api)?\n", servicos, flags=re.M)
    return {
        nome: ancora if alias else texto
        for nome, alias, texto in zip(partes[1::3], partes[2::3], partes[3::3])
    }


def _replicas() -> list[str]:
    """As réplicas da API no compose.yaml: os serviços que repetem a âncora x-api."""
    import re

    return re.findall(r"^  ([a-z0-9_]+): \*api$", _deploy("compose.yaml"), flags=re.M)


def test_compose_db_sem_porta_publica_e_api_espera_o_banco():
    blocos = _blocos_dos_servicos(_deploy("compose.yaml"))
    assert "ports:" not in blocos["db"]
    assert "pg_isready" in blocos["db"]
    for servico in ("seed", "backup", *_replicas()):
        assert "db:\n" in blocos[servico] and "condition: service_healthy" in blocos[servico]


def test_compose_tem_duas_replicas_da_api_depois_do_seed():
    replicas = _replicas()
    assert replicas == ["api_1", "api_2"]
    blocos = _blocos_dos_servicos(_deploy("compose.yaml"))
    assert "api" not in blocos  # nenhuma api avulsa fora do balanceador
    for replica in replicas:
        assert "ports:" not in blocos[replica]
        assert "seed:\n      condition: service_completed_successfully" in blocos[replica]
        assert 'SEED_ON_BOOT: "false"' in blocos[replica]
        assert f"{replica}:\n        condition: service_healthy" in blocos["caddy"]


def test_max_connections_cabe_as_replicas_do_env_example():
    """réplicas x WEB_CONCURRENCY_MAX x (pool + overflow) + folga <= max_connections do db."""
    import re

    env = dict(
        linha.split("=", 1)
        for linha in _deploy(".env.example").splitlines()
        if linha and not linha.startswith("#")
    )
    maximo = int(re.search(r"max_connections=(\d+)", _deploy("compose.yaml")).group(1))
    por_worker = int(env["DB_POOL_SIZE"]) + int(env["DB_MAX_OVERFLOW"])
    folga = 3 + 5  # reservadas ao superusuário + backup, restauração (2), seed e psql
    assert len(_replicas()) * int(env["WEB_CONCURRENCY_MAX"]) * por_worker + folga <= maximo
    assert int(env["WEB_CONCURRENCY"]) <= int(env["WEB_CONCURRENCY_MAX"])


def test_caddyfile_balanceia_as_replicas_com_health_check():
    import re

    caddy = _deploy("Caddyfile")
    snippet = caddy.split("(replicas) {", 1)[1].split("\n}\n", 1)[0]
    assert re.search(r"^\tto (.+)$", snippet, flags=re.M).group(1).split() == [
        f"{r}:8000" for r in _replicas()
    ]
    for diretiva in ("health_uri /saude", "health_interval", "health_timeout", "fail_duration"):
        assert diretiva in snippet
    assert "lb_try_duration" in snippet and "lb_retries" in snippet
    # Só GET e HEAD são repetidos depois de chegar à API: um POST nunca vai duas vezes.
    metodos = re.search(r"lb_retry_match \{\s*method ([A-Z ]+)\n", snippet).group(1).split()
    assert set(metodos) <= {"GET", "HEAD", "OPTIONS"}
    # Todo reverse_proxy passa pelo balanceador, nenhum aponta para uma réplica só.
    assert caddy.count("reverse_proxy {") == caddy.count("import replicas") >= 1
    assert not re.search(r"reverse_proxy api", caddy)


def test_atualizar_roda_o_seed_e_depois_uma_replica_de_cada_vez():
    script = _deploy("atualizar.sh")
    assert f'replicas="{" ".join(_replicas())}"' in script
    seed = script.index("up -d --no-deps seed")
    laco = script.index("for replica in $replicas")
    assert seed < script.index("wait seed") < laco
    corpo = script[laco:]
    assert 'up -d --no-deps $recriar "$replica"' in corpo and "healthy" in corpo
