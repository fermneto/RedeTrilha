from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.idioma import IDIOMA_PADRAO, validar_idioma
from app.schemas.pagina import Pagina
from app.schemas.post import PostUpdate, _validar_forma, _validar_texto


class RascunhoCreate(BaseModel):
    """Os campos de um poema novo, menos a citação: rascunho é sempre poema próprio."""

    titulo: str | None = Field(default=None, max_length=200)
    texto: str
    forma: str | None = None
    idioma: str | None = IDIOMA_PADRAO

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)


class RascunhoUpdate(PostUpdate):
    """PATCH parcial, com as mesmas regras do PATCH /posts/{id}."""


class RascunhoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    autor_id: int
    titulo: str | None
    texto: str
    forma: str | None
    idioma: str | None
    created_at: datetime
    updated_at: datetime


class RascunhoPage(Pagina[RascunhoOut]):
    """Página de rascunhos, o editado por último primeiro (ver schemas/pagina.py)."""
