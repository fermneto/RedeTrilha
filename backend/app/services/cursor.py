"""Cursor opaco de paginação, como na API do X: a posição (data, id) do último
item entregue, em base64. Usado pelos comentários e pelos avisos; o feed usa o
`codificar_cursor_do_feed`, que também carrega o que a sessão já viu."""

import base64
import binascii
from datetime import datetime

from fastapi import HTTPException

from app.core.datas import para_utc
from app.core.vistos import decodificar as decodificar_vistos


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


def codificar_cursor_do_feed(data: datetime, chave: int, vistos: str) -> str:
    """O cursor do feed (Seguindo, Para você e perfil): a posição do último item
    entregue mais o que a sessão já viu (`core/vistos.py`, já codificado)."""
    bruto = f"{utc_sem_fuso(data).isoformat()}|{chave}|{vistos}"
    return base64.urlsafe_b64encode(bruto.encode()).decode()


def ler_cursor_do_feed(cursor: str) -> tuple[tuple[datetime, int], frozenset[tuple[str, int]]]:
    """Posição e itens já vistos do cursor do feed; malformado dá 422.

    O cursor de antes (só data e chave) continua valendo, sem nada visto: quem
    estava com o feed aberto no deploy não trava."""
    try:
        partes = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        if len(partes) == 2:
            partes.append("")
        data, chave, vistos = partes
        posicao = (utc_sem_fuso(datetime.fromisoformat(data)), int(chave))
        return posicao, decodificar_vistos(vistos)
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=422, detail="cursor inválido") from None
