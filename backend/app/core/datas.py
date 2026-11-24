"""Datas em UTC, em Python puro: usado pelo índice de tags, pelo cursor e pela tradução."""

from datetime import UTC, datetime


def para_utc(momento: datetime) -> datetime:
    """Datas sem fuso (o SQLite devolve naive) são tratadas como UTC.

    Assim naive e aware comparam sem TypeError.
    """
    if momento.tzinfo is None:
        return momento.replace(tzinfo=UTC)
    return momento.astimezone(UTC)
