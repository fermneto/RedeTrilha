from pydantic import BaseModel


class TagContagem(BaseModel):
    """Uma tag do "Em alta": quantos poemas a usaram nas últimas 24 h.

    `trecho` é o primeiro verso do poema mais novo com a tag, como foi escrito
    (recuo e espaços intactos); None quando o poema não tem verso com texto.
    """

    tag: str
    contagem: int
    trecho: str | None = None


class Trending(BaseModel):
    items: list[TagContagem]


class TagEncontrada(BaseModel):
    """Um resultado da busca de tags: a tag e quantos poemas a usam (de sempre)."""

    tag: str
    poemas: int


class BuscaDeTags(BaseModel):
    items: list[TagEncontrada]
