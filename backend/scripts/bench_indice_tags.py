"""Bench do índice de tags (core/indice_tags.py) contra uma varredura linear.

Rode com: make bench. Python puro, sem banco: a mesma massa sintética (posts com
tags sorteadas de um vocabulário fixo, semente fixa) alimenta o índice invertido
e uma lista simples de (post_id, tags, criado_em), e o timeit mede as duas
consultas da API:

- posts_da_tag: o índice vai direto ao dict da tag e ordena só os p posts dela;
  a varredura olha os n posts e ordena os que casam.
- trending (janela de 24 h): os dois percorrem os posts e contam as tags; o
  índice pega o top 5 num heap de tamanho k, a varredura ordena todas as tags.

Cada tempo é a mediana de REPETICOES rodadas (cada rodada repete a consulta
algumas vezes e divide). O ganho é varredura / índice.
"""

import random
import statistics
import sys
import timeit
from collections import Counter
from datetime import UTC, datetime, timedelta
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.indice_tags import IndiceTags, normalizar

SEMENTE = 2026
TAMANHOS = (1_000, 10_000, 100_000)
VOCABULARIO = [f"tema{i:02d}" for i in range(60)] + [
    "soneto", "haicai", "trova", "quadra", "cordel", "verso_livre", "prosa_poetica",
]
TAGS_POR_POST = (1, 4)
DIAS_DE_HISTORIA = 14
TAG_CONSULTADA = "tema07"
REPETICOES = 7

Post = tuple[int, frozenset[str], datetime]


def massa(n: int, agora: datetime) -> list[Post]:
    rng = random.Random(SEMENTE)
    return [
        (
            post_id,
            frozenset(rng.sample(VOCABULARIO, rng.randint(*TAGS_POR_POST))),
            agora - timedelta(seconds=rng.uniform(0, DIAS_DE_HISTORIA * 86_400)),
        )
        for post_id in range(1, n + 1)
    ]


def varredura_posts_da_tag(posts: list[Post], tag: str) -> list[int]:
    alvo = normalizar(tag)
    achados = [(criado_em, post_id) for post_id, tags, criado_em in posts if alvo in tags]
    return [post_id for _, post_id in sorted(achados, reverse=True)]


def varredura_trending(posts: list[Post], desde: datetime, k: int = 5) -> list[tuple[str, int]]:
    contagem: Counter[str] = Counter()
    for _, tags, criado_em in posts:
        if criado_em >= desde:
            contagem.update(tags)
    return sorted(contagem.items(), key=lambda par: (-par[1], par[0]))[:k]


def mediana_ms(funcao) -> float:
    vezes, _ = timeit.Timer(funcao).autorange()
    rodadas = timeit.repeat(funcao, number=vezes, repeat=REPETICOES)
    return statistics.median(rodadas) / vezes * 1000


def main() -> None:
    agora = datetime(2026, 11, 24, 12, tzinfo=UTC)
    desde = agora - timedelta(hours=24)
    print("bench_indice_tags: índice invertido (core/indice_tags.py) x varredura linear")
    print(
        f"massa: {len(VOCABULARIO)} tags no vocabulário, {TAGS_POR_POST[0]} a "
        f"{TAGS_POR_POST[1]} por post, {DIAS_DE_HISTORIA} dias, semente {SEMENTE}; "
        f"mediana de {REPETICOES} rodadas\n"
    )
    cabecalho = (
        f"{'posts':>8} | {'consulta':<12} | {'resultado':>9} | {'índice (ms)':>12} | "
        f"{'varredura (ms)':>14} | {'ganho':>7}"
    )
    print(cabecalho)
    print("-" * len(cabecalho))
    for n in TAMANHOS:
        posts = massa(n, agora)
        indice = IndiceTags()
        indice.reconstruir([(post_id, set(tags), criado_em) for post_id, tags, criado_em in posts])

        assert indice.posts_da_tag(TAG_CONSULTADA) == varredura_posts_da_tag(posts, TAG_CONSULTADA)
        assert indice.trending(desde) == varredura_trending(posts, desde)

        resultados = {
            "posts_da_tag": f"{len(indice.posts_da_tag(TAG_CONSULTADA))} ids",
            "trending": "top 5",
        }
        consultas = {
            "posts_da_tag": (
                partial(indice.posts_da_tag, TAG_CONSULTADA),
                partial(varredura_posts_da_tag, posts, TAG_CONSULTADA),
            ),
            "trending": (
                partial(indice.trending, desde),
                partial(varredura_trending, posts, desde),
            ),
        }
        for nome, (com_indice, com_varredura) in consultas.items():
            t_indice = mediana_ms(com_indice)
            t_varredura = mediana_ms(com_varredura)
            print(
                f"{n:>8} | {nome:<12} | {resultados[nome]:>9} | {t_indice:>12.3f} | "
                f"{t_varredura:>14.3f} | {t_varredura / t_indice:>6.1f}x"
            )


if __name__ == "__main__":
    main()
