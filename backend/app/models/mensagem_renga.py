from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mensagem import Mensagem


class MensagemRenga(Base):
    """A mensagem `mensagem_id` leva a renga `renga_id`, como o `post_id` leva um poema.

    Tabela nova, sem coluna a mais em `mensagens` (o `create_all` de produção não
    acrescenta coluna em tabela que já existe). Renga não se apaga, então não há
    "renga removida".
    """

    __tablename__ = "mensagens_renga"

    mensagem_id: Mapped[int] = mapped_column(ForeignKey(Mensagem.id), primary_key=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
