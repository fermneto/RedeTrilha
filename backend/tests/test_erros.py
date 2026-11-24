"""422 em português em toda a API (app/erros.py)."""

import pytest

from app.erros import traduzir

SENHA = "senha-forte-123"


def _msgs(r) -> dict[str, str]:
    assert r.status_code == 422
    return {erro["loc"][-1]: erro["msg"] for erro in r.json()["detail"]}


def test_campo_faltando_e_campo_obrigatorio(client):
    r = client.post("/auth/registro", json={"username": "ana"})
    assert _msgs(r) == {"name": "campo obrigatório", "password": "campo obrigatório"}


def test_tipo_errado_e_precisa_ser_texto(client):
    r = client.post("/auth/registro", json={"username": "ana", "name": 123, "password": SENHA})
    assert _msgs(r) == {"name": "precisa ser texto"}


def test_query_com_inteiro_invalido_ou_fora_do_limite(client):
    assert _msgs(client.get("/usuarios?limit=abc")) == {"limit": "precisa ser um número inteiro"}
    assert _msgs(client.get("/usuarios?limit=0")) == {"limit": "precisa ser maior ou igual a 1"}
    assert _msgs(client.get("/usuarios?limit=101")) == {"limit": "precisa ser menor ou igual a 100"}


def test_json_invalido(client):
    r = client.post(
        "/auth/login", content="{ nao e json", headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 422
    assert r.json()["detail"][0]["msg"] == "JSON inválido"


def test_mensagem_do_validador_fica_sem_o_prefixo_em_ingles(client):
    r = client.post("/auth/registro", json={"username": "feed", "name": "Ana", "password": SENHA})
    assert _msgs(r) == {"username": 'o username "feed" é reservado pelo Verso; escolha outro'}


def test_formato_do_fastapi_continua_o_mesmo(client):
    erro = client.post("/auth/registro", json={}).json()["detail"][0]
    assert {"type", "loc", "msg"} <= erro.keys()
    assert erro["type"] == "missing"
    assert erro["loc"][0] == "body"


@pytest.mark.parametrize(
    ("erro", "mensagem"),
    [
        ({"type": "bool_type", "msg": "Input should be a valid boolean"}, "precisa ser verdadeiro ou falso"),
        ({"type": "bool_parsing", "msg": "Input should be a valid boolean"}, "precisa ser verdadeiro ou falso"),
        ({"type": "int_type", "msg": "Input should be a valid integer"}, "precisa ser um número inteiro"),
        (
            {"type": "string_too_long", "msg": "String should have at most 200 characters", "ctx": {"max_length": 200}},
            "pode ter no máximo 200 caracteres",
        ),
        ({"type": "tipo_sem_traducao", "msg": "Some message"}, "Some message"),
    ],
)
def test_traduzir_por_tipo(erro, mensagem):
    assert traduzir(erro)["msg"] == mensagem
