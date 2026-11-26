from typing import Literal

from pydantic import BaseModel, Field


class ItemVisto(BaseModel):
    """Um poema ou uma renga que apareceu na tela, no feed."""

    tipo: Literal["poema", "renga"]
    id: int = Field(gt=0)


class VistosIn(BaseModel):
    """O lote que o front manda enquanto a pessoa vira as folhas (até 100 por vez)."""

    itens: list[ItemVisto] = Field(min_length=1, max_length=100)
