from datetime import datetime, timezone

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    bio: Mapped[str] = mapped_column(String(1000), default="")
    avatar_url: Mapped[str] = mapped_column(String(300), default="")
    # None = conta sem login: os consagrados.
    password_hash: Mapped[str | None] = mapped_column(String(100), default=None)
    consagrado: Mapped[bool] = mapped_column(default=False)
    nascimento: Mapped[int | None] = mapped_column(default=None)
    morte: Mapped[int | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
