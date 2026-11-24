from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.pagina import Pagina


class VersaoOut(BaseModel):
    """Uma versão anterior de um poema; `criada_em` é quando ela foi substituída."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    titulo: str | None
    texto: str
    forma: str | None
    criada_em: datetime


class VersaoPage(Pagina[VersaoOut]):
    """Versões anteriores de um poema, a mais recente primeiro (ver schemas/pagina.py)."""
