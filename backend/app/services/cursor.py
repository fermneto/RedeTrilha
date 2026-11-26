"""Cursor opaco de paginação, como na API do X: a posição (data, id) do último
item entregue, em base64. Usado pelos comentários e pelos avisos; o feed usa o
`codificar_cursor_do_feed`, que também carrega o trecho do feed infinito e o
que a sessão já viu."""

import base64
import binascii
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from fastapi import HTTPException

from app.core.datas import para_utc
from app.core import continuacao as continuacao_core
from app.core.vistos import codificar as codificar_vistos
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


# Os trechos do feed infinito (ver `services/feed_infinito.py`). O cursor de cada
# um leva uma marca na frente; sem marca, é o trecho próprio da rota (o formato
# de antes, que continua valendo).
_MARCA_DO_TRECHO = {"para_voce": "pv", "continuacao": "mais"}
_TRECHO_DA_MARCA = {marca: trecho for trecho, marca in _MARCA_DO_TRECHO.items()}

Trecho = Literal["proprio", "para_voce", "continuacao"]


@dataclass(frozen=True)
class CursorDoFeed:
    """O cursor do feed lido: em que trecho a leitura está, a posição dentro dele
    (None = do começo do trecho), o que a sessão já viu e, na continuação, onde
    ela parou."""

    trecho: Trecho
    posicao: tuple[datetime, int] | None
    vistos: frozenset[tuple[str, int]]
    continuacao: continuacao_core.Estado | None = None


def codificar_cursor_do_feed(cursor: CursorDoFeed) -> str:
    """O cursor do feed (Seguindo, Para você e perfil): o trecho, a posição do
    último item entregue e o que a sessão já viu (`core/vistos.py`)."""
    vistos = codificar_vistos(cursor.vistos)
    if cursor.trecho == "continuacao":
        estado = cursor.continuacao or continuacao_core.Estado()
        prioridade, lingua, data, id_ = estado.ultimo_consagrado or ("", "", None, "")
        data_iso = utc_sem_fuso(data).isoformat() if data else ""
        partes = [
            "mais",
            estado.entregues,
            estado.curtidos,
            estado.rodada,
            prioridade,
            lingua,
            data_iso,
            id_,
            vistos,
        ]
    else:
        data_iso, chave = (
            (utc_sem_fuso(cursor.posicao[0]).isoformat(), cursor.posicao[1])
            if cursor.posicao
            else ("", "")
        )
        partes = [data_iso, chave, vistos]
        if cursor.trecho != "proprio":
            partes.insert(0, _MARCA_DO_TRECHO[cursor.trecho])
    bruto = "|".join(map(str, partes))
    return base64.urlsafe_b64encode(bruto.encode()).decode()


def ler_cursor_do_feed(cursor: str) -> CursorDoFeed:
    """O cursor do feed lido; malformado dá 422.

    O cursor de antes (só data e chave) continua valendo, sem nada visto: quem
    estava com o feed aberto no deploy não trava."""
    try:
        partes = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        trecho: Trecho = _TRECHO_DA_MARCA.get(partes[0], "proprio")
        if trecho == "continuacao":
            _, entregues, curtidos, rodada, prioridade, lingua, data, id_, vistos = partes
            ultimo = (
                (
                    int(prioridade),
                    int(lingua),
                    utc_sem_fuso(datetime.fromisoformat(data)),
                    int(id_),
                )
                if data
                else None
            )
            estado = continuacao_core.Estado(int(entregues), int(curtidos), int(rodada), ultimo)
            return CursorDoFeed(trecho, None, decodificar_vistos(vistos), estado)
        if trecho != "proprio":
            partes = partes[1:]
        if len(partes) == 2:
            partes.append("")
        data, chave, vistos = partes
        if data == "" and trecho == "proprio":
            raise ValueError(cursor)
        posicao = (utc_sem_fuso(datetime.fromisoformat(data)), int(chave)) if data else None
        return CursorDoFeed(trecho, posicao, decodificar_vistos(vistos))
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=422, detail="cursor inválido") from None
