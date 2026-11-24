#!/bin/sh
# Um backup do banco: pg_dump em formato custom (comprimido), retenção local e,
# se o OCI_BUCKET estiver no .env, cópia no Object Storage da Oracle.
#   docker compose exec backup backup.sh      # backup na hora, fora do agendamento
#
# /backups/diario/verso-AAAA-MM-DD.dump   os BACKUP_DIARIOS mais novos (7)
# /backups/semanal/verso-AAAA-Sss.dump    domingo: os BACKUP_SEMANAIS mais novos (4)
# Sem o envio configurado (ou se ele falhar), o backup local fica do mesmo jeito.
set -eu

diarios=${BACKUP_DIARIOS:-7}
semanais=${BACKUP_SEMANAIS:-4}
mkdir -p /backups/diario /backups/semanal

arquivo="/backups/diario/verso-$(date +%F).dump"
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$arquivo.parcial"
mv "$arquivo.parcial" "$arquivo"
echo "backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"

if [ "$(date +%u)" = 7 ]; then
    cp "$arquivo" "/backups/semanal/verso-$(date +%G-S%V).dump"
fi

# Retenção: os nomes têm a data, então a ordem alfabética é a cronológica.
apagar_antigos() {
    ls -1 "$1"/verso-*.dump 2>/dev/null | sort -r | tail -n +"$(($2 + 1))" | while read -r velho; do
        rm -f "$velho" && echo "apagado (retenção): $velho"
    done
}
apagar_antigos /backups/diario "$diarios"
apagar_antigos /backups/semanal "$semanais"

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
