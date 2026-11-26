"""Tira o caminho do Wikisource dos títulos dos consagrados que já estão no banco.

O importador (`importar_consagrados.py`) passou a gravar só o nome do poema
("Vozes de um Tumulo", não "Eu (Augusto dos Anjos, 1912)/Vozes de um Tumulo";
"O Mar", não "O Mar (Augusto dos Anjos)") e a preencher a obra e o ano que o
caminho trazia, quando faltavam (`app/core/titulos.py`). Os bancos importados
antes ainda têm os títulos antigos, e o importador não os acharia mais pela
chave (autor, titulo, obra). Este script leva cada poema ao mesmo (titulo, obra,
ano) que o importador gravaria hoje:

- os poemas que estão nos JSONs saem de `titulos_normalizados`, a função do
  importador, então uma reimportação depois acha todos;
- os que não estão (saíram do JSON, ou são cópias que `fundir_poemas_repetidos`
  ainda não fundiu) passam pela mesma normalização, sozinhos;
- um poema cujo título novo já é de outro poema do mesmo autor (com a mesma
  obra) fica como está e aparece na lista de conflitos;
- a tradução em cache de um poema que mudou de título sai (o título traduzido
  era o do caminho); a próxima leitura traduz de novo.

O título não entra no índice de tags (`post_tags`), que não muda.

Idempotente: depois de aplicado, não muda mais nada. Tudo numa transação.

    cd backend
    uv run python scripts/corrigir_titulos_consagrados.py --dry-run   # só lista antes → depois
    uv run python scripts/corrigir_titulos_consagrados.py             # aplica

Faça backup do banco antes de aplicar (com DATABASE_URL apontando para ele,
como nos outros scripts; ver docs/deploy.md). Não roda no boot.
"""

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.titulos import Poema, normalizar_poemas
from app.db import SessionLocal
from app.models.post import Post
from app.models.traducao import Traducao
from app.models.user import User
from app.schemas.consagrado import Consagrado
from scripts.importar_consagrados import (
    PASTA_CONSAGRADOS,
    VersoesDistintas,
    ler_consagrados,
    ler_versoes_distintas,
    titulos_normalizados,
)

Chave = tuple[str | None, str | None]


@dataclass(frozen=True)
class Mudanca:
    autor: str
    post_id: int
    antes: Poema
    depois: Poema


@dataclass
class Plano:
    mudancas: list[Mudanca] = field(default_factory=list)
    # Poemas que ficariam com a chave (titulo, obra) de outro do mesmo autor.
    conflitos: list[Mudanca] = field(default_factory=list)


def _do_json(consagrado: Consagrado, distintos: VersoesDistintas) -> dict[Chave, Poema]:
    """(titulo, obra) do JSON → (titulo, obra, ano) que o importador grava."""
    return {
        (original.titulo, original.obra): normalizado
        for original, normalizado in titulos_normalizados(
            consagrado, distintos.get(consagrado.username, set())
        )
    }


def planejar(
    db: Session, consagrados: list[Consagrado], distintos: VersoesDistintas | None = None
) -> Plano:
    """O que muda em cada poema dos consagrados do banco, sem gravar nada."""
    distintos = ler_versoes_distintas() if distintos is None else distintos
    por_username = {c.username: c for c in consagrados}
    plano = Plano()
    autores = db.execute(
        select(User.id, User.username, User.name).where(User.consagrado).order_by(User.username)
    ).all()
    for autor_id, username, nome in autores:
        posts = list(
            db.scalars(
                select(Post)
                .where(Post.autor_id == autor_id, Post.repost_de_id.is_(None))
                .order_by(Post.id)
            )
        )
        consagrado = por_username.get(username)
        alvos = _do_json(consagrado, distintos) if consagrado else {}
        antes = [Poema(p.titulo, p.obra, p.ano) for p in posts]
        # Fora do JSON: a mesma normalização, só entre os que sobram.
        sobra = [i for i, a in enumerate(antes) if (a.titulo, a.obra) not in alvos]
        sozinhos = dict(zip(sobra, normalizar_poemas([antes[i] for i in sobra], nome), strict=True))
        depois = [alvos.get((a.titulo, a.obra)) or sozinhos[i] for i, a in enumerate(antes)]
        ocupadas = {(a.titulo, a.obra) for a, d in zip(antes, depois, strict=True) if a == d}
        # Os do JSON primeiro: são eles que o importador vai procurar pela chave nova.
        ordem = sorted(range(len(posts)), key=lambda i: i in sozinhos)
        for i in ordem:
            post, a, d = posts[i], antes[i], depois[i]
            if a == d:
                continue
            mudanca = Mudanca(username, post.id, a, d)
            if (d.titulo, d.obra) in ocupadas:
                plano.conflitos.append(mudanca)
            else:
                ocupadas.add((d.titulo, d.obra))
                plano.mudancas.append(mudanca)
    return plano


def aplicar(db: Session, plano: Plano) -> None:
    """Grava as mudanças do plano (sem commit)."""
    for mudanca in plano.mudancas:
        post = db.get(Post, mudanca.post_id)
        if post.titulo != mudanca.depois.titulo:
            db.execute(delete(Traducao).where(Traducao.post_id == post.id))
        post.titulo = mudanca.depois.titulo
        post.obra = mudanca.depois.obra
        post.ano = mudanca.depois.ano
    db.flush()


def _linha(m: Mudanca) -> str:
    def poema(p: Poema) -> str:
        return f"{p.titulo!r} (obra={p.obra!r}, ano={p.ano})"

    return f"{m.autor} #{m.post_id}: {poema(m.antes)} → {poema(m.depois)}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="só lista antes → depois")
    args = parser.parse_args()
    consagrados = ler_consagrados(PASTA_CONSAGRADOS)
    distintos = ler_versoes_distintas(PASTA_CONSAGRADOS)
    with SessionLocal() as db:
        plano = planejar(db, consagrados, distintos)
        for mudanca in plano.mudancas:
            print(_linha(mudanca))
        for conflito in plano.conflitos:
            print(f"conflito, fica como está: {_linha(conflito)}")
        if not args.dry_run:
            aplicar(db, plano)
            db.commit()
    verbo = "mudariam" if args.dry_run else "mudaram"
    print(
        f"{len(plano.mudancas)} poemas {verbo}; {len(plano.conflitos)} conflitos ficaram como estão"
    )


if __name__ == "__main__":
    main()
