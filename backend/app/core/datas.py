"""Datas em UTC, em Python puro: usado pelos models, pelo índice de tags, pelo cursor e pela tradução."""

from datetime import UTC, datetime


def para_utc(momento: datetime) -> datetime:
    """Datas sem fuso (o SQLite devolve naive) são tratadas como UTC.

    Assim naive e aware comparam sem TypeError.
    """
    if momento.tzinfo is None:
        return momento.replace(tzinfo=UTC)
    return momento.astimezone(UTC)


def agora_utc() -> datetime:
    """O momento atual em UTC: o default das colunas de data dos models."""
    return datetime.now(UTC)
