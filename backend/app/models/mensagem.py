from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base
from app.models.conversa import Conversa

# As mensagens de uma conversa por cursor de id (`antes=` e `depois=`) e a
# contagem das não lidas (id acima da última lida): O(log n + página).
INDICE_DA_CONVERSA = Index("ix_mensagens_da_conversa", "conversa_id", "id")
# O limite de mensagens por minuto conta as da própria pessoa no último minuto.
INDICE_DO_LIMITE = Index("ix_mensagens_autor_id_created_at", "autor_id", "created_at")


class Mensagem(Base):
    """Uma mensagem direta. O texto é gravado como veio, com as quebras de linha.

    Pode levar um poema (`post_id`, já resolvido para o original se era repost
    puro). Se o poema for apagado, `post_id` vira None e `post_removido` fica
    True, como na citação: a tela mostra "poema removido pelo autor".
    """

    __tablename__ = "mensagens"
    __table_args__ = (INDICE_DA_CONVERSA, INDICE_DO_LIMITE)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Pela coluna, e não pelo nome: quem importa só a Mensagem (services/posts.py)
    # leva junto a tabela conversas para o create_all.
    conversa_id: Mapped[int] = mapped_column(ForeignKey(Conversa.id))
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    texto: Mapped[str] = mapped_column(Text, default="")
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), default=None, index=True)
    post_removido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)
