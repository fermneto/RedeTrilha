from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datas import agora_utc
from app.db import Base
from app.models.user import User


class ComentarioRenga(Base):
    """Comentário numa renga, aberta ou fechada; espelha `comentarios` dos poemas.

    Tabela nova, e não `post_id` opcional em `comentarios`: o banco do deploy usa
    `create_all`, que cria tabelas novas mas não acrescenta colunas. Pelo mesmo
    motivo a âncora mora aqui (a tabela já nasce com ela), e não numa tabela à
    parte como `ancoras_comentario`.

    `verso_inicio`/`verso_fim` (os dois ou nenhum, só no 1º nível) contam as
    linhas do texto da renga, as estrofes em ordem separadas por uma linha em
    branco (`services/rengas.texto_de`), com as linhas em branco incluídas, como
    nos poemas. Estrofe só se acrescenta no fim e nunca se edita, então o número
    de um verso não muda quando a renga cresce.
    """

    __tablename__ = "comentarios_renga"
    # A página de comentários de uma renga sai do índice já ordenada, como nos poemas.
    __table_args__ = (
        Index("ix_comentarios_da_renga", "renga_id", "parent_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    texto: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comentarios_renga.id"), default=None, index=True
    )
    verso_inicio: Mapped[int | None] = mapped_column(default=None)
    verso_fim: Mapped[int | None] = mapped_column(default=None)
    removido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc, index=True)

    autor: Mapped[User] = relationship(lazy="joined")
