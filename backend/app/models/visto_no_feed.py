from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class VistoNoFeed(Base):
    """O poema ou a renga que a pessoa já viu no feed, entre uma sessão e outra.

    Tabela nova, sem coluna a mais nas antigas (o `create_all` de produção não
    acrescenta coluna em tabela que já existe). Uma linha por (pessoa, item): a
    chave primária composta é o único índice, serve à leitura ("o que ela já
    viu", pelo prefixo `user_id`) e ao `NOT EXISTS` da continuação, e faz marcar
    de novo não duplicar. Por isso a tabela cresce no máximo até pessoas × itens
    da rede, e cada pessoa, até o número de poemas e rengas que existem.

    `alvo_id` é o id do poema (`tipo` "poema") ou da renga ("renga"), sem chave
    estrangeira porque aponta para duas tabelas; um item apagado deixa a linha
    órfã, que não atrapalha (não casa com nada).
    """

    __tablename__ = "vistos_no_feed"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(5), primary_key=True)
    alvo_id: Mapped[int] = mapped_column(primary_key=True)
    visto_em: Mapped[datetime] = mapped_column(default=agora_utc)
