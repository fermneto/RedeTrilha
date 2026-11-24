from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AtributosConsagrado(Base):
    """Escolas e país de um consagrado, vindos do JSON dele (docs/consagrados.md).

    Tabela nova, uma linha por consagrado, gravada pelo importador (que a
    atualiza a cada reimportação). Sem linha = sem dados.
    """

    __tablename__ = "atributos_consagrado"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # Códigos de ESCOLAS (schemas/escola.py).
    escolas: Mapped[list[str]] = mapped_column(JSON, default=list)
    # ISO 3166-1 alfa-2 do país onde nasceu, nas fronteiras de hoje; None se não há como dizer.
    pais: Mapped[str | None] = mapped_column(String(2), default=None)
