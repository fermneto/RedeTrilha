from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class Bloqueio(Base):
    """`bloqueador_id` bloqueou `bloqueado_id`: nenhum dos dois manda mensagem ao
    outro, e o bloqueado não abre conversa com quem o bloqueou. O par é único."""

    __tablename__ = "bloqueios"
    __table_args__ = (UniqueConstraint("bloqueador_id", "bloqueado_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bloqueador_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    bloqueado_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
