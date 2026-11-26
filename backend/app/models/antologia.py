from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datas import agora_utc
from app.db import Base
from app.models.user import User


class Antologia(Base):
    """Coleção curada de poemas de um leitor, como "Poemas de chuva"."""

    __tablename__ = "antologias"

    id: Mapped[int] = mapped_column(primary_key=True)
    dono_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    nome: Mapped[str] = mapped_column(String(100))
    descricao: Mapped[str | None] = mapped_column(Text, default=None)
    # Privada só existe para o dono: para os outros, dá 404 (não revela que existe).
    publica: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc, index=True)

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
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)


class AntologiaRenga(Base):
    """renga_id está na antologia_id, como o `AntologiaPoema` de um poema.

    Tabela nova, sem coluna a mais em `antologia_poemas`. `posicao` segue a mesma
    numeração dos poemas da antologia (a próxima depois do maior dos dois), então a
    ordem de inserção vale para poemas e rengas juntos.
    """

    __tablename__ = "antologia_rengas"
    __table_args__ = (UniqueConstraint("antologia_id", "renga_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    antologia_id: Mapped[int] = mapped_column(ForeignKey("antologias.id"), index=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    posicao: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
