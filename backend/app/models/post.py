from datetime import datetime

from sqlalchemy import JSON, ColumnElement, ForeignKey, Index, String, Text, and_, text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datas import agora_utc
from app.db import Base
from app.models.user import User


# O contrário de `Post.repost_puro`, como o SQLAlchemy o escreve: o índice parcial
# só serve à consulta se o predicado for o mesmo.
_AUTORAL = "NOT (repost_de_id IS NOT NULL AND texto = '')"


class Post(Base):
    """Um poema. `texto` vazio só em repost puro; com `repost_de_id` e texto é citação."""

    __tablename__ = "posts"
    # Um repost puro por (autor, original), mesmo com chamadas simultâneas.
    # Parcial porque citações do mesmo original podem ser várias.
    __table_args__ = (
        Index(
            "uq_repost_puro",
            "autor_id",
            "repost_de_id",
            unique=True,
            sqlite_where=text("texto = ''"),
            postgresql_where=text("texto = ''"),
        ),
        # Desempenho (docs/deploy.md, "Índices"). Os poemas autorais (tudo menos o
        # repost puro) com as colunas que as agregações leem: as contagens de poemas
        # por autor (perfil, Acervo, sugestões), a língua por autor, o total do
        # Explorar e os consagrados do "Para você" viram Index Only Scan, sem ler
        # o texto dos 11 mil poemas. O predicado é o de `~Post.repost_puro`.
        Index(
            "ix_posts_autorais",
            "autor_id",
            "created_at",
            "id",
            sqlite_where=text(_AUTORAL),
            postgresql_where=text(_AUTORAL),
            postgresql_include=["idioma", "forma"],
        ),
        # Poema do dia: conta e percorre por id só os originais (sem repost).
        Index(
            "ix_posts_originais",
            "id",
            sqlite_where=text("repost_de_id IS NULL"),
            postgresql_where=text("repost_de_id IS NULL"),
            postgresql_include=["autor_id"],
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    titulo: Mapped[str | None] = mapped_column(String(200), default=None)
    texto: Mapped[str] = mapped_column(Text, default="")
    forma: Mapped[str | None] = mapped_column(String(30), default=None, index=True)
    obra: Mapped[str | None] = mapped_column(String(200), default=None)
    ano: Mapped[int | None] = mapped_column(default=None)
    fonte: Mapped[str | None] = mapped_column(String(500), default=None)
    # Código ISO 639-1 ("pt", "en", "zh"); None = língua desconhecida. O padrão
    # (IDIOMA_PADRAO) vem do PostCreate; o repost puro fica None e usa o do original.
    idioma: Mapped[str | None] = mapped_column(String(2), default=None)
    # Tags que vêm de fora do texto (os JSONs dos consagrados); somam-se às #hashtags.
    tags_extras: Mapped[list[str]] = mapped_column(JSON, default=list)
    repost_de_id: Mapped[int | None] = mapped_column(
        ForeignKey("posts.id"), default=None, index=True
    )
    # Citação cujo original foi apagado: o `repost_de_id` vira None e isto fica True.
    repost_removido: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=agora_utc, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=agora_utc, onupdate=agora_utc)

    autor: Mapped[User] = relationship(lazy="joined")
    repost_de: Mapped["Post | None"] = relationship(remote_side=[id])

    @hybrid_property
    def repost_puro(self) -> bool:
        return self.repost_de_id is not None and self.texto == ""

    @repost_puro.inplace.expression
    @classmethod
    def _repost_puro_sql(cls) -> ColumnElement[bool]:
        """A mesma regra nas queries: `Post.repost_puro` e `~Post.repost_puro`."""
        return and_(cls.repost_de_id.is_not(None), cls.texto == "")
