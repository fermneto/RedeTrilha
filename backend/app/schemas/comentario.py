from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.entrada import IdDeEntrada, Int4
from app.schemas.user import UserOut


class AncoraCreate(BaseModel):
    """Os versos criticados, base 1, contando as linhas de `texto.split("\\n")`
    do poema ou da renga (linhas em branco incluídas): a linha, não o número que o
    leitor vê, que conta só os versos (core/versos.py). O intervalo começa e
    termina em linha com texto; o service valida."""

    verso_inicio: Int4
    verso_fim: Int4


class AncoraOut(BaseModel):
    """Os versos criticados e o `trecho` deles, tirado do texto do poema."""

    verso_inicio: int
    verso_fim: int
    trecho: str


class ComentarioCreate(BaseModel):
    texto: str
    parent_id: IdDeEntrada | None = None
    # Só no 1º nível: as respostas herdam o trecho do comentário pai.
    ancora: AncoraCreate | None = None

    @field_validator("texto")
    @classmethod
    def _texto_nao_vazio(cls, texto: str) -> str:
        """Recusa comentário em branco sem alterar o texto: as quebras de linha ficam."""
        if not texto.strip():
            raise ValueError("o comentário não pode ficar vazio")
        return texto


class _ComentarioBase(BaseModel):
    """O comum aos comentários de poema e de renga.

    `respostas` (nas subclasses) traz só as primeiras (ver `PREVIA_RESPOSTAS`
    em services/arvore_de_comentarios.py); `total_respostas` conta todas as
    respostas diretas. Removido: texto vazio e `autor` null.
    """

    id: int
    texto: str
    autor: UserOut | None
    parent_id: int | None
    created_at: datetime
    removido: bool = False
    total_respostas: int = 0
    ancora: AncoraOut | None = None


class ComentarioOut(_ComentarioBase):
    """Um comentário num poema com a prévia das respostas."""

    post_id: int
    respostas: list["ComentarioOut"] = []


class ComentarioRengaOut(_ComentarioBase):
    """Um comentário numa renga, com a prévia das respostas; a âncora conta os
    versos do texto da renga (services/rengas.texto_de)."""

    renga_id: int
    respostas: list["ComentarioRengaOut"] = []


class ComentarioPage(BaseModel):
    """Página de respostas diretas, em ordem cronológica, paginada por cursor.

    `total` conta todas as respostas diretas; `proximo_cursor` é None no fim.
    """

    items: list[ComentarioOut]
    total: int
    limit: int
    proximo_cursor: str | None = None


class ComentarioRengaPage(BaseModel):
    """A `ComentarioPage` dos comentários de uma renga."""

    items: list[ComentarioRengaOut]
    total: int
    limit: int
    proximo_cursor: str | None = None


class VersoComentado(BaseModel):
    verso: int
    comentarios: int


class VersosComentadosOut(BaseModel):
    """Os versos do poema com críticas ancoradas, em ordem. `verso` é a linha, como
    na âncora; a linha em branco que um intervalo atravessa também conta, e o
    front não mostra marca nela."""

    items: list[VersoComentado]


class ComentarioApagadoOut(BaseModel):
    """O que o DELETE fez, para o front não precisar perguntar de novo.

    `resultado` é "apagado" (sem respostas, saiu do banco) ou "removido" (tinha
    respostas e virou o marcador "comentário removido"). `total_respostas` é a
    contagem atual das respostas diretas (0 quando apagado).
    """

    resultado: Literal["apagado", "removido"]
    total_respostas: int
