"""Popula o índice de tags (`post_tags`) a partir de todos os posts do banco.

Para um banco de antes da tabela `post_tags` (ela é criada vazia no boot pelo
`create_all`) ou para refazer o índice do zero. Idempotente: apaga e regrava
tudo numa transação, então rodar duas vezes dá o mesmo resultado.

Rode com: cd backend && uv run python scripts/popular_post_tags.py
(no deploy, com DATABASE_URL apontando para o banco; ver docs/deploy.md)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, SessionLocal, engine
from app.services import indice_tags


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        linhas = indice_tags.popular(db)
    print(f"post_tags: {linhas} linhas gravadas")


if __name__ == "__main__":
    main()
