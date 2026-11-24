from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Antologia(Base):
    """Coleção curada de poemas de um leitor, como "Poemas de chuva"."""

    __tablename__ = "antologias"

    id: Mapped[int] = mapped_column(primary_key=True)
    dono_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    nome: Mapped[str] = mapped_column(String(100))
    descricao: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(default=_agora, index=True)

    dono: Mapped[User] = relationship(lazy="joined")


class AntologiaPoema(Base):
    """post_id está na antologia_id. O par é único: adicionar de novo não duplica.

    `posicao` guarda a ordem de inserção (e deixa espaço para reordenar depois).
    """

    __tablename__ = "antologia_poemas"
    __table_args__ = (UniqueConstraint("antologia_id", "post_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    antologia_id: Mapped[int] = mapped_column(ForeignKey("antologias.id"), index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    posicao: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=_agora)
