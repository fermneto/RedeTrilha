from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PostTag(Base):
    """O índice invertido de tags no banco: uma linha por (poema, tag).

    Gravada pelo services/indice_tags.py na mesma transação que publica ou
    apaga o poema. `criado_em` repete o `created_at` do poema (em UTC sem fuso)
    para ordenar e filtrar a janela do trending sem JOIN com `posts`.

    - chave primária (post_id, tag): sem tag repetida no poema, e o prefixo
      `post_id` é o índice que apagar e reindexar usam.
    - (tag, criado_em, post_id): os poemas de uma tag já na ordem da página.
    - (criado_em): o trending lê só as linhas das últimas 24 h.
    """

    __tablename__ = "post_tags"
    __table_args__ = (
        Index("ix_post_tags_tag_criado_em", "tag", "criado_em", "post_id"),
        Index("ix_post_tags_criado_em", "criado_em"),
    )

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), primary_key=True)
    tag: Mapped[str] = mapped_column(String(200), primary_key=True)
    criado_em: Mapped[datetime]
