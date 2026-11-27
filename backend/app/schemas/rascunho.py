from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.limites import POEMA_TITULO_MAX
from app.schemas.entrada import Entrada, IdDeEntrada
from app.schemas.idioma import IDIOMA_PADRAO, validar_idioma
from app.schemas.pagina import Pagina
from app.schemas.post import validar_forma, validar_texto


class RascunhoCreate(Entrada):
    """Os campos do PostCreate: com `repost_de_id`, é o rascunho de uma citação."""

    titulo: str | None = Field(default=None, max_length=POEMA_TITULO_MAX)
    texto: str
    forma: str | None = None
    idioma: str | None = IDIOMA_PADRAO
    repost_de_id: IdDeEntrada | None = None

    _texto = field_validator("texto")(validar_texto)
    _forma = field_validator("forma")(validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)


class RascunhoUpdate(Entrada):
    """PATCH parcial: só os campos enviados mudam; `titulo`, `forma` e `idioma` aceitam null.

    O poema citado não muda: para citar outro, é outro rascunho.
    """

    titulo: str | None = Field(default=None, max_length=POEMA_TITULO_MAX)
    texto: str | None = None
    forma: str | None = None
    idioma: str | None = None

    _texto = field_validator("texto")(validar_texto)
    _forma = field_validator("forma")(validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)


class RascunhoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    autor_id: int
    titulo: str | None
    texto: str
    forma: str | None
    idioma: str | None
    repost_de_id: int | None
    # Citação cujo original foi apagado enquanto ela era rascunho.
    repost_removido: bool
    created_at: datetime
    updated_at: datetime


class RascunhoPage(Pagina[RascunhoOut]):
    """Página de rascunhos, o editado por último primeiro (ver schemas/pagina.py)."""
