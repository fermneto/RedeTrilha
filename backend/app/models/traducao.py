from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Traducao(Base):
    """Cache da tradução de um poema para uma língua: uma chamada à API por (poema, língua)."""

    __tablename__ = "traducoes"
    __table_args__ = (UniqueConstraint("post_id", "idioma_destino"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    # Código ISO 639-1 da língua de destino.
    idioma_destino: Mapped[str] = mapped_column(String(2))
    titulo: Mapped[str | None] = mapped_column(String(500), default=None)
    texto: Mapped[str] = mapped_column(Text)
    # Modelo que traduziu, para saber o que refazer se o modelo mudar.
    modelo: Mapped[str] = mapped_column(String(100))
    # Quem pediu a tradução nova: reconstrói o limite por usuário no startup.
    pedida_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), default=None, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(UTC)
    )
