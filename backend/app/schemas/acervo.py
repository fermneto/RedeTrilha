"""Acervo: a lista navegável de todos os poetas, consagrados e poetas do Verso."""

from typing import Literal

from pydantic import BaseModel

from app.schemas.pagina import Pagina
from app.schemas.user import UserOut

Tipo = Literal["todos", "consagrados", "do_verso"]
Ordem = Literal["alfabetica", "seguidos", "poemas"]
# As chaves de FAIXAS_DE_EPOCA (services/acervo.py); um teste confere que batem.
ChaveEpoca = Literal["antiguidade", "idade_media", "xvi", "xvii", "xviii", "xix", "xx"]


class PoetaDoAcervo(UserOut):
    """Um cartão do Acervo: o UserOut mais as contagens do perfil e se eu sigo."""

    seguidores: int
    # Poemas e citações; reposts puros não contam (a mesma regra do PerfilOut).
    poemas: int
    sigo: bool


class AcervoPage(Pagina[PoetaDoAcervo]):
    """Página do Acervo (ver schemas/pagina.py)."""


class LinguaDoAcervo(BaseModel):
    # Código ISO 639-1; o front mostra o nome em português (Intl.DisplayNames).
    codigo: str
    poetas: int


class EpocaDoAcervo(BaseModel):
    chave: ChaveEpoca
    rotulo: str
    # Anos de morte da faixa, inclusive; None = sem limite (a Antiguidade não tem início).
    inicio: int | None
    fim: int
    poetas: int


class FiltrosDoAcervo(BaseModel):
    """GET /acervo/filtros: as opções dos selects de língua e época, com contagem."""

    linguas: list[LinguaDoAcervo]
    epocas: list[EpocaDoAcervo]
