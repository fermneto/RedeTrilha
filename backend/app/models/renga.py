"""Renga: o poema colaborativo, escrito uma estrofe por vez por várias pessoas.

Três tabelas novas, sem coluna a mais nas antigas (o `create_all` do Postgres
de produção não acrescenta coluna em tabela que já existe).
"""

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datas import agora_utc
from app.db import Base
from app.models.user import User


class Renga(Base):
    """A renga em si. `fechada_em` nulo = aberta a estrofes novas."""

    __tablename__ = "rengas"

    id: Mapped[int] = mapped_column(primary_key=True)
    criador_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(200))
    # "aberta" (qualquer pessoa logada escreve) ou "convidados" (só os convidados e o criador).
    modo: Mapped[str] = mapped_column(String(20))
    limite: Mapped[int]
    # Preenchida ao atingir o limite ou quando o criador encerra.
    fechada_em: Mapped[datetime | None] = mapped_column(default=None, index=True)
    # Só quando o criador encerra (fechar pelo limite não preenche): é atividade
    # dele no feed ("fulano encerrou a renga").
    encerrada_em: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc, index=True)

    criador: Mapped[User] = relationship(lazy="joined")


class EstrofeRenga(Base):
    """Uma estrofe, na `posicao` dela (1 é a do criador).

    O par (renga, posição) é único: duas pessoas acrescentando ao mesmo tempo
    não gravam a mesma posição, e a que perde recebe 409.
    """

    __tablename__ = "estrofes_renga"
    __table_args__ = (UniqueConstraint("renga_id", "posicao"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    posicao: Mapped[int]
    # Sem limite e gravado como veio: as quebras e os recuos são do poema.
    texto: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)

    autor: Mapped[User] = relationship(lazy="joined")


class ConviteRenga(Base):
    """`user_id` pode escrever na renga `renga_id` (só no modo "convidados")."""

    __tablename__ = "convites_renga"
    __table_args__ = (UniqueConstraint("renga_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    renga_id: Mapped[int] = mapped_column(ForeignKey("rengas.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)

    usuario: Mapped[User] = relationship(lazy="joined")
