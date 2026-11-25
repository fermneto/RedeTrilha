from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class Bloqueio(Base):
    """`bloqueador_id` bloqueou `bloqueado_id`, na rede inteira (services/bloqueios.py).
    O par é único."""

    __tablename__ = "bloqueios"
    # Os dois sentidos têm índice: "quem eu bloqueei" pelo par único e "quem me
    # bloqueou" pelo outro (services/bloqueios.ids_com_bloqueio, a cada feed).
    __table_args__ = (
        UniqueConstraint("bloqueador_id", "bloqueado_id"),
        Index("ix_bloqueios_bloqueado_bloqueador", "bloqueado_id", "bloqueador_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    bloqueador_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    bloqueado_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
