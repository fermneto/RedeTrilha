"""Cursor opaco de paginação, como na API do X: a posição (data, id) do último
item entregue, em base64. Usado pelo feed e pelos comentários."""

import base64
import binascii
from datetime import datetime

from fastapi import HTTPException

from app.core.datas import para_utc


def codificar_cursor(data: datetime, id_: int) -> str:
    bruto = f"{utc_sem_fuso(data).isoformat()}|{id_}"
    return base64.urlsafe_b64encode(bruto.encode()).decode()


def ler_cursor(cursor: str) -> tuple[datetime, int]:
    """Posição (data em UTC sem fuso, id) do cursor; cursor malformado dá 422."""
    try:
        data, id_ = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return (utc_sem_fuso(datetime.fromisoformat(data)), int(id_))
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=422, detail="cursor inválido") from None


def utc_sem_fuso(data: datetime) -> datetime:
    """O SQLite devolve datas sem fuso; o cursor compara tudo em UTC sem fuso."""
    return para_utc(data).replace(tzinfo=None)
