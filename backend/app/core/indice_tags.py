"""Índice de formas e temas (#tags) dos poemas: a lógica, em Python puro.

O índice invertido em si (tag -> poemas) mora no banco, na tabela `post_tags`
(models/post_tag.py), para valer igual em todos os workers e instâncias da API.
Aqui fica o que é regra e estrutura de dados, sem banco:

- `normalizar` / `termo_de_tag` / `extrair_tags`: que tags um poema tem.
- `chave_da_tag`: a tag como a busca a compara, sem o "_" (#versolivre acha verso_livre).
- `top_k`: as k tags mais contadas, com um heap de tamanho k.
- `representantes`: um poema diferente por tag, para o trecho do "Em alta".

O services/indice_tags.py lê as linhas do banco e chama estas funções.
"""

import heapq
import re
from collections.abc import Iterable
from datetime import datetime

from app.core.datas import para_utc
from app.core.marcas import texto_sem_marcas
from app.core.texto import sem_acento

_PADRAO_TAG = re.compile(r"#([a-z0-9_]+)")
_FORA_DA_TAG = re.compile(r"[^a-z0-9_]")
# "outro" é a forma de quem não tem forma: virar tag só juntaria poemas sem nada em comum.
FORMA_SEM_TAG = "outro"


def normalizar(texto: str) -> str:
    """casefold e sem acento: '#Solidão' e '#solidao' viram a mesma tag."""
    return sem_acento(texto.casefold())


def termo_de_tag(texto: str) -> str:
    """O que a pessoa digitou na busca, como tag: '#Saudade!' vira 'saudade'."""
    return _FORA_DA_TAG.sub("", normalizar(texto))


def chave_da_tag(texto: str) -> str:
    """A tag como a busca a compara: o termo sem o "_".

    A tela mostra #verso_livre como #versolivre, então digitar uma ou outra
    acha a mesma tag. O valor guardado continua com o "_"; tags que só diferem
    pelo "_" (noite_fria e noitefria) viram a mesma chave e a busca traz as duas.
    """
    return termo_de_tag(texto).replace("_", "")


def extrair_tags(texto: str, forma: str | None) -> set[str]:
    """Tags do poema: as #hashtags do texto mais a forma (soneto, haicai...), menos "outro".

    Lidas no texto sem as marcas de formatação: `**#mar**` é a tag `mar`.
    """
    tags = set(_PADRAO_TAG.findall(normalizar(texto_sem_marcas(texto))))
    if forma and forma != FORMA_SEM_TAG:
        tags.add(forma)
    return tags


def top_k(contagens: Iterable[tuple[str, int]], k: int) -> list[tuple[str, int]]:
    """As k tags mais contadas: maior contagem primeiro, empate alfabético.

    O(m log k) com m tags: `heapq.nsmallest` guarda só k candidatas num heap,
    sem ordenar as m inteiras. Usado pelo trending e pela busca.
    """
    return heapq.nsmallest(k, contagens, key=lambda par: (-par[1], par[0]))


def mais_recente(
    candidatos: Iterable[tuple[int, datetime]], evitar: frozenset[int] = frozenset()
) -> int | None:
    """Id do poema mais novo fora de `evitar` (empate de data: maior id). O(p).

    `candidatos` são (post_id, criado_em) de uma tag. Se todos estão em
    `evitar`, o mais novo mesmo; sem candidatos, None. Um max linear, sem ordenar.
    """
    todos = [(para_utc(criado_em), post_id) for post_id, criado_em in candidatos]
    livres = [par for par in todos if par[1] not in evitar] or todos
    return max(livres)[1] if livres else None


def representantes(
    candidatos: dict[str, list[tuple[int, datetime]]], tags: list[str]
) -> dict[str, int | None]:
    """Um poema por tag, na ordem dada, sem repetir o de uma tag de cima. O(Σp).

    Cada tag fica com o poema mais novo dela que ainda não apareceu; se todos
    já apareceram, com o mais novo mesmo. Basta passar os len(tags) poemas mais
    novos de cada tag: a i-ésima tag encontra no máximo i poemas já usados, então
    o mais novo livre dela está entre os i + 1 mais novos.
    """
    usados: set[int] = set()
    escolhidos: dict[str, int | None] = {}
    for tag in tags:
        post_id = mais_recente(candidatos.get(tag, ()), frozenset(usados))
        escolhidos[tag] = post_id
        if post_id is not None:
            usados.add(post_id)
    return escolhidos
