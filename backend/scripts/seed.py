"""Seed mínimo: 3 usuários para o slice de exemplo renderizar, mais os consagrados.

A versão de verdade (com faker, posts, follows, likes...) é FEATURE DO NÚCLEO —
é do time. Rode com: make seed
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models.user import User
from app.services.auth import gerar_hash
from scripts import importar_consagrados

# Todo usuário de exemplo entra com esta senha (README, "Como começar").
# Consagrados não passam por aqui: ficam com password_hash=None, sem login.
SENHA_SEED = "verso123"

USUARIOS = [
    User(
        username="ada",
        name="Ada Lovelace",
        bio="a primeira a programar",
        password_hash=gerar_hash(SENHA_SEED),
    ),
    User(
        username="linus",
        name="Linus Torvalds",
        bio="just for fun",
        password_hash=gerar_hash(SENHA_SEED),
    ),
    User(
        username="grace",
        name="Grace Hopper",
        bio="caçadora de bugs literais",
        password_hash=gerar_hash(SENHA_SEED),
    ),
]


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            print("banco já tem dados — seed fake pulado")
        else:
            db.add_all(USUARIOS)
            db.commit()
            print(f"seed ok: {len(USUARIOS)} usuários criados")
    # A importação é idempotente: roda sempre, sem duplicar.
    importar_consagrados.main()


if __name__ == "__main__":
    main()
