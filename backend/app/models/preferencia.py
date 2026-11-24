from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Preferencia(Base):
    """O que a pessoa marcou no onboarding: escolas, formas e região, todas opcionais.

    Tabela nova, uma linha por usuário (o `create_all` do Postgres de produção não
    acrescenta coluna em tabela que já existe). Sem linha = nada marcado. Serve às
    sugestões de quem seguir, e as escolas marcadas são também as escolas do
    poeta comum.
    """

    __tablename__ = "preferencias"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # Códigos de ESCOLAS (schemas/escola.py) e de FORMAS (schemas/post.py).
    escolas: Mapped[list[str]] = mapped_column(JSON, default=list)
    formas: Mapped[list[str]] = mapped_column(JSON, default=list)
    # ISO 3166-1 alfa-2; a UF só com o Brasil.
    pais: Mapped[str | None] = mapped_column(String(2), default=None)
    uf: Mapped[str | None] = mapped_column(String(2), default=None)
    updated_at: Mapped[datetime] = mapped_column(default=_agora, onupdate=_agora)
