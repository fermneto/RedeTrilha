from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class Traducao(Base):
    """Cache da tradução de um poema para uma língua: uma chamada à API por (poema, língua)."""

    __tablename__ = "traducoes"
    __table_args__ = (
        UniqueConstraint("post_id", "idioma_destino"),
        # O limite de traduções por hora conta direto aqui (services/traducao.py).
        # Banco já existente: CREATE INDEX manual (docs/deploy.md).
        Index("ix_traducoes_pedida_por_id_created_at", "pedida_por_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    # Código ISO 639-1 da língua de destino.
    idioma_destino: Mapped[str] = mapped_column(String(2))
    titulo: Mapped[str | None] = mapped_column(String(500), default=None)
    texto: Mapped[str] = mapped_column(Text)
    # Modelo que traduziu, para saber o que refazer se o modelo mudar.
    modelo: Mapped[str] = mapped_column(String(100))
    # Quem pediu a tradução nova: o limite por usuário conta por aqui.
    pedida_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
