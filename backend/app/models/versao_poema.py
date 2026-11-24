from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class VersaoPoema(Base):
    """Como um poema publicado era antes de uma edição. Só o autor vê o histórico.

    `criada_em` é o momento da edição que substituiu esta versão. Existir uma
    versão é o que marca o poema como "editado" no PostOut (e não o `updated_at`
    do Post, que também muda quando o original de uma citação é apagado).
    """

    __tablename__ = "versoes_poema"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    titulo: Mapped[str | None] = mapped_column(String(200), default=None)
    texto: Mapped[str] = mapped_column(Text)
    forma: Mapped[str | None] = mapped_column(String(30), default=None)
    criada_em: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
