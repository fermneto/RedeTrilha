from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.post import PostOut
from app.schemas.user import UserOut


class AntologiaCreate(BaseModel):
    nome: str = Field(max_length=100)
    descricao: str | None = Field(default=None, max_length=1000)

    @field_validator("nome")
    @classmethod
    def _nome_nao_vazio(cls, nome: str) -> str:
        if not nome.strip():
            raise ValueError("a antologia precisa de um nome")
        return nome


class AntologiaPoemaCreate(BaseModel):
    post_id: int


class AntologiaOut(BaseModel):
    id: int
    dono_id: int
    dono: UserOut
    nome: str
    descricao: str | None
    created_at: datetime
    qtd: int = 0


class AntologiaDetalhe(AntologiaOut):
    """A antologia com os poemas na ordem de inserção."""

    poemas: list[PostOut] = []


class AntologiaPage(BaseModel):
    """Página de antologias no padrão do projeto (ver UserPage)."""

    items: list[AntologiaOut]
    total: int
    offset: int
    limit: int
