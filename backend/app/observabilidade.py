"""Observabilidade mínima do deploy: Sentry opcional e uma linha de log por erro 500.

- Sentry só liga com SENTRY_DSN definido (docs/deploy-oracle.md). Sem ela, nada
  é importado nem enviado: o dev local e os testes ficam iguais.
- Cada erro não tratado vira UMA linha JSON no log (`docker compose logs api`),
  fácil de achar com grep "erro_interno". A resposta ao cliente continua 500.
"""

import json
import logging
import os

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("verso.erros")


def iniciar_sentry() -> bool:
    """Liga o Sentry se SENTRY_DSN existir. Devolve se ligou."""
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "producao"),
        # Só erros por padrão; traces custam cota do plano free.
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
    )
    return True


async def erro_interno(request: Request, erro: Exception) -> JSONResponse:
    """Handler de Exception: loga uma linha estruturada e responde 500 sem detalhes."""
    logger.error(
        json.dumps(
            {
                "evento": "erro_interno",
                "metodo": request.method,
                "rota": request.url.path,
                "tipo": type(erro).__name__,
                "mensagem": str(erro)[:500],
            },
            ensure_ascii=False,
        )
    )
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor."})
