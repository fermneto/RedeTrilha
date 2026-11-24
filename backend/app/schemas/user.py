from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=80)
    bio: str = Field(default="", max_length=1000)
    avatar_url: str = Field(default="", max_length=300)


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
    avatar_url: str | None = Field(default=None, max_length=300)

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
