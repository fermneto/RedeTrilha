from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserOut

FORMAS = [
    "soneto",
    "haicai",
    "trova",
    "quadra",
    "cordel",
    "verso_livre",
    "prosa_poetica",
    "outro",
]


def _validar_texto(texto: str | None) -> str:
    """Recusa poema em branco sem alterar o texto: as quebras de linha são sagradas."""
    if texto is None or not texto.strip():
        raise ValueError("o poema não pode ficar vazio")
    return texto


def _validar_forma(forma: str | None) -> str | None:
    if forma is not None and forma not in FORMAS:
        raise ValueError(f"forma deve ser uma de: {', '.join(FORMAS)}")
    return forma


class PostCreate(BaseModel):
    titulo: str | None = Field(default=None, max_length=200)
    texto: str
    forma: str | None = None

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)


class PostUpdate(BaseModel):
    """PATCH parcial: só os campos enviados mudam; `titulo` e `forma` aceitam null."""

    titulo: str | None = Field(default=None, max_length=200)
    texto: str | None = None
    forma: str | None = None

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)


class PostOut(BaseModel):
    id: int
    autor_id: int
    titulo: str | None
    texto: str
    forma: str | None
    obra: str | None
    ano: int | None
    fonte: str | None
    repost_de_id: int | None
    created_at: datetime
    updated_at: datetime
    autor: UserOut
    curtidas: int = 0
    comentarios: int = 0
    reposts: int = 0
    curti: bool = False
    repostei: bool = False
    repost_de: "PostOut | None" = None
    tags: list[str] = []


class PostPage(BaseModel):
    """Página de poemas no padrão do projeto (ver UserPage)."""

    items: list[PostOut]
    total: int
    offset: int
    limit: int
