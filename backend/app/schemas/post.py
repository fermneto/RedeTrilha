from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.idioma import IDIOMA_PADRAO, validar_idioma
from app.schemas.pagina import Pagina
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
    # ISO 639-1; null = língua desconhecida (o "outra" do compositor).
    idioma: str | None = IDIOMA_PADRAO
    # Com texto, é citação do poema `repost_de_id` (repost puro é POST /posts/{id}/repostar).
    repost_de_id: int | None = None

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)


class PostUpdate(BaseModel):
    """PATCH parcial: só os campos enviados mudam; `titulo`, `forma` e `idioma` aceitam null."""

    titulo: str | None = Field(default=None, max_length=200)
    texto: str | None = None
    forma: str | None = None
    idioma: str | None = None

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)


class PostOut(BaseModel):
    id: int
    autor_id: int
    titulo: str | None
    texto: str
    forma: str | None
    obra: str | None
    ano: int | None
    fonte: str | None
    idioma: str | None
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
    # Citação de um poema que o autor apagou: `repost_de` vem None.
    repost_removido: bool = False
    tags: list[str] = []
    # Só no feed: quem repostou o poema (repost puro), quem repostou por último primeiro.
    repostado_por: list[UserOut] = []


class PostPage(Pagina[PostOut]):
    """Página de poemas (ver schemas/pagina.py)."""
