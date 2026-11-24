"""Bench do índice de tags persistido (tabela `post_tags`) contra a varredura linear.

Rode com: make bench. Num SQLite local descartável (arquivo temporário), a mesma
massa sintética (posts com tags sorteadas de um vocabulário fixo, semente fixa)
vai para dois bancos com a tabela `post_tags` do models/post_tag.py:

- índice: a tabela como em produção, com os índices (tag, criado_em, post_id)
  e (criado_em);
- varredura: a mesma tabela sem esses índices, então cada consulta lê as R
  linhas inteiras.

Os dois lados rodam as MESMAS funções do services/indice_tags.py que a API usa
(antes, o script confere que devolvem o mesmo resultado), e o timeit mede:

- posts_da_tag: a primeira página (20 ids) e o total de uma tag;
- trending: as contagens das últimas 24 h e o top 5 no heap do core;
- busca: tags que começam por um prefixo (LIKE), que não usa índice no SQLite.

Cada tempo é a mediana de REPETICOES rodadas. O ganho é varredura / índice.
"""

import random
import statistics
import sys
import tempfile
import timeit
from datetime import UTC, datetime, timedelta
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, insert, text
from sqlalchemy.orm import Session

from app.models.post_tag import PostTag
from app.services import indice_tags

SEMENTE = 2026
TAMANHOS = (1_000, 10_000, 100_000)
VOCABULARIO = [f"tema{i:02d}" for i in range(60)] + [
    "soneto", "haicai", "trova", "quadra", "cordel", "verso_livre", "prosa_poetica",
]
TAGS_POR_POST = (1, 4)
DIAS_DE_HISTORIA = 14
TAG_CONSULTADA = "tema07"
PREFIXO_BUSCADO = "tema1"
PAGINA = 20
REPETICOES = 7
INDICES = ("ix_post_tags_tag_criado_em", "ix_post_tags_criado_em")


def massa(n: int, agora: datetime) -> list[dict]:
    rng = random.Random(SEMENTE)
    linhas = []
    for post_id in range(1, n + 1):
        criado_em = agora - timedelta(seconds=rng.uniform(0, DIAS_DE_HISTORIA * 86_400))
        for tag in rng.sample(VOCABULARIO, rng.randint(*TAGS_POR_POST)):
            linhas.append({"post_id": post_id, "tag": tag, "criado_em": criado_em.replace(tzinfo=None)})
    return linhas


def banco(pasta: Path, nome: str, linhas: list[dict], com_indice: bool) -> Session:
    engine = create_engine(f"sqlite:///{pasta / nome}.db")
    PostTag.__table__.create(engine)
    with engine.begin() as conexao:
        if not com_indice:
            for indice in INDICES:
                conexao.execute(text(f"DROP INDEX {indice}"))
        conexao.execute(insert(PostTag), linhas)
        conexao.execute(text("ANALYZE"))
    return Session(engine)


def consultas(db: Session, desde: datetime) -> dict:
    return {
        "posts_da_tag": partial(indice_tags.posts_da_tag, db, TAG_CONSULTADA, 0, PAGINA),
        "trending": partial(indice_tags.trending, db, desde),
        "busca": partial(indice_tags.buscar, db, PREFIXO_BUSCADO),
    }


def mediana_ms(funcao) -> float:
    vezes, _ = timeit.Timer(funcao).autorange()
    rodadas = timeit.repeat(funcao, number=vezes, repeat=REPETICOES)
    return statistics.median(rodadas) / vezes * 1000


def main() -> None:
    agora = datetime(2026, 11, 24, 12, tzinfo=UTC)
    desde = agora - timedelta(hours=24)
    print("bench_indice_tags: post_tags com índice x varredura linear (SQLite local)")
    print(
        f"massa: {len(VOCABULARIO)} tags no vocabulário, {TAGS_POR_POST[0]} a "
        f"{TAGS_POR_POST[1]} por post, {DIAS_DE_HISTORIA} dias, semente {SEMENTE}; "
        f"mediana de {REPETICOES} rodadas\n"
    )
    cabecalho = (
        f"{'posts':>8} | {'linhas':>7} | {'consulta':<12} | {'índice (ms)':>12} | "
        f"{'varredura (ms)':>14} | {'ganho':>7}"
    )
    print(cabecalho)
    print("-" * len(cabecalho))
    with tempfile.TemporaryDirectory(prefix="bench-tags-") as pasta:
        for n in TAMANHOS:
            linhas = massa(n, agora)
            com_indice = consultas(banco(Path(pasta), f"indice{n}", linhas, True), desde)
            varredura = consultas(banco(Path(pasta), f"varredura{n}", linhas, False), desde)
            for nome in com_indice:
                assert com_indice[nome]() == varredura[nome](), nome
                t_indice = mediana_ms(com_indice[nome])
                t_varredura = mediana_ms(varredura[nome])
                print(
                    f"{n:>8} | {len(linhas):>7} | {nome:<12} | {t_indice:>12.3f} | "
                    f"{t_varredura:>14.3f} | {t_varredura / t_indice:>6.1f}x"
                )


if __name__ == "__main__":
    main()
