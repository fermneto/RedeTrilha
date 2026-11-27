"""Tipos comuns dos corpos de entrada: o que o banco não aceita vira 422 aqui.

As chaves são INTEGER (int4 no Postgres, ver `core/limites.py`): um número
maior chegava ao banco e a rota respondia 500.
"""

from typing import Annotated

from pydantic import Field

from app.core.limites import INT4_MAX, INT4_MIN

# Id de outra coisa no corpo (`repost_de_id`, `post_id`, `parent_id`...).
IdDeEntrada = Annotated[int, Field(ge=1, le=INT4_MAX)]
# Inteiro que vai para uma coluna ou comparação no banco sem ser um id
# (o verso da âncora, o `ate` da leitura): só o teto do int4.
Int4 = Annotated[int, Field(ge=INT4_MIN, le=INT4_MAX)]
