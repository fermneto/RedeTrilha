"""Formato de importação dos consagrados (docs/consagrados.md).

Valida um JSON por poeta antes de qualquer gravação no banco. O texto dos
poemas é guardado exatamente como veio: quebras de linha e recuos são sagrados.
"""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.post import _validar_forma, _validar_texto
from app.schemas.user import AvatarUrl

ANO_LIMITE_DOMINIO_PUBLICO = 1955
PADRAO_TAG = re.compile(r"^[a-z0-9_]+$")


class PoemaConsagrado(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str | None = Field(default=None, max_length=200)
    texto: str
    forma: str | None = None
    obra: str | None = None
    ano: int | None = None
    fonte: str = Field(min_length=1)
    tags: list[str] = []

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)

    @field_validator("tags")
    @classmethod
    def _tags_no_padrao(cls, tags: list[str]) -> list[str]:
        for tag in tags:
            if not PADRAO_TAG.match(tag):
                raise ValueError(f"tag inválida {tag!r}: use só [a-z0-9_]")
        return tags


class Consagrado(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(pattern=r"^[a-z0-9_]{3,30}$")
    name: str = Field(min_length=1, max_length=80)
    bio: str = Field(default="", max_length=1000)
    avatar_url: AvatarUrl = ""
    nascimento: int | None = None
    morte: int
    poemas: list[PoemaConsagrado] = Field(min_length=1)

    @field_validator("morte")
    @classmethod
    def _em_dominio_publico(cls, morte: int) -> int:
        if morte > ANO_LIMITE_DOMINIO_PUBLICO:
            raise ValueError(
                f"morte em {morte}: só entram autores mortos até "
                f"{ANO_LIMITE_DOMINIO_PUBLICO} (domínio público no Brasil)"
            )
        return morte

    @model_validator(mode="after")
    def _nasceu_antes_de_morrer(self) -> "Consagrado":
        if self.nascimento is not None and self.nascimento >= self.morte:
            raise ValueError(
                f"nascimento ({self.nascimento}) deve ser anterior à morte ({self.morte})"
            )
        return self

    @model_validator(mode="after")
    def _poemas_sem_repeticao(self) -> "Consagrado":
        """(titulo, obra) identifica o poema na importação: repetido, um sobrescreveria o outro."""
        vistos: set[tuple[str | None, str | None]] = set()
        for poema in self.poemas:
            chave = (poema.titulo, poema.obra)
            if chave in vistos:
                raise ValueError(f"poema repetido: titulo={poema.titulo!r}, obra={poema.obra!r}")
            vistos.add(chave)
        return self
