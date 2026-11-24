import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# SQLite local, zero setup. O arquivo app.db NUNCA vai para o git (.gitignore).
# Os testes apontam DATABASE_URL para um banco descartável (ver tests/conftest.py).
# No deploy, DATABASE_URL é o Postgres do Supabase (docs/deploy.md).


def normalizar_url(url: str) -> str:
    """Leva postgres:// e postgresql:// ao driver psycopg 3; o resto passa igual.

    O Supabase e o Render entregam a URL sem o driver, e o SQLAlchemy cairia no
    psycopg2, que não está instalado.
    """
    for prefixo in ("postgres://", "postgresql://"):
        if url.startswith(prefixo):
            return "postgresql+psycopg://" + url.removeprefix(prefixo)
    return url


def criar_engine(url: str):
    url = normalizar_url(url)
    if url.startswith("sqlite"):
        # O SQLite recusa, por padrão, a conexão usada em outra thread (a do FastAPI).
        return create_engine(url, connect_args={"check_same_thread": False})
    # pool_pre_ping: o pooler do Supabase derruba conexões ociosas (o Render hiberna).
    return create_engine(url, pool_pre_ping=True)


DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

engine = criar_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
