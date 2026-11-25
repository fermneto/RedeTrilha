from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datas import agora_utc
from app.db import Base
from app.models.user import User


class Aviso(Base):
    """Um aviso para `destinatario_id`: `ator_id` fez `tipo` (decisão 16).

    Tabela nova, sem coluna a mais nas antigas (o `create_all` de produção não
    acrescenta coluna em tabela que já existe). Uma linha por ação, para desfazer
    a ação apagar só o aviso dela; o agrupamento ("Ana e mais 3 curtiram") é
    feito na leitura (services/avisos.py).

    O alvo, conforme o tipo:

    - `curtida`, `repost`: `post_id` é o poema curtido ou repostado;
    - `citacao`: `post_id` é a citação (o poema novo de quem citou);
    - `comentario`, `critica`, `resposta` num poema: `post_id` e `comentario_id`
      (em `comentarios`);
    - `comentario`, `critica`, `resposta` numa renga: `renga_id` e
      `comentario_id` (em `comentarios_renga`); por isso `comentario_id` não tem
      chave estrangeira: aponta para uma das duas tabelas, e é o `renga_id` que diz qual;
    - `estrofe`: `renga_id` e `estrofe_id`;
    - `convite`: `renga_id`;
    - `seguidor`: só o ator.
    """

    __tablename__ = "avisos"
    __table_args__ = (
        # A lista (mais recentes primeiro) e o contador saem do índice da pessoa.
        Index("ix_avisos_destinatario", "destinatario_id", "created_at", "id"),
        Index("ix_avisos_nao_lidos", "destinatario_id", "lido"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    destinatario_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    tipo: Mapped[str] = mapped_column(String(20))
    ator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), default=None, index=True)
    renga_id: Mapped[int | None] = mapped_column(ForeignKey("rengas.id"), default=None)
    comentario_id: Mapped[int | None] = mapped_column(default=None, index=True)
    estrofe_id: Mapped[int | None] = mapped_column(ForeignKey("estrofes_renga.id"), default=None)
    lido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)

    ator: Mapped[User] = relationship(lazy="joined", foreign_keys=[ator_id])
