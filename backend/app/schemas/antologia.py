from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.pagina import Pagina
from app.schemas.post import PostOut
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut


def _validar_nome(nome: str | None) -> str:
    """Recusa nome em branco (ou null no PATCH) sem alterar o que veio."""
    if nome is None or not nome.strip():
        raise ValueError("a antologia precisa de um nome")
    return nome


def _validar_publica(publica: bool | None) -> bool:
    if publica is None:
        raise ValueError("publica deve ser true ou false")
    return publica


class AntologiaCreate(BaseModel):
    nome: str = Field(max_length=100)
    descricao: str | None = Field(default=None, max_length=1000)
    publica: bool = True

    _nome = field_validator("nome")(_validar_nome)


class AntologiaUpdate(BaseModel):
    """PATCH parcial: só os campos enviados mudam; `descricao` aceita null."""

    nome: str | None = Field(default=None, max_length=100)
    descricao: str | None = Field(default=None, max_length=1000)
    publica: bool | None = None

    _nome = field_validator("nome")(_validar_nome)
    _publica = field_validator("publica")(_validar_publica)


class AntologiaPoemaCreate(BaseModel):
    post_id: int


class AntologiaRengaCreate(BaseModel):
    renga_id: int


class AntologiaOut(BaseModel):
    id: int
    dono_id: int
    dono: UserOut
    nome: str
    descricao: str | None
    publica: bool
    created_at: datetime
    # Poemas e rengas (a renga conta como um poema).
    qtd: int = 0


class AntologiaDetalhe(AntologiaOut):
    """A antologia com os poemas e as rengas, cada lista na ordem de inserção."""

    poemas: list[PostOut] = []
    rengas: list[RengaDetalhe] = []


class AntologiaPage(Pagina[AntologiaOut]):
    """Página de antologias (ver schemas/pagina.py)."""


class AntologiaMarcada(AntologiaOut):
    """Uma das minhas antologias, dizendo se um poema (o `post_id` pedido) ou uma renga
    (o `renga_id`) está nela."""

    contem: bool


class AntologiaMarcadaPage(Pagina[AntologiaMarcada]):
    """GET /antologias?post_id= (ou ?renga_id=): a página de sempre, com `contem` em cada item."""
