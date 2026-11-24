from pydantic import BaseModel


class TagContagem(BaseModel):
    tag: str
    contagem: int


class Trending(BaseModel):
    items: list[TagContagem]
