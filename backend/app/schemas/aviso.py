from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserOut

TipoDeAviso = Literal[
    "curtida",
    "seguidor",
    "repost",
    "citacao",
    "comentario",
    "critica",
    "resposta",
    "estrofe",
    "convite",
]


class AvisoOut(BaseModel):
    """Uma linha da tela de avisos. Curtidas e reposts do mesmo poema vêm numa só.

    `atores` traz os dois mais recentes; `total_atores` conta todos (a frase
    "Ana e mais 3 curtiram"). `id` e `created_at` são os do aviso mais recente da
    linha, e `lido` só é verdadeiro se todos os avisos dela foram lidos.

    `titulo` é o do poema ou da renga; `trecho`, a primeira linha do que o aviso
    mostra (o poema, a citação, o comentário ou a estrofe). Na crítica,
    `verso_inicio` e `verso_fim` dão o `?versos=` do link.
    """

    id: int
    tipo: TipoDeAviso
    created_at: datetime
    lido: bool
    atores: list[UserOut]
    total_atores: int
    post_id: int | None = None
    renga_id: int | None = None
    comentario_id: int | None = None
    titulo: str | None = None
    trecho: str = ""
    verso_inicio: int | None = None
    verso_fim: int | None = None


class AvisoPage(BaseModel):
    """Página por cursor, como o feed: `proximo_cursor` null na última."""

    items: list[AvisoOut]
    limit: int
    proximo_cursor: str | None = None


class ResumoDeAvisos(BaseModel):
    """O contador da navegação: linhas da tela com aviso não lido."""

    nao_lidos: int


class LeituraDeAvisos(BaseModel):
    """Marca como lidos os avisos até `ate` (o id mais recente que a tela mostrou);
    sem `ate`, todos até agora."""

    ate: int | None = None
