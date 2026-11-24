"""Índice de formas e temas (#tags) dos poemas.

Python puro: a API passa só ids, strings e datas.

Índice invertido em memória: tag -> {post_id: criado_em}, mais o inverso
post_id -> (tags, criado_em) para remover e reindexar sem varrer as tags.
O service de posts chama `indexar` ao criar ou editar e `remover` ao apagar;
o lifespan chama `reconstruir` com todos os posts do banco.
"""

import heapq
import re
import unicodedata
from collections import Counter
from datetime import datetime

from app.core.datas import para_utc

_PADRAO_TAG = re.compile(r"#([a-z0-9_]+)")
# "outro" é a forma de quem não tem forma: virar tag só juntaria poemas sem nada em comum.
FORMA_SEM_TAG = "outro"


def normalizar(texto: str) -> str:
    """casefold e sem acento: '#Solidão' e '#solidao' viram a mesma tag."""
    sem_acento = unicodedata.normalize("NFKD", texto.casefold())
    return "".join(c for c in sem_acento if not unicodedata.combining(c))


def extrair_tags(texto: str, forma: str | None) -> set[str]:
    """Tags do poema: as #hashtags do texto mais a forma (soneto, haicai...), menos "outro"."""
    tags = set(_PADRAO_TAG.findall(normalizar(texto)))
    if forma and forma != FORMA_SEM_TAG:
        tags.add(forma)
    return tags


class IndiceTags:
    """Índice invertido tag -> posts.

    - indexar/remover: O(t), t = tags do post (lookups em hash)
    - posts_da_tag: O(p log p), p = posts da tag (ordena na leitura)
    - trending: O(n·t + m log k), n = posts indexados, m = tags distintas na janela
    - reconstruir do zero: O(n·t), por isso só acontece no startup
    """

    def __init__(self) -> None:
        self._por_tag: dict[str, dict[int, datetime]] = {}
        self._por_post: dict[int, tuple[frozenset[str], datetime]] = {}

    def reconstruir(self, posts: list[tuple[int, set[str], datetime]]) -> None:
        """Chamado no startup com (post_id, tags, criado_em) de todos os posts. O(n·t)."""
        self._por_tag = {}
        self._por_post = {}
        for post_id, tags, criado_em in posts:
            self.indexar(post_id, tags, criado_em)

    def indexar(self, post_id: int, tags: set[str], criado_em: datetime) -> None:
        """Chamado ao criar ou editar um poema. O(t).

        Editar reindexa: as tags antigas saem antes de as novas entrarem.
        """
        self.remover(post_id)
        normalizadas = frozenset(n for n in (normalizar(t) for t in tags) if n)
        momento = para_utc(criado_em)
        self._por_post[post_id] = (normalizadas, momento)
        for tag in normalizadas:
            self._por_tag.setdefault(tag, {})[post_id] = momento

    def remover(self, post_id: int) -> None:
        """Chamado ao apagar um poema. O(t). Post não indexado é ignorado."""
        registro = self._por_post.pop(post_id, None)
        if registro is None:
            return
        for tag in registro[0]:
            posts = self._por_tag[tag]
            del posts[post_id]
            if not posts:
                del self._por_tag[tag]

    def posts_da_tag(self, tag: str) -> list[int]:
        """Ids dos poemas com a tag, mais novo primeiro. O(p log p).

        Empate de data: maior id primeiro. A tag passa por `normalizar`,
        então 'Solidão' acha 'solidao'.
        """
        posts = self._por_tag.get(normalizar(tag), {})
        return [
            post_id
            for post_id, _ in sorted(
                posts.items(), key=lambda par: (par[1], par[0]), reverse=True
            )
        ]

    def trending(self, desde: datetime, k: int = 5) -> list[tuple[str, int]]:
        """Top k tags dos posts com criado_em >= desde. O(n·t + m log k).

        Maior contagem primeiro, empate alfabético. O heap de tamanho k
        (nsmallest) evita ordenar as m tags inteiras.
        """
        inicio = para_utc(desde)
        contagem: Counter[str] = Counter()
        for tags, criado_em in self._por_post.values():
            if criado_em >= inicio:
                contagem.update(tags)
        return heapq.nsmallest(k, contagem.items(), key=lambda par: (-par[1], par[0]))


indice_tags = IndiceTags()
