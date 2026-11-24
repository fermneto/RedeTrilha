from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Post(Base):
    """Um poema. `texto` vazio só em repost puro; com `repost_de_id` e texto é citação."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    titulo: Mapped[str | None] = mapped_column(String(200), default=None)
    texto: Mapped[str] = mapped_column(Text, default="")
    forma: Mapped[str | None] = mapped_column(String(30), default=None, index=True)
    obra: Mapped[str | None] = mapped_column(String(200), default=None)
    ano: Mapped[int | None] = mapped_column(default=None)
    fonte: Mapped[str | None] = mapped_column(String(500), default=None)
    repost_de_id: Mapped[int | None] = mapped_column(
        ForeignKey("posts.id"), default=None, index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=_agora, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=_agora, onupdate=_agora)

    autor: Mapped[User] = relationship(lazy="joined")
    repost_de: Mapped["Post | None"] = relationship(remote_side=[id])
