from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CitacaoRenga(Base):
    """O poema `post_id` cita a renga `renga_id`.

    A citação de poema é o `repost_de_id` do post; a renga não é post, então o
    vínculo fica numa tabela nova, como a âncora do comentário
    (`ancoras_comentario`): nenhuma coluna a mais em `posts`. O poema que cita é
    um poema comum (com texto), e um post cita um poema ou uma renga, nunca os dois.
    """

    __tablename__ = "citacoes_renga"

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), primary_key=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
