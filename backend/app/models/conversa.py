from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datas import agora_utc
from app.db import Base


class Conversa(Base):
    """Conversa de mensagens diretas entre duas pessoas (services/mensagens.py).

    Uma só por par: `menor_id` e `maior_id` são os dois ids em ordem, e o par é
    único, então abrir a conversa de novo (de qualquer um dos lados) acha a mesma.
    """

    __tablename__ = "conversas"
    __table_args__ = (
        UniqueConstraint("menor_id", "maior_id"),
        CheckConstraint("menor_id < maior_id", name="ck_conversas_par_em_ordem"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    menor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    maior_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=agora_utc)


# A caixa de cada pessoa (Conversas ou Pedidos) pela última atividade, e o resumo
# das não lidas, saem só deste índice: O(log n + página), sem ler as mensagens.
INDICE_DA_CAIXA = Index(
    "ix_participantes_da_caixa", "user_id", "situacao", "ultima_mensagem_id"
)


class ParticipanteConversa(Base):
    """O lado de cada pessoa numa conversa: onde ela aparece e até onde ela leu.

    - `situacao`: "caixa" (Conversas), "pedido" (de quem ela não segue, até
      aceitar) ou "recusada" (some da lista dela e não volta com mensagens novas).
    - `ultima_lida_id`: id da última mensagem que ela leu. A conversa tem não
      lidas quando `ultima_mensagem_id > ultima_lida_id`; o "visto" do outro lado
      é esse mesmo número.
    - `ultima_mensagem_id`: cópia do id da mensagem mais nova da conversa, igual
      nas duas linhas, gravada no envio. É a "última atividade" que ordena a caixa
      pelo índice acima. Ids crescem com o tempo, então ordenar por ele é ordenar
      pela data, sem empate.
    - `silenciada`: não conta no contador de não lidas.
    """

    __tablename__ = "participantes_conversa"
    __table_args__ = (INDICE_DA_CAIXA,)

    conversa_id: Mapped[int] = mapped_column(ForeignKey("conversas.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    situacao: Mapped[str] = mapped_column(String(10))
    ultima_lida_id: Mapped[int] = mapped_column(default=0)
    ultima_mensagem_id: Mapped[int | None] = mapped_column(default=None)
    silenciada: Mapped[bool] = mapped_column(default=False)
