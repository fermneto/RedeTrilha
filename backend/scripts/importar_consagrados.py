"""Importa os poetas consagrados de backend/data/consagrados/*.json.

Parte 1 (esta): lê e valida os JSONs no formato de docs/consagrados.md e
calcula as datas determinísticas dos poemas no feed. A gravação no banco
(user com password_hash=None e consagrado=True, poemas idempotentes por
autor, titulo e obra) entra quando a #3 (campos novos do User) for mergeada.

Rode com: cd backend && uv run python scripts/importar_consagrados.py
"""

import hashlib
import random
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError

from app.schemas.consagrado import Consagrado

PASTA_CONSAGRADOS = Path(__file__).resolve().parents[1] / "data" / "consagrados"
JANELA_DO_FEED = timedelta(days=30)


class ArquivoConsagradoInvalido(ValueError):
    """Um JSON de consagrado que não segue docs/consagrados.md."""


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


def main() -> None:
    try:
        consagrados = ler_consagrados(PASTA_CONSAGRADOS)
    except ArquivoConsagradoInvalido as erro:
        sys.exit(f"erro: {erro}")
    total_poemas = sum(len(c.poemas) for c in consagrados)
    print(f"{len(consagrados)} poetas, {total_poemas} poemas válidos em {PASTA_CONSAGRADOS}")


if __name__ == "__main__":
    main()
