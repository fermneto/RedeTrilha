"""Infra dos testes: banco descartável + client + helpers de auth.

Os testes falam com a API só por HTTP (TestClient) — exatamente como o frontend.
"""

import os
import sys
import tempfile
from pathlib import Path

# roda de backend/ (make test) ou de onde for — o import de `app` sempre funciona
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# banco descartável POR SESSÃO de teste, antes de qualquer import de app.*
# Com TEST_POSTGRES_URL (um Postgres DESCARTÁVEL: os testes apagam as tabelas),
# a suíte inteira roda nele e o tests/test_postgres.py deixa de ser pulado.
_tmp_db = Path(tempfile.mkdtemp(prefix="trilha-test-")) / "test.db"
os.environ["DATABASE_URL"] = os.environ.get("TEST_POSTGRES_URL") or f"sqlite:///{_tmp_db}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

MSG_AUTH = (
    "auth ainda não implementada — este teste depende de registro/login. "
    "Siga docs/guias/01-autenticacao.md."
)

SENHA_PADRAO = "senha-forte-123"


class ClienteAnthropicProibido:
    """Fica no lugar do cliente real: um teste que traduz sem o falso falha alto."""

    @property
    def messages(self):
        raise AssertionError(
            "teste tentou chamar a API real da Anthropic; use a fixture `falso` de test_traducao.py"
        )


@pytest.fixture(autouse=True)
def sem_api_da_anthropic(monkeypatch):
    """Nenhum teste chama a API real: sem chave no ambiente e cliente que falha se usado.

    Os testes de tradução trocam `_cliente` pelo falso (ou por None, para o 503)
    depois desta fixture, e o monkeypatch desfaz tudo no fim de cada teste.
    """
    from app.services import traducao

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(traducao, "_cliente", ClienteAnthropicProibido())


@pytest.fixture()
def client():
    """Client com banco zerado por teste. O lifespan roda (cria tabelas + core/)."""
    from app.db import Base, engine
    from app.main import app

    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def logar(client):
    """Fábrica: cria usuário PELAS ROTAS DO SEU time e devolve o header Authorization.

    Use em qualquer teste que precise de gente logada:
        ana = logar("ana")
        client.post("/posts", json={...}, headers=ana)
    Fica VERMELHO até a auth existir — é proposital (guia 01).
    """

    def _logar(username: str, name: str = "Alguém") -> dict:
        r = client.post(
            "/auth/registro",
            json={"username": username, "name": name, "password": SENHA_PADRAO},
        )
        assert r.status_code == 201, MSG_AUTH
        r = client.post(
            "/auth/login", json={"username": username, "password": SENHA_PADRAO}
        )
        assert r.status_code == 200, MSG_AUTH
        return {"Authorization": f"Bearer {r.json()['token']}"}

    return _logar


@pytest.fixture()
def como(client):
    """Troca get_current_user pelo usuário do header X-Teste-Usuario (sem depender da auth).

    Cria ana, bia e caio (contas sem senha, pelo POST /usuarios). Uso:
        client.post("/posts", json={...}, headers=como("ana"))
    """
    from fastapi import Header
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.deps import get_current_user
    from app.main import app
    from app.models.user import User

    def usuario_do_header(x_teste_usuario: str = Header()):
        with SessionLocal() as db:
            return db.scalar(select(User).where(User.username == x_teste_usuario))

    app.dependency_overrides[get_current_user] = usuario_do_header
    for nome in ("ana", "bia", "caio"):
        client.post("/usuarios", json={"username": nome, "name": nome.title()})
    yield lambda username: {"X-Teste-Usuario": username}
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(client, logar):
    """Client já autenticado (header fixado). Vermelho até a auth do time existir."""
    client.headers.update(logar("tester_auth", "Tester"))
    return client
