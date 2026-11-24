import os
from dataclasses import dataclass

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


@dataclass(frozen=True)
class ConfigDoPool:
    """O pool de conexões de UM processo (worker) do uvicorn, lido do ambiente.

    O teto do processo é `pool_size + max_overflow`. Com vários workers, a soma
    dos tetos tem de caber no pool do Supabase (docs/deploy.md, "Pool de conexões").
    """

    pool_size: int = 5
    max_overflow: int = 5
    # Segundos esperando uma conexão livre antes do erro.
    pool_timeout: int = 10
    # Segundos até trocar a conexão por uma nova (o pooler fecha as muito antigas).
    pool_recycle: int = 300

    @property
    def maximo(self) -> int:
        return self.pool_size + self.max_overflow

    @classmethod
    def do_ambiente(cls) -> "ConfigDoPool":
        padrao = cls()
        return cls(
            **{
                campo: int(os.environ.get(f"DB_{campo.upper()}", getattr(padrao, campo)))
                for campo in ("pool_size", "max_overflow", "pool_timeout", "pool_recycle")
            }
        )


def criar_engine(url: str, pool: ConfigDoPool | None = None):
    url = normalizar_url(url)
    if url.startswith("sqlite"):
        # O SQLite recusa, por padrão, a conexão usada em outra thread (a do FastAPI).
        return create_engine(url, connect_args={"check_same_thread": False})
    pool = pool or ConfigDoPool.do_ambiente()
    # pool_pre_ping: o pooler do Supabase derruba conexões ociosas (o Render hiberna).
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=pool.pool_size,
        max_overflow=pool.max_overflow,
        pool_timeout=pool.pool_timeout,
        pool_recycle=pool.pool_recycle,
    )


DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

POOL = ConfigDoPool.do_ambiente()
engine = criar_engine(DATABASE_URL, POOL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
