from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Rascunho(Base):
    """Poema ainda não publicado, visível só para o autor.

    Tabela separada de `posts` de propósito: nenhuma consulta de poemas (feed,
    perfil, Explorar, tags, antologias) enxerga um rascunho sem ser alterada.
    Publicar cria o Post e apaga o rascunho (services/rascunhos.py).
    """

    __tablename__ = "rascunhos"

    id: Mapped[int] = mapped_column(primary_key=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    titulo: Mapped[str | None] = mapped_column(String(200), default=None)
    texto: Mapped[str] = mapped_column(Text)
    forma: Mapped[str | None] = mapped_column(String(30), default=None)
    idioma: Mapped[str | None] = mapped_column(String(2), default=None)
    # Rascunho de citação: o poema citado (já resolvido para o original, se era
    # repost puro). Se ele for apagado antes da publicação, vira None e
    # `repost_removido` fica True, como na citação publicada.
    repost_de_id: Mapped[int | None] = mapped_column(
        ForeignKey("posts.id"), default=None, index=True
    )
    repost_removido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_agora)
    updated_at: Mapped[datetime] = mapped_column(default=_agora, onupdate=_agora, index=True)
