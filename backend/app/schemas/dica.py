from typing import Literal, get_args

from pydantic import BaseModel

# As dicas do livro, na ordem em que aparecem no primeiro uso (lib/dicas.ts):
# virar a página, as ações e os comentários, a lombada e escrever (poema e renga).
Dica = Literal["virar_pagina", "acoes", "lombada", "escrever"]
DICAS: tuple[str, ...] = get_args(Dica)


class DicasVistas(BaseModel):
    """As dicas que a pessoa já viu, na ordem de DICAS."""

    vistas: list[Dica]
