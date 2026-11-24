from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    TypeAdapter,
    ValidationError,
    field_validator,
)

# Nomes que colidem com rotas do front (/perfil, /explorar...) ou da API
# (/usuarios/eu, /usuarios/stats...). Lista única: o registro e o POST /usuarios usam.
USERNAMES_RESERVADOS = frozenset(
    {
        "eu", "stats", "admin", "verso", "perfil", "u", "login", "cadastro", "explorar",
        "escrever", "antologias", "usuarios", "poema", "poemas", "tags", "feed", "auth", "api",
    }
)

_URL_HTTP = TypeAdapter(HttpUrl)


def _username_livre(username: str) -> str:
    if username in USERNAMES_RESERVADOS:
        raise ValueError(f"o username \"{username}\" é reservado pelo Verso; escolha outro")
    return username


def _avatar_url_valida(url: str) -> str:
    """"" (sem foto) ou uma URL http(s). Guarda a URL como veio, sem normalizar."""
    if url == "":
        return url
    try:
        _URL_HTTP.validate_python(url)
    except ValidationError:
        raise ValueError("avatar_url deve ser vazia ou uma URL http(s) válida") from None
    return url


Username = Annotated[
    str,
    Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$"),
    AfterValidator(_username_livre),
]

AvatarUrl = Annotated[str, Field(max_length=300), AfterValidator(_avatar_url_valida)]


class UserCreate(BaseModel):
    username: Username
    name: str = Field(min_length=1, max_length=80)
    bio: str = Field(default="", max_length=1000)
    avatar_url: AvatarUrl = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    bio: str
    avatar_url: str
    consagrado: bool
    nascimento: int | None
    morte: int | None
    created_at: datetime


class PerfilOut(UserOut):
    """Perfil (`GET /usuarios/{username}`): o UserOut mais as contagens e se eu sigo."""

    seguidores: int
    seguindo: int
    # Poemas e citações da pessoa; reposts puros não contam.
    poemas: int
    sigo: bool


class PerfilUpdate(BaseModel):
    """PATCH /usuarios/eu: só os campos enviados mudam. Mesmos limites do UserCreate."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=1000)
    avatar_url: AvatarUrl | None = None

    # Só roda nos campos enviados: mandar null de propósito é 422, não apaga.
    @field_validator("name", "bio", "avatar_url")
    @classmethod
    def nao_nulo(cls, valor: str | None) -> str:
        if valor is None:
            raise ValueError("não pode ser null; para limpar, envie \"\"")
        return valor


class UserPage(BaseModel):
    """Padrão de paginação do projeto: todo endpoint de listagem devolve isto."""

    items: list[UserOut]
    total: int
    offset: int
    limit: int
