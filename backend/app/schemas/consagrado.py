"""Formato de importação dos consagrados (docs/consagrados.md).

Valida um JSON por poeta antes de qualquer gravação no banco. O texto dos
poemas é guardado exatamente como veio: quebras de linha e recuos são sagrados.
"""

import re
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.escola import validar_escolas
from app.schemas.idioma import IDIOMAS
from app.schemas.post import _validar_forma, _validar_texto
from app.schemas.regiao import validar_pais
from app.schemas.user import AvatarUrl, Bio, Nome, Username

ANO_LIMITE_DOMINIO_PUBLICO = 1955
PADRAO_TAG = re.compile(r"^[a-z0-9_]+$")
VERSOS_DO_SONETO = 14
# Cabeçalho de numeração na 1ª linha ("Sonnet LXXV", "Soneto XII", "Sonetto 3", "XIV"):
# romano bem formado (até MMMCMXCIX) ou arábico, opcionalmente depois de
# Sonnet/Soneto/Sonetto/Sonett/Sonet, com ponto final opcional. Não é verso, então não
# entra na contagem.
CABECALHO_DE_SONETO = re.compile(
    r"^\s*(?:(?:sonnet|soneto|sonetto|sonett|sonet)\s+)?"
    r"(?:\d+|(?=[mdclxvi])m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3}))"
    r"\.?\s*$",
    re.IGNORECASE,
)


def forma_coerente(forma: str | None, texto: str) -> str | None:
    """Só é soneto com 14 versos não vazios; senão a forma vira None (o texto não muda).

    Uma primeira linha que seja só o cabeçalho de numeração (CABECALHO_DE_SONETO)
    não conta como verso. O scraper marca como soneto canções, odes e poemas longos,
    e a forma alimenta a tag #soneto no índice.
    """
    if forma == "soneto":
        versos = [linha for linha in texto.split("\n") if linha.strip()]
        if versos and CABECALHO_DE_SONETO.match(versos[0]):
            versos = versos[1:]
        if len(versos) != VERSOS_DO_SONETO:
            return None
    return forma


def idioma_da_fonte(fonte: str | None) -> str | None:
    """Código ISO 639-1 do poema a partir do subdomínio da fonte; None se não houver.

    "https://pt.wikisource.org/wiki/..." → "pt"; "https://www.gutenberg.org/..." → None.
    """
    if not fonte:
        return None
    host = (urlsplit(fonte).hostname or "").lower()
    partes = host.split(".")
    # Subdomínio de língua dos projetos Wikimedia (pt.wikisource.org, ja.wikiquote.org).
    if len(partes) < 3 or partes[0] not in IDIOMAS:
        return None
    return partes[0]


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

    @model_validator(mode="after")
    def _soneto_so_com_14_versos(self) -> "PoemaConsagrado":
        self.forma = forma_coerente(self.forma, self.texto)
        return self


class Consagrado(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username
    name: Nome
    bio: Bio = ""
    avatar_url: AvatarUrl = ""
    nascimento: int | None = None
    morte: int
    # Opcionais: códigos de ESCOLAS (schemas/escola.py) e o país onde nasceu, nas
    # fronteiras de hoje (ISO 3166-1 alfa-2; null quando não há como dizer).
    escolas: list[str] = []
    pais: str | None = None
    poemas: list[PoemaConsagrado] = Field(min_length=1)

    _escolas = field_validator("escolas")(validar_escolas)
    _pais = field_validator("pais")(validar_pais)

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
