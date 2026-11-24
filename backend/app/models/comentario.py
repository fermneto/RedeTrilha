from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


class Comentario(Base):
    """Comentário num poema. Com `parent_id`, é resposta a outro comentário do mesmo poema."""

    __tablename__ = "comentarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    texto: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comentarios.id"), default=None, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )

    autor: Mapped[User] = relationship(lazy="joined")
