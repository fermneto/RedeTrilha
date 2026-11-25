#!/bin/sh
# Restaura um backup do serviço backup (docs/deploy-oracle.md, "Backup e restauração").
# Rode na VM, de deploy/oracle, com o compose de pé.
#
#   ./restaurar.sh --listar             # backups locais e no Object Storage
#   ./restaurar.sh ultimo               # TESTE com o diário mais novo: restaura num banco
#                                       # temporário, confere as contagens e apaga o temporário
#   ./restaurar.sh remoto:ultimo        # o mesmo, baixando do Object Storage
#   ./restaurar.sh diario/verso-2026-11-24T063000Z-verso-api.dump   # um arquivo (local ou remoto:)
#   ./restaurar.sh --producao remoto:ultimo                          # SUBSTITUI o banco verso
#
# O teste não mexe no banco verso nem tira a API do ar. O --producao para a api,
# apaga e recria o banco verso com o conteúdo do dump e sobe a api de novo.
set -eu

cd "$(dirname "$0")"
compose="docker compose"   # respeita COMPOSE_FILE (teste local: compose.yaml:compose.local.yaml)

no_backup() { $compose exec -T backup "$@"; }

uso() {
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
}

producao=false
case "${1:-}" in
    --listar)
        echo "== locais (volume backups)"
        no_backup sh -c 'ls -lh /backups/diario /backups/semanal'
        echo "== Object Storage"
        no_backup sh -c '[ -n "${OCI_BUCKET:-}" ] && rclone ls "oci:$OCI_BUCKET/verso" || echo "(não configurado)"'
        exit 0
        ;;
    --producao)
        producao=true
        shift
        ;;
    "" | -h | --help)
        uso
        ;;
esac
[ $# -eq 1 ] || uso
origem=$1

# "ultimo": o diário mais novo (os nomes começam pela data e hora, em UTC).
case "$origem" in
    ultimo)
        origem="diario/$(no_backup sh -c 'ls /backups/diario | grep "^verso-.*\.dump$" | sort | tail -n 1')"
        ;;
    remoto:ultimo)
        origem="remoto:diario/$(no_backup sh -c 'rclone lsf "oci:$OCI_BUCKET/verso/diario" | grep "^verso-.*\.dump$" | sort | tail -n 1')"
        ;;
esac
[ "${origem%/}" = "$origem" ] || { echo "nenhum backup diário encontrado (./restaurar.sh --listar)"; exit 1; }
echo "backup: $origem"

case "$origem" in
    remoto:*)
        caminho=${origem#remoto:}
        echo "baixando $caminho do Object Storage..."
        no_backup sh -c 'mkdir -p /backups/baixados && rclone copyto "oci:$OCI_BUCKET/verso/$1" "/backups/baixados/$(basename "$1")"' sh "$caminho"
        dump="/backups/baixados/$(basename "$caminho")"
        ;;
    /*) dump=$origem ;;
    *) dump="/backups/$origem" ;;
esac
no_backup test -f "$dump" || { echo "não achei $dump no volume de backups (./restaurar.sh --listar)"; exit 1; }

contar() {
    no_backup psql -d "$1" -Atc "select 'usuarios=' || (select count(*) from users) || ' poemas=' || (select count(*) from posts)"
}

if [ "$producao" = false ]; then
    teste=verso_teste_restauracao
    echo "restaurando $dump no banco temporário $teste..."
    no_backup dropdb --if-exists "$teste"
    no_backup createdb "$teste"
    no_backup pg_restore --no-owner --no-privileges --exit-on-error -d "$teste" "$dump"
    echo "no backup:   $(contar "$teste")"
    echo "em produção: $(contar verso)"
    no_backup dropdb "$teste"
    echo "teste de restauração ok (o banco temporário foi apagado)"
    exit 0
fi

printf 'Isto APAGA o banco verso e põe no lugar o conteúdo de %s. Digite "restaurar" para seguir: ' "$dump"
read -r resposta
[ "$resposta" = restaurar ] || { echo "cancelado"; exit 1; }

$compose stop api
no_backup psql -d postgres -v ON_ERROR_STOP=1 \
    -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'verso' and pid <> pg_backend_pid()" \
    -c "drop database verso" \
    -c "create database verso"
no_backup pg_restore --no-owner --no-privileges --exit-on-error -d verso "$dump"
echo "restaurado: $(contar verso)"
$compose start api
echo "api de volta (docker compose ps)"
