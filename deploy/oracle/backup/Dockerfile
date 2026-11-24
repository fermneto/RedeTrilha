# Backup do Postgres do Verso: pg_dump (o mesmo 16 do serviço db) + rclone para o
# Object Storage da Oracle (API compatível com S3). Multi-arquitetura (arm64 e amd64).
FROM rclone/rclone:1.68.2 AS rclone

FROM postgres:16-bookworm
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY backup.sh agendar.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/agendar.sh \
    && mkdir -p /root/.config/rclone && touch /root/.config/rclone/rclone.conf
WORKDIR /backups
ENTRYPOINT []
CMD ["agendar.sh"]
