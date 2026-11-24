#!/bin/sh
# Sobe a API em produção (Dockerfile). Vários workers do uvicorn, atrás do Caddy.
#
# WEB_CONCURRENCY: número de workers. Vazio = 2 x núcleos + 1, limitado a
# WEB_CONCURRENCY_MAX (padrão 4): cada worker abre o próprio pool de conexões, e a
# soma tem de caber no max_connections do db (docs/deploy-oracle.md, "Workers e pool").
# FORWARDED_ALLOW_IPS: de quem a API aceita X-Forwarded-For/Proto (a rede interna
# do compose, onde só o Caddy fala com ela).
set -eu

if [ -z "${WEB_CONCURRENCY:-}" ]; then
    nucleos=$(nproc)
    WEB_CONCURRENCY=$((2 * nucleos + 1))
    maximo=${WEB_CONCURRENCY_MAX:-4}
    if [ "$WEB_CONCURRENCY" -gt "$maximo" ]; then
        WEB_CONCURRENCY=$maximo
    fi
fi
export WEB_CONCURRENCY

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WEB_CONCURRENCY" \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}" \
    --timeout-keep-alive "${TIMEOUT_KEEP_ALIVE:-75}" \
    --timeout-graceful-shutdown "${TIMEOUT_GRACEFUL_SHUTDOWN:-20}" \
    --no-server-header \
    "$@"
