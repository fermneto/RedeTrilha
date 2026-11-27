import re
from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    HttpUrl,
    TypeAdapter,
    ValidationError,
    ValidationInfo,
    field_validator,
)

from app.core.limites import AVATAR_URL_MAX, BIO_MAX, NOME_MAX, USERNAME_MAX, USERNAME_MIN
from app.schemas.entrada import Entrada
from app.schemas.pagina import Pagina

# Nomes que colidem com rotas do front (/perfil, /explorar...) ou da API
# (/usuarios/eu...). Lista única: o registro, o seed e o importador usam.
USERNAMES_RESERVADOS = frozenset(
    {
        "eu", "stats", "admin", "verso", "perfil", "u", "login", "cadastro", "explorar",
        "escrever", "antologias", "usuarios", "poema", "poemas", "tags", "feed", "auth", "api",
    }
)

_URL_HTTP = TypeAdapter(HttpUrl)
_PADRAO_USERNAME = re.compile(rf"[a-z0-9_]{{{USERNAME_MIN},{USERNAME_MAX}}}")

# Os limites de cadastro e perfil (core/limites.py) ficam nos validadores, com as
# mensagens em português que o front mostra (o 422 do pydantic chega à tela pelo
# request() de lib/api.ts), e não em Field(max_length=...), que responde em inglês.


def _validar_username(username: str) -> str:
    if not _PADRAO_USERNAME.fullmatch(username):
        raise ValueError(
            f"o username precisa ter de {USERNAME_MIN} a {USERNAME_MAX} caracteres: "
            "letras minúsculas, números ou _"
        )
    if username in USERNAMES_RESERVADOS:
        raise ValueError(f"o username \"{username}\" é reservado pelo Verso; escolha outro")
    return username


def _validar_nome(nome: str) -> str:
    if not nome.strip() or len(nome) > NOME_MAX:
        raise ValueError(f"o nome é obrigatório e tem até {NOME_MAX} caracteres")
    return nome


def _validar_bio(bio: str) -> str:
    if len(bio) > BIO_MAX:
        raise ValueError(f"a bio tem até {BIO_MAX} caracteres")
    return bio


def _validar_avatar_url(url: str) -> str:
    """"" (sem foto) ou uma URL http(s). Guarda a URL como veio, sem normalizar."""
    if url == "":
        return url
    if len(url) > AVATAR_URL_MAX:
        raise ValueError(f"a avatar_url tem até {AVATAR_URL_MAX} caracteres")
    try:
        _URL_HTTP.validate_python(url)
    except ValidationError:
        raise ValueError("avatar_url deve ser vazia ou uma URL http(s) válida") from None
    return url


# Tipos compartilhados: RegistroIn, UserCreate, PerfilUpdate e Consagrado usam os mesmos.
Username = Annotated[str, AfterValidator(_validar_username)]
Nome = Annotated[str, AfterValidator(_validar_nome)]
Bio = Annotated[str, AfterValidator(_validar_bio)]
AvatarUrl = Annotated[str, AfterValidator(_validar_avatar_url)]


class UserCreate(Entrada):
    """Dados de um poeta do seed (scripts/seed.py), validados antes de ir ao banco."""

    username: Username
    name: Nome
    bio: Bio = ""
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


_ROTULOS = {"name": "o nome", "bio": "a bio", "avatar_url": "a avatar_url"}


class PerfilUpdate(Entrada):
    """PATCH /usuarios/eu: só os campos enviados mudam. Mesmos limites do UserCreate."""

    name: Nome | None = None
    bio: Bio | None = None
    avatar_url: AvatarUrl | None = None

    # Só roda nos campos enviados: mandar null de propósito é 422, não apaga.
    @field_validator("name", "bio", "avatar_url")
    @classmethod
    def nao_nulo(cls, valor: str | None, info: ValidationInfo) -> str:
        if valor is None:
            raise ValueError(f"{_ROTULOS[info.field_name]} não pode ser null")
        return valor


class UserPage(Pagina[UserOut]):
    """Página de usuários (ver schemas/pagina.py)."""
