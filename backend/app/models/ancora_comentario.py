from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AncoraComentario(Base):
    """Os versos que um comentário de 1º nível critica.

    Tabela própria, e não colunas em `comentarios`: o banco do deploy usa
    `create_all`, que cria tabelas novas mas não acrescenta colunas.

    Os versos contam as linhas de `texto.split("\\n")` do poema, a partir de 1,
    com as linhas em branco entre estrofes incluídas. `trecho` guarda essas
    linhas como estavam no momento do comentário, para a crítica sobreviver a
    uma edição do poema.
    """

    __tablename__ = "ancoras_comentario"

    comentario_id: Mapped[int] = mapped_column(ForeignKey("comentarios.id"), primary_key=True)
    verso_inicio: Mapped[int]
    verso_fim: Mapped[int]
    trecho: Mapped[str] = mapped_column(Text)
