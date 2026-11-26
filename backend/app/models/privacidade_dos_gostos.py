from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PrivacidadeDosGostos(Base):
    """O ajuste "mostrar meu lugar no perfil" (país e UF nos gostos públicos).

    Tabela nova, sem coluna a mais em `preferencias` (o `create_all` do Postgres de
    produção cria tabelas novas, mas não acrescenta coluna em tabela que já existe).
    Sem linha = o padrão, lugar público; só quem desliga ganha uma linha.
    """

    __tablename__ = "privacidade_dos_gostos"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    mostrar_lugar: Mapped[bool] = mapped_column(default=True)
