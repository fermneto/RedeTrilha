"""Índice de formas e temas (#tags) dos poemas.

Python puro: a API passa só ids, strings e datas.

Esta versão fixa a interface do contrato (PLANO.md) para que o service de
posts já possa chamar `indexar` e `remover`. O índice invertido de verdade
(tag -> post_ids, com trending) entra na task N3 sem mudar as assinaturas.
"""

import re
import unicodedata
from datetime import datetime

_PADRAO_TAG = re.compile(r"#([a-z0-9_]+)")


def normalizar(texto: str) -> str:
    """casefold e sem acento: '#Solidão' e '#solidao' viram a mesma tag."""
    sem_acento = unicodedata.normalize("NFKD", texto.casefold())
    return "".join(c for c in sem_acento if not unicodedata.combining(c))


def extrair_tags(texto: str, forma: str | None) -> set[str]:
    """Tags do poema: as #hashtags do texto mais a forma (soneto, haicai...)."""
    tags = set(_PADRAO_TAG.findall(normalizar(texto)))
    if forma:
        tags.add(forma)
    return tags


class IndiceTags:
    """Interface do índice. Implementação real na N3."""

    def reconstruir(self, posts: list[tuple[int, set[str], datetime]]) -> None:
        """Chamado no startup com (post_id, tags, criado_em) de todos os posts."""

    def indexar(self, post_id: int, tags: set[str], criado_em: datetime) -> None:
        """Chamado ao criar ou editar um poema (editar reindexa)."""

    def remover(self, post_id: int) -> None:
        """Chamado ao apagar um poema."""

    def posts_da_tag(self, tag: str) -> list[int]:
        """Ids dos poemas com a tag, mais novo primeiro."""
        return []

    def trending(self, desde: datetime, k: int = 5) -> list[tuple[str, int]]:
        """Top k tags desde `desde`: maior contagem primeiro, empate alfabético."""
        return []


indice_tags = IndiceTags()
