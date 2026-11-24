from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class Follow(Base):
    """seguidor_id segue seguido_id. O par é único: seguir de novo não duplica."""

    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("seguidor_id", "seguido_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    seguidor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    seguido_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
