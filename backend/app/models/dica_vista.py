from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class DicaVista(Base):
    """Uma dica do livro que a pessoa já viu e dispensou (uma linha por dica).

    Tabela nova, sem coluna a mais nas antigas (o `create_all` do Postgres de
    produção não acrescenta coluna em tabela que já existe). Fica na conta, e não
    no navegador, para a dica vista no computador não voltar no celular. Sem
    linha = dica ainda não vista; "rever as dicas" apaga as linhas da pessoa.
    """

    __tablename__ = "dicas_vistas"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # Um de DICAS (schemas/dica.py).
    dica: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
