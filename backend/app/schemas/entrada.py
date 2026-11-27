"""Tipos comuns dos corpos de entrada: o que o banco não aceita vira 422 aqui.

As chaves são INTEGER (int4 no Postgres, ver `core/limites.py`): um número
maior chegava ao banco e a rota respondia 500. E o Postgres não guarda o
caractere NUL (`\\x00`) num texto: um poema, um nome ou uma mensagem com ele
também davam 500 na gravação.
"""

from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator

from app.core.limites import INT4_MAX, INT4_MIN


def _tem_nul(valor: Any) -> bool:
    if isinstance(valor, str):
        return "\x00" in valor
    if isinstance(valor, list | tuple | set):
        return any(_tem_nul(item) for item in valor)
    return False


class Entrada(BaseModel):
    """Base dos corpos de entrada com texto: nenhum campo de texto (nem lista de
    textos) aceita o caractere NUL. O resto do texto fica como veio."""

    @field_validator("*")
    @classmethod
    def _sem_caractere_nulo(cls, valor: Any) -> Any:
        if _tem_nul(valor):
            raise ValueError("o texto não pode ter o caractere nulo (\\0)")
        return valor

# Id de outra coisa no corpo (`repost_de_id`, `post_id`, `parent_id`...).
IdDeEntrada = Annotated[int, Field(ge=1, le=INT4_MAX)]
# Inteiro que vai para uma coluna ou comparação no banco sem ser um id
# (o verso da âncora, o `ate` da leitura): só o teto do int4.
Int4 = Annotated[int, Field(ge=INT4_MIN, le=INT4_MAX)]
