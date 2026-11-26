from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class CurtidaRenga(Base):
    """user_id curtiu a renga renga_id, como a `Curtida` de um poema.

    Tabela nova, sem coluna a mais nas antigas (o `create_all` de produção não
    acrescenta coluna em tabela que já existe). O par é único: curtir de novo não duplica.
    """

    __tablename__ = "curtidas_renga"
    __table_args__ = (UniqueConstraint("user_id", "renga_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
