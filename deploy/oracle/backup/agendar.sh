#!/bin/sh
# Roda o backup.sh todo dia em BACKUP_HORA (HH:MM, no fuso TZ). É o comando do serviço backup.
set -eu
hora=${BACKUP_HORA:-03:30}
echo "backup agendado para todo dia às $hora ($TZ)"
while true; do
    agora=$(date +%s)
    alvo=$(date -d "today $hora" +%s)
    if [ "$alvo" -le "$agora" ]; then
        alvo=$(date -d "tomorrow $hora" +%s)
    fi
    sleep $((alvo - agora))
    backup.sh || echo "ERRO: o backup falhou (veja as linhas acima)"
done
