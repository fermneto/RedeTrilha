from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.limites import (
    RENGA_CONVIDADOS_MAX,
    RENGA_LIMITE_MAX,
    RENGA_LIMITE_MIN,
    RENGA_LIMITE_PADRAO,
    RENGA_TITULO_MAX,
)
from app.schemas.pagina import Pagina
from app.schemas.user import UserOut

MODOS_RENGA = ("aberta", "convidados")
Modo = Literal["aberta", "convidados"]


def _validar_estrofe(texto: str) -> str:
    """Recusa estrofe em branco sem alterar o texto: quebras e recuos são sagrados."""
    if not texto.strip():
        raise ValueError("a estrofe não pode ficar vazia")
    return texto


def _validar_titulo(titulo: str) -> str:
    if not titulo.strip():
        raise ValueError("a renga precisa de um título")
    return titulo


class RengaCreate(BaseModel):
    titulo: str = Field(max_length=RENGA_TITULO_MAX)
    primeira_estrofe: str
    modo: Modo = "aberta"
    limite: int = Field(default=RENGA_LIMITE_PADRAO, ge=RENGA_LIMITE_MIN, le=RENGA_LIMITE_MAX)
    # Usernames; só no modo "convidados". O criador sempre escreve.
    convidados: list[str] = Field(default=[], max_length=RENGA_CONVIDADOS_MAX)

    _titulo = field_validator("titulo")(_validar_titulo)
    _estrofe = field_validator("primeira_estrofe")(_validar_estrofe)

    @model_validator(mode="after")
    def convidados_so_no_modo_convidados(self) -> "RengaCreate":
        if self.modo == "aberta" and self.convidados:
            raise ValueError("convidados só valem no modo convidados")
        return self


class EstrofeCreate(BaseModel):
    texto: str

    _texto = field_validator("texto")(_validar_estrofe)


class ConvitesCreate(BaseModel):
    usernames: list[str] = Field(min_length=1, max_length=RENGA_CONVIDADOS_MAX)


class EstrofeOut(BaseModel):
    id: int
    posicao: int
    texto: str
    autor: UserOut
    created_at: datetime


class RengaOut(BaseModel):
    id: int
    titulo: str
    modo: Modo
    limite: int
    criador: UserOut
    fechada: bool
    fechada_em: datetime | None
    created_at: datetime
    qtd_estrofes: int
    # Cada autor uma vez, na ordem da primeira estrofe que escreveu.
    autores: list[UserOut]
    # Comentários e respostas na renga, como o `comentarios` dos poemas.
    comentarios: int = 0
    # Como no PostOut: curtidas, reposts (os puros e os poemas que citam a renga) e
    # se o usuário atual curtiu ou repostou.
    curtidas: int = 0
    reposts: int = 0
    curti: bool = False
    repostei: bool = False


class RengaDetalhe(RengaOut):
    """A renga com as estrofes em ordem e o que o usuário atual pode fazer."""

    estrofes: list[EstrofeOut]
    convidados: list[UserOut]
    posso_escrever: bool
    # Por que não pode escrever (null quando pode).
    motivo: str | None


class RengaPage(Pagina[RengaOut]):
    """Página de rengas (ver schemas/pagina.py)."""
