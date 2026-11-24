"""Importa os poetas consagrados de backend/data/consagrados/*.json.

Lê e valida todos os JSONs (docs/consagrados.md) antes de gravar qualquer
coisa: um arquivo inválido, como `morte > 1955`, aborta a importação inteira.
Depois grava numa transação só, de forma idempotente: o user é achado pelo
`username` e o poema por (autor, titulo, obra).

O índice de tags vive em memória e é reconstruído no startup da API. Se o
importador rodar com o servidor de pé, as tags novas só aparecem no restart.

Rode com: make seed (ou cd backend && uv run python scripts/importar_consagrados.py)
"""

import hashlib
import random
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models.post import Post
from app.models.user import User
from app.schemas.consagrado import Consagrado, PoemaConsagrado

PASTA_CONSAGRADOS = Path(__file__).resolve().parents[1] / "data" / "consagrados"
JANELA_DO_FEED = timedelta(days=30)


class ArquivoConsagradoInvalido(ValueError):
    """Um JSON de consagrado que não segue docs/consagrados.md."""


class UsernameDeUsuarioComum(ValueError):
    """O username do JSON já pertence a uma conta comum, que não pode virar consagrada."""


@dataclass
class ResumoImportacao:
    poetas_criados: int = 0
    poetas_atualizados: int = 0
    poemas_criados: int = 0
    poemas_atualizados: int = 0


def _ler_arquivo(arquivo: Path) -> Consagrado:
    try:
        return Consagrado.model_validate_json(arquivo.read_text(encoding="utf-8"))
    except ValidationError as erro:
        motivos = "; ".join(
            f"{'.'.join(str(p) for p in e['loc']) or 'json'}: {e['msg']}" for e in erro.errors()
        )
        raise ArquivoConsagradoInvalido(f"{arquivo.name}: {motivos}") from erro


def ler_consagrados(pasta: Path) -> list[Consagrado]:
    """Lê e valida os *.json da pasta (menos os que começam com `_`), em ordem de arquivo."""
    arquivos = sorted(a for a in pasta.glob("*.json") if not a.name.startswith("_"))
    return [_ler_arquivo(arquivo) for arquivo in arquivos]


def _semente(username: str) -> int:
    """Semente estável entre execuções (o hash() do Python muda a cada processo)."""
    return int.from_bytes(hashlib.sha256(username.encode("utf-8")).digest()[:8], "big")


def datas_dos_poemas(username: str, n: int, agora: datetime) -> list[datetime]:
    """n datas UTC nos 30 dias antes de `agora`, determinísticas por username, em ordem crescente."""
    agora = agora.astimezone(UTC)
    rng = random.Random(_semente(username))
    segundos = JANELA_DO_FEED.total_seconds()
    return sorted(agora - timedelta(seconds=(1 - rng.random()) * segundos) for _ in range(n))


def importar(
    db: Session, consagrados: list[Consagrado], agora: datetime | None = None
) -> ResumoImportacao:
    """Grava os consagrados já validados numa transação só (tudo ou nada).

    O texto entra exatamente como veio. O `created_at` sai de `datas_dos_poemas`
    só na criação: reimportar não muda a data do poema no feed.
    """
    agora = agora or datetime.now(UTC)
    resumo = ResumoImportacao()
    try:
        for consagrado in consagrados:
            autor = _gravar_poeta(db, consagrado, resumo)
            datas = datas_dos_poemas(consagrado.username, len(consagrado.poemas), agora)
            for poema, data in zip(consagrado.poemas, datas, strict=True):
                _gravar_poema(db, autor, poema, data, resumo)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return resumo


def _gravar_poeta(db: Session, consagrado: Consagrado, resumo: ResumoImportacao) -> User:
    autor = db.scalar(select(User).where(User.username == consagrado.username))
    if autor is None:
        autor = User(username=consagrado.username)
        db.add(autor)
        resumo.poetas_criados += 1
    elif not autor.consagrado:
        raise UsernameDeUsuarioComum(
            f"{consagrado.username}: já existe uma conta comum com esse username"
        )
    else:
        resumo.poetas_atualizados += 1
    autor.name = consagrado.name
    autor.bio = consagrado.bio
    autor.avatar_url = consagrado.avatar_url
    autor.nascimento = consagrado.nascimento
    autor.morte = consagrado.morte
    autor.consagrado = True
    autor.password_hash = None
    db.flush()
    return autor


def _gravar_poema(
    db: Session,
    autor: User,
    poema: PoemaConsagrado,
    data: datetime,
    resumo: ResumoImportacao,
) -> None:
    post = db.scalar(
        select(Post).where(
            Post.autor_id == autor.id,
            Post.titulo == poema.titulo,
            Post.obra == poema.obra,
            Post.repost_de_id.is_(None),
        )
    )
    if post is None:
        post = Post(autor_id=autor.id, titulo=poema.titulo, obra=poema.obra, created_at=data)
        db.add(post)
        resumo.poemas_criados += 1
    else:
        resumo.poemas_atualizados += 1
    post.texto = poema.texto
    post.forma = poema.forma
    post.ano = poema.ano
    post.fonte = poema.fonte
    post.tags_extras = list(poema.tags)
    db.flush()


def main() -> None:
    try:
        consagrados = ler_consagrados(PASTA_CONSAGRADOS)
    except ArquivoConsagradoInvalido as erro:
        sys.exit(f"erro: {erro}")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        try:
            resumo = importar(db, consagrados)
        except UsernameDeUsuarioComum as erro:
            sys.exit(f"erro: {erro}")
    print(
        f"consagrados: {resumo.poetas_criados} poetas criados, "
        f"{resumo.poetas_atualizados} atualizados; "
        f"{resumo.poemas_criados} poemas criados, {resumo.poemas_atualizados} atualizados"
    )


if __name__ == "__main__":
    main()
