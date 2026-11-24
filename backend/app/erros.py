"""422 em português para toda a API.

O pydantic escreve os erros de validação em inglês ("Field required", "Input
should be a valid string"). Este handler troca o `msg` pelo `type` do erro e
mantém o resto do formato padrão do FastAPI (`{"detail": [{type, loc, msg, ...}]}`).
As mensagens dos validadores próprios (os ValueError, já em português) só perdem
o prefixo "Value error, ". Um `type` sem tradução fica com o `msg` original.
"""

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Mensagens por `type` do pydantic; `{chave}` vem do `ctx` do erro.
MENSAGENS = {
    "missing": "campo obrigatório",
    "extra_forbidden": "campo não permitido",
    "string_type": "precisa ser texto",
    "int_type": "precisa ser um número inteiro",
    "int_parsing": "precisa ser um número inteiro",
    "int_from_float": "precisa ser um número inteiro",
    "float_type": "precisa ser um número",
    "float_parsing": "precisa ser um número",
    "bool_type": "precisa ser verdadeiro ou falso",
    "bool_parsing": "precisa ser verdadeiro ou falso",
    "list_type": "precisa ser uma lista",
    "dict_type": "precisa ser um objeto",
    "model_type": "precisa ser um objeto",
    "model_attributes_type": "precisa ser um objeto",
    "json_invalid": "JSON inválido",
    "string_too_short": "precisa ter pelo menos {min_length} caracteres",
    "string_too_long": "pode ter no máximo {max_length} caracteres",
    "string_pattern_mismatch": "formato inválido",
    "too_short": "precisa ter pelo menos {min_length} itens",
    "too_long": "pode ter no máximo {max_length} itens",
    "greater_than": "precisa ser maior que {gt}",
    "greater_than_equal": "precisa ser maior ou igual a {ge}",
    "less_than": "precisa ser menor que {lt}",
    "less_than_equal": "precisa ser menor ou igual a {le}",
}

PREFIXO_VALUE_ERROR = "Value error, "


def traduzir(erro: dict) -> dict:
    """O erro do pydantic com o `msg` em português."""
    tipo = erro.get("type")
    msg = erro.get("msg", "")
    if tipo == "value_error" and msg.startswith(PREFIXO_VALUE_ERROR):
        msg = msg.removeprefix(PREFIXO_VALUE_ERROR)
    elif tipo in MENSAGENS:
        try:
            msg = MENSAGENS[tipo].format(**erro.get("ctx", {}))
        except (KeyError, IndexError):
            pass
    return {**erro, "msg": msg}


async def erro_de_validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
    erros = [traduzir(erro) for erro in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(erros)})
