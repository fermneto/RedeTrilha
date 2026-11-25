#!/bin/sh
# Atualiza o deploy sem tirar a API do ar (docs/deploy-oracle.md, "Atualizar o deploy").
# Rode na VM, de deploy/oracle, com o compose de pé.
#
#   ./atualizar.sh              # git pull, build, seed e uma réplica de cada vez
#   ./atualizar.sh --sem-pull   # o mesmo, sem o git pull (código já atualizado)
#   ./atualizar.sh --recriar    # reinicia as réplicas mesmo sem imagem ou .env novos
#
# A ordem:
# 1. git pull e docker compose build (as réplicas continuam atendendo).
# 2. O seed roda uma vez e põe o banco em dia (tabelas e índices novos), antes das
#    réplicas. Se ele falhar, o script para e as réplicas antigas seguem no ar.
# 3. api_1 é recriada; enquanto isso o Caddy manda tudo para a api_2. O script
#    espera a api_1 ficar healthy (o /saude dela responde) e o Caddy a pôr de
#    volta na roda, e só então faz o mesmo com a api_2.
set -eu

cd "$(dirname "$0")"
compose="docker compose"   # respeita COMPOSE_FILE (teste local: compose.yaml:compose.local.yaml)
replicas="api_1 api_2"
# Segundos esperando uma réplica ficar healthy (o start_period do compose é 60 s).
espera_maxima=${ESPERA_MAXIMA:-120}
# O Caddy confere o /saude a cada 2 s (Caddyfile): esta folga cobre a conferência
# que devolve a réplica à roda antes de a outra parar.
folga_do_caddy=${FOLGA_DO_CADDY:-5}

puxar=true
recriar=""
for arg in "$@"; do
    case "$arg" in
        --sem-pull) puxar=false ;;
        --recriar) recriar="--force-recreate" ;;
        *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
    esac
done

agora() { date '+%H:%M:%S'; }

if [ "$puxar" = true ]; then
    echo "$(agora) git pull"
    git pull --ff-only
fi

echo "$(agora) build das imagens"
$compose build

# O db e o backup só são recriados se a imagem ou a configuração deles mudou.
# Com o Supabase (compose.supabase.yaml) eles não existem: nomeá-los os ligaria.
ativos=$($compose config --services)
for servico in db backup; do
    if echo "$ativos" | grep -qx "$servico"; then
        $compose up -d --no-deps "$servico"
    fi
done

echo "$(agora) seed: pondo o banco em dia"
$compose up -d --no-deps seed
if ! $compose wait seed >/dev/null; then
    echo "$(agora) o seed falhou (docker compose logs seed); as réplicas não foram tocadas"
    exit 1
fi

saude() { docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$1" 2>/dev/null; }

for replica in $replicas; do
    echo "$(agora) $replica: recriando (a outra réplica atende)"
    # --no-deps: não mexer no db, no seed nem na outra réplica.
    $compose up -d --no-deps $recriar "$replica"
    container=$($compose ps -q "$replica")
    passou=0
    while [ "$(saude "$container")" != "healthy" ]; do
        if [ "$passou" -ge "$espera_maxima" ]; then
            echo "$(agora) $replica não ficou healthy em ${espera_maxima} s; parei aqui"
            echo "  a outra réplica segue atendendo. Veja: docker compose logs $replica"
            exit 1
        fi
        sleep 1
        passou=$((passou + 1))
    done
    echo "$(agora) $replica: healthy em ${passou} s"
    sleep "$folga_do_caddy"
done

# O Caddy só é recriado se a imagem ou a configuração dele no compose mudou.
$compose up -d --no-deps caddy
# Caddyfile novo: o git troca o arquivo por outro, e o container continua vendo o
# antigo (o volume aponta para o arquivo, não para o caminho). Só um restart o
# relê: as conexões abertas caem e voltam em cerca de 1 s (os streams reconectam).
if ! $compose exec -T caddy cat /etc/caddy/Caddyfile | cmp -s - Caddyfile; then
    echo "$(agora) Caddyfile mudou: reiniciando o caddy (cerca de 1 s fora)"
    $compose restart caddy
fi

echo "$(agora) pronto"
$compose ps
