from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AncoraComentario(Base):
    """Os versos que um comentário de 1º nível critica.

    Tabela própria, e não colunas em `comentarios`: o banco do deploy usa
    `create_all`, que cria tabelas novas mas não acrescenta colunas.

    Os versos contam as linhas de `texto.split("\\n")` do poema, a partir de 1,
    com as linhas em branco entre estrofes incluídas. O número que o leitor vê
    conta só os versos e sai daqui (core/versos.py), sem mudar o que está gravado.
    O trecho não é gravado:
    poema publicado não se edita, então ele sai sempre do texto do poema.
    """

    __tablename__ = "ancoras_comentario"

    comentario_id: Mapped[int] = mapped_column(ForeignKey("comentarios.id"), primary_key=True)
    verso_inicio: Mapped[int]
    verso_fim: Mapped[int]
