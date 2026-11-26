from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class RepostRenga(Base):
    """user_id repostou a renga renga_id: o repost puro de uma renga.

    O repost de poema é um `Post` de texto vazio; a renga não é post, então o
    repost dela fica numa tabela nova (sem coluna a mais nas antigas). Um por
    (usuário, renga): repostar de novo não duplica. A data sobe a renga no feed de
    quem segue quem repostou.
    """

    __tablename__ = "reposts_renga"
    __table_args__ = (UniqueConstraint("user_id", "renga_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
