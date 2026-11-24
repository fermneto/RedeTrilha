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
    ("ada", "Ada Lovelace", "a primeira a programar"),
    ("linus", "Linus Torvalds", "just for fun"),
    ("grace", "Grace Hopper", "caçadora de bugs literais"),
]


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            print("banco já tem dados — seed fake pulado")
        else:
            # Users novos a cada chamada: o SEED_ON_BOOT pode rodar o seed mais
            # de uma vez no mesmo processo, e um User já gravado não é reinserido.
            db.add_all(
                User(
                    username=username,
                    name=name,
                    bio=bio,
                    password_hash=gerar_hash(SENHA_SEED),
                )
                for username, name, bio in USUARIOS
            )
            db.commit()
            print(f"seed ok: {len(USUARIOS)} usuários criados")
    # A importação é idempotente: roda sempre, sem duplicar.
    importar_consagrados.main()


if __name__ == "__main__":
    main()
