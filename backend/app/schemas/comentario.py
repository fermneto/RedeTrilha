from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.user import UserOut


class AncoraCreate(BaseModel):
    """Os versos criticados, base 1, contando as linhas de `texto.split("\\n")`
    do poema (linhas em branco incluídas). O service valida o intervalo."""

    verso_inicio: int
    verso_fim: int


class AncoraOut(BaseModel):
    """O trecho como estava ao comentar. `atual` é False quando o poema foi
    editado e aqueles versos não são mais esse trecho (a tela avisa e não
    marca o verso)."""

    verso_inicio: int
    verso_fim: int
    trecho: str
    atual: bool


class ComentarioCreate(BaseModel):
    texto: str
    parent_id: int | None = None
    # Só no 1º nível: as respostas herdam o trecho do comentário pai.
    ancora: AncoraCreate | None = None

    @field_validator("texto")
    @classmethod
    def _texto_nao_vazio(cls, texto: str) -> str:
        """Recusa comentário em branco sem alterar o texto: as quebras de linha ficam."""
        if not texto.strip():
            raise ValueError("o comentário não pode ficar vazio")
        return texto


class ComentarioOut(BaseModel):
    """Um comentário com a prévia das respostas.

    `respostas` traz só as primeiras (ver `PREVIA_RESPOSTAS` no service);
    `total_respostas` conta todas as respostas diretas. Removido: texto vazio
    e `autor` null.
    """

    id: int
    post_id: int
    texto: str
    autor: UserOut | None
    parent_id: int | None
    created_at: datetime
    removido: bool = False
    total_respostas: int = 0
    respostas: list["ComentarioOut"] = []
    ancora: AncoraOut | None = None


class ComentarioPage(BaseModel):
    """Página de respostas diretas, em ordem cronológica, paginada por cursor.

    `total` conta todas as respostas diretas; `proximo_cursor` é None no fim.
    """

    items: list[ComentarioOut]
    total: int
    limit: int
    proximo_cursor: str | None = None


class VersoComentado(BaseModel):
    verso: int
    comentarios: int


class VersosComentadosOut(BaseModel):
    """Os versos do poema atual com críticas ancoradas, em ordem de verso."""

    items: list[VersoComentado]


class ComentarioApagadoOut(BaseModel):
    """O que o DELETE fez, para o front não precisar perguntar de novo.

    `resultado` é "apagado" (sem respostas, saiu do banco) ou "removido" (tinha
    respostas e virou o marcador "comentário removido"). `total_respostas` é a
    contagem atual das respostas diretas (0 quando apagado).
    """

    resultado: Literal["apagado", "removido"]
    total_respostas: int
