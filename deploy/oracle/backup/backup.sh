#!/bin/sh
# Um backup do banco: pg_dump em formato custom (comprimido), retenção local e,
# se o OCI_BUCKET estiver no .env, cópia no Object Storage da Oracle.
#   docker compose exec backup backup.sh      # backup na hora, fora do agendamento
#
# /backups/diario/verso-AAAA-MM-DDTHHMMSSZ-<host>.dump   os de BACKUP_DIARIOS datas (7)
# /backups/semanal/(o mesmo nome)                         domingo: BACKUP_SEMANAIS semanas (4)
# Data e hora em UTC e o hostname da VM no nome: dois backups (no mesmo dia, ou de
# duas VMs no mesmo bucket) nunca têm o mesmo nome. A retenção conta datas, não arquivos.
# Sem o envio configurado (ou se ele falhar), o backup local fica do mesmo jeito.
set -eu

diarios=${BACKUP_DIARIOS:-7}
semanais=${BACKUP_SEMANAIS:-4}
mkdir -p /backups/diario /backups/semanal

# O /etc/hostname da VM vem montado do host (compose.yaml); sem ele, o do container.
host=$(cat /etc/hostname-da-vm 2>/dev/null || hostname)
host=$(printf %s "$host" | tr -c 'A-Za-z0-9.-' '-' | sed 's/-*$//')
nome="verso-$(date -u +%Y-%m-%dT%H%M%SZ)-$host.dump"
arquivo="/backups/diario/$nome"
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$arquivo.parcial"
mv "$arquivo.parcial" "$arquivo"
echo "backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"

if [ "$(date -u +%u)" = 7 ]; then
    cp -p "$arquivo" "/backups/semanal/$nome"
fi

# A data (UTC) de um arquivo, tirada do nome: verso-2026-11-24T063000Z-... -> 2026-11-24.
data_de() { basename "$1" | sed -n 's/^verso-\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)T.*/\1/p'; }

# Retenção: guarda os arquivos das N chaves mais novas (chave = data ou semana ISO).
apagar_antigos() {
    pasta=$1 quantas=$2 formato=$3
    for f in "$pasta"/verso-*.dump; do
        [ -e "$f" ] || continue
        d=$(data_de "$f")
        [ -n "$d" ] || continue
        echo "$(date -u -d "$d" +"$formato") $f"
    done | sort -r > /tmp/retencao
    manter=$(cut -d' ' -f1 /tmp/retencao | uniq | head -n "$quantas")
    while read -r chave f; do
        if ! printf '%s\n' "$manter" | grep -qx "$chave"; then
            rm -f "$f" && echo "apagado (retenção): $f"
        fi
    done < /tmp/retencao
}
apagar_antigos /backups/diario "$diarios" %F
apagar_antigos /backups/semanal "$semanais" %G-%V

uso=$(df -P /backups | awk 'NR == 2 { sub("%", "", $5); print $5 }')
if [ "$uso" -ge 80 ]; then
    echo "AVISO: disco da VM com ${uso}% de uso (docs/deploy-oracle.md, \"Disco\")"
fi

if [ -z "${OCI_BUCKET:-}" ] || [ -z "${RCLONE_CONFIG_OCI_ACCESS_KEY_ID:-}" ]; then
    echo "Object Storage não configurado (OCI_BUCKET e chaves vazios): só o backup local"
    exit 0
fi

# copy, nunca sync: um volume local vazio (VM nova) não apaga os backups remotos.
# No remoto, a retenção é por idade, com um dia de folga.
remoto="oci:$OCI_BUCKET/verso"
if rclone copy /backups "$remoto" --include "/diario/*.dump" --include "/semanal/*.dump" \
    && rclone delete "$remoto/diario" --min-age "$((diarios + 1))d" \
    && rclone delete "$remoto/semanal" --min-age "$((semanais * 7 + 1))d"; then
    echo "enviado para o Object Storage: $remoto"
else
    echo "ERRO: o envio para o Object Storage falhou; o backup local está em $arquivo"
    exit 1
fi
