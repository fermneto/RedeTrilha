# Deploy do Verso na Oracle Cloud (Always Free)

Este é o caminho principal do deploy: a API **e o banco** numa VM da Oracle,
o front na Vercel. O Render com o Supabase (`docs/deploy.md`) fica como
alternativa simples, com a desvantagem de hibernar.

| Peça | Onde | O quê |
|---|---|---|
| Banco | a mesma VM da Oracle | Postgres 16 no Docker Compose (serviço `db`), sem porta pública, com backup diário para o Object Storage da Oracle |
| Backend | VM da Oracle Cloud, ARM (Ampere A1), Ubuntu | Docker Compose: `db` + `seed` + `api` (uvicorn com vários workers) + `caddy` (HTTPS) + `backup` |
| Front | Vercel | Next.js, com root directory `frontend` |

Meta: 100 usuários simultâneos com p95 abaixo de 1 s. A VM não hiberna (ao
contrário do Render free) e tem até 4 núcleos ARM e 24 GB de RAM sem custo.

Por que o banco na mesma VM, e não no Supabase: cada request da API faz várias
consultas, e cada consulta paga a ida e volta até o banco. Na mesma máquina,
essa ida e volta é de 0,06 ms (mediana de um `select 1` da API, medida no
compose). E o Session pooler do Supabase free aceita só 15 conexões no total
(API, seed, backup e SQL Editor juntos). Na VM, o limite é o `max_connections`
do próprio Postgres (60, no `compose.yaml`), com folga para o backup e para
crescer junto com a VM. O Supabase
continua possível: [Alternativa: banco gerenciado no
Supabase](#alternativa-banco-gerenciado-no-supabase).

Tudo o que está no repositório já vem pronto: `backend/Dockerfile`,
`deploy/oracle/compose.yaml`, `deploy/oracle/Caddyfile`,
`deploy/oracle/backup/`, `deploy/oracle/restaurar.sh` e
`deploy/oracle/.env.example`. Você só cria as contas, segue os passos e cola as
credenciais nos lugares marcados com **`<<< COLE AQUI`**.

> **NUNCA defina `DEBUG`** no `.env` da VM, nem como `false`. Com
> `DEBUG=true`, o header `X-User-Id` entra como qualquer usuário, sem senha.

> **Segredos só no `.env` da VM.** O `deploy/oracle/.env` está no
> `.gitignore`. Nunca cole a `POSTGRES_PASSWORD`, as chaves do Object Storage,
> a `ANTHROPIC_API_KEY` ou o `SENTRY_DSN` em arquivo versionado, issue ou PR.

## Sumário

1. [Chave da Anthropic e região](#passo-1-chave-da-anthropic-e-região)
2. [Conta Always Free na Oracle](#passo-2-conta-always-free-na-oracle)
3. [Criar a VM ARM](#passo-3-criar-a-vm-arm-ampere-a1)
4. [Abrir as portas 80 e 443](#passo-4-abrir-as-portas-80-e-443)
5. [Instalar o Docker](#passo-5-instalar-o-docker)
6. [Domínio gratuito](#passo-6-domínio-gratuito)
7. [Clonar e configurar o `.env`](#passo-7-clonar-e-configurar-o-env)
8. [Subir com `docker compose up -d`](#passo-8-subir)
9. [Vercel e CORS](#passo-9-vercel-e-cors)
10. [Monitoramento](#passo-10-monitoramento-gratuito)
11. [Backup no Object Storage](#passo-11-backup-no-object-storage)
12. [Restaurar um backup](#restaurar-um-backup)
13. [Disco e memória da VM](#disco-e-memória-da-vm)
14. [Atualizar o deploy](#atualizar-o-deploy)
15. [Workers e pool](#workers-e-pool)
16. [A Oracle pode recolher VMs ociosas](#a-oracle-pode-recolher-vms-ociosas)
17. [Migrar os dados do Supabase](#migrar-os-dados-do-supabase-opcional)
18. [Alternativa: banco gerenciado no Supabase](#alternativa-banco-gerenciado-no-supabase)
19. [Testar tudo localmente](#testar-tudo-localmente-antes)
20. [O que fazer se...](#o-que-fazer-se)

## Passo 1: chave da Anthropic e região

- (Opcional) a chave `sk-ant-...` de um workspace só da demo, com limite de
  gasto baixo: passo 2 do [`docs/deploy.md`](deploy.md#passo-2-chave-da-anthropic-só-para-a-demo).
  Sem ela, só a tradução fica fora (503).
- A **região** da VM: como a API e o banco ficam juntos, o que pesa é a
  distância até quem usa a rede. Para a banca e os colegas no Brasil, **Brazil
  East (São Paulo)**. O front na Vercel é servido pela CDN e chama a API direto
  do navegador.

## Passo 2: conta Always Free na Oracle

1. Em [oracle.com/cloud/free](https://www.oracle.com/cloud/free/): **Start for free**.
2. Preencha nome, e-mail e país. A Oracle pede um **cartão de crédito** só para
   verificar a identidade (faz uma pré-autorização pequena que é estornada). No
   plano Free Tier nada é cobrado: recursos pagos ficam bloqueados.
3. **Home Region:** escolha com cuidado, porque **não dá para mudar depois** e
   as VMs ARM gratuitas só podem ser criadas nela. Use a região do passo 1.
4. Espere o e-mail "Your Oracle Cloud account is ready" (de minutos a algumas
   horas) e entre em [cloud.oracle.com](https://cloud.oracle.com).

## Passo 3: criar a VM ARM (Ampere A1)

1. Menu ☰ → **Compute** → **Instances** → **Create instance**.
2. Preencha:

   ```text
   Name:                 verso-api
   Placement:            (o availability domain que vier; se faltar capacidade, troque, ver abaixo)
   Image:                Change image → Ubuntu → Canonical Ubuntu 24.04 (a versão aarch64 vem sozinha)
   Shape:                Change shape → Ampere → VM.Standard.A1.Flex
     OCPUs:              4          (o máximo grátis: 4 no total da conta)
     Memory (GB):        24         (o máximo grátis: 24 no total da conta)
   Networking:           Create new virtual cloud network (padrão) + Create new public subnet
                         Assign a public IPv4 address: Yes
   Add SSH keys:         Generate a key pair for me → Download private key (e a pública)
   Boot volume:          padrão (cerca de 47 GB; o grátis é até 200 GB no total)
   ```

   O selo **"Always Free-eligible"** deve aparecer ao lado do shape e da
   imagem. Se não aparecer, algo saiu do gratuito.

   4 OCPU e 24 GB é todo o gratuito A1 numa VM só (não sobra nada para outra
   VM): com a API e o Postgres juntos, é o que fecha a meta de p95 abaixo de
   1 s até sem pausa entre os cliques ([Workers e pool](#workers-e-pool)).
   Com 2 OCPU e 12 GB a meta fecha com gente navegando, mas não sem pausa.
3. **Create**. Em um ou dois minutos o estado fica **Running**. Anote o
   **Public IPv4 address** (ex.: `129.146.10.20`).

   IP público da VM: `___.___.___.___`   **<<< ANOTE AQUI**

4. Guarde a chave privada (`ssh-key-AAAA-MM-DD.key`) fora do repositório e
   entre na VM:

   ```bash
   chmod 600 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP-PUBLICO>
   ```

**"Out of capacity for shape VM.Standard.A1.Flex"** é comum, principalmente em
Ashburn e São Paulo. O que fazer, nesta ordem:

1. Troque o **availability domain** (AD-1, AD-2, AD-3, quando a região tiver
   mais de um) e tente de novo.
2. Peça menos: **1 OCPU e 6 GB** costuma achar vaga. Suba com ela e
   redimensione depois, quando houver capacidade: Instance → **Edit** → **Edit
   shape** → 4 OCPU e 24 GB → **Save changes** (a VM reinicia; o disco, o IP e
   os volumes do Docker ficam). Enquanto a VM for menor, reduza a memória do
   Postgres no `.env` ([Disco e memória](#disco-e-memória-da-vm)).
3. Tente em outro horário (madrugada e fim de semana costumam ter vaga).
4. Fazer o **upgrade para Pay As You Go** (Billing → Upgrade) quase sempre
   resolve a falta de capacidade e continua sem custo enquanto você ficar
   dentro dos limites Always Free. Ele exige cuidado: um recurso fora do
   gratuito passa a ser cobrado. **Decisão sua.**

## Passo 4: abrir as portas 80 e 443

São **duas** barreiras: a Security List da Oracle (fora da VM) e o firewall do
Ubuntu (dentro da VM). As duas precisam liberar.

### 4a. Security List (no console)

1. Na página da instância: **Primary VNIC** → clique na **Subnet** →
   **Security** (ou **Security Lists**) → **Default Security List for ...**.
2. **Add Ingress Rules**, uma regra por linha:

   ```text
   Source CIDR: 0.0.0.0/0   IP Protocol: TCP   Destination Port Range: 80
   Source CIDR: 0.0.0.0/0   IP Protocol: TCP   Destination Port Range: 443
   Source CIDR: 0.0.0.0/0   IP Protocol: UDP   Destination Port Range: 443   (HTTP/3, opcional)
   ```

   A regra da porta 22 (SSH) já vem criada.

### 4b. Firewall do Ubuntu (na VM)

A imagem do Ubuntu da Oracle vem com regras de `iptables` que recusam tudo
menos SSH. **Não use o `ufw`** nessa imagem (ele briga com essas regras).

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

O `netfilter-persistent save` grava as regras para sobreviverem ao reboot.

## Passo 5: instalar o Docker

Na VM:

```bash
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit          # saia e entre de novo pelo ssh, para o grupo docker valer
```

Confira (de volta na VM):

```bash
docker run --rm hello-world
docker compose version
```

O Docker já liga sozinho no boot da VM.

## Passo 6: domínio gratuito

O Caddy pede o certificado HTTPS ao Let's Encrypt sozinho, mas precisa de um
**nome** que aponte para o IP da VM. Escolha um:

| Opção | Nome | O que fazer |
|---|---|---|
| **sslip.io** (mais simples) | `api.129-146-10-20.sslip.io` | Nada: o nome já resolve para o IP escrito nele (troque os pontos por traços) |
| **DuckDNS** | `verso-api.duckdns.org` | Entre em [duckdns.org](https://www.duckdns.org) com o GitHub, crie o subdomínio e ponha o IP da VM |
| Domínio seu | `api.seudominio.com.br` | Crie um registro **A** apontando para o IP da VM |

Confira antes de seguir (na sua máquina):

```bash
nslookup api.129-146-10-20.sslip.io     # tem que responder o IP da VM
```

Domínio da API: `______________________`   **<<< ANOTE AQUI**

## Passo 7: clonar e configurar o `.env`

Na VM:

```bash
git clone https://github.com/fermneto/RedeTrilha.git
cd RedeTrilha/deploy/oracle
cp .env.example .env
chmod 600 .env
openssl rand -hex 24          # a senha do Postgres: copie a linha que sair
nano .env
```

Preencha cada linha marcada com **`<<< COLE AQUI`** (no `nano`: Ctrl+O, Enter
para salvar; Ctrl+X para sair):

```text
DOMINIO=api.129-146-10-20.sslip.io                 <<< o domínio do passo 6, sem https://
ACME_EMAIL=seu-email@exemplo.com                   <<< seu e-mail (avisos do Let's Encrypt)
POSTGRES_PASSWORD=3f9c...                          <<< a saída do openssl rand -hex 24
SEED_ON_BOOT=true                                  (deixe true: só popula um banco sem usuários)
CORS_ORIGINS=http://localhost:3000                 <<< por enquanto; o passo 9 troca pela URL da Vercel
ANTHROPIC_API_KEY=sk-ant-...                       <<< opcional, a chave da demo
SENTRY_DSN=                                        <<< opcional, passo 10
OCI_BUCKET=, OCI_S3_ENDPOINT=, OCI_REGIAO=,
OCI_ACCESS_KEY=, OCI_SECRET_KEY=                   <<< passo 11 (vazios: só o backup local)
```

Não há `DATABASE_URL` para colar: o `compose.yaml` monta
`postgresql://verso:<POSTGRES_PASSWORD>@db:5432/verso` para a `api` e o
`seed`. O banco não tem porta pública: só os containers da rede interna do
compose falam com ele.

Os outros valores (`WEB_CONCURRENCY`, `DB_POOL_*`, `BACKUP_*`) já vêm com
padrões medidos; veja [Workers e pool](#workers-e-pool) antes de mexer.

Cuidados com o `.env`: sem aspas, sem espaço em volta do `=`, e nada de
comentário na mesma linha do valor. A `POSTGRES_PASSWORD` só com letras e
números (ela entra na URL do banco): o `openssl rand -hex` já sai assim. Ela
vale **no primeiro `up`**: depois disso o Postgres guarda a senha no volume, e
trocar no `.env` não troca no banco (ver [O que fazer se...](#o-que-fazer-se)).

## Passo 8: subir

Ainda em `RedeTrilha/deploy/oracle`:

```bash
docker compose up -d --build
```

O primeiro build leva alguns minutos (compila a imagem para ARM na própria
VM). A ordem é automática:

1. **`db`** inicializa o Postgres no volume `pgdata` e só fica "healthy"
   quando o `pg_isready` responde.
2. **`seed`** cria as tabelas e, com o banco vazio, roda o seed (poetas do
   seed + consagrados, uns 30 s). Depois ele sai.
3. **`api`** só sobe quando o `seed` termina bem, e só fica "healthy" quando
   `/saude` responde.
4. **`caddy`** só sobe quando a `api` está healthy, e então pede o certificado.

Acompanhe:

```bash
docker compose ps -a            # db: Up (healthy); seed: Exited (0); api: Up (healthy); caddy e backup: Up
docker compose logs -f seed     # "seed ok: ... usuarios ..." e "banco pronto"
docker compose logs -f caddy    # "certificate obtained successfully"
```

Por que um serviço `seed` separado: a API roda com vários workers, e cada
worker executa o startup. Se todos rodassem o seed ao mesmo tempo, os dados
duplicariam ou o boot travaria. O `seed` roda uma vez, antes; a `api` sempre
sobe com `SEED_ON_BOOT=false` (forçado no `compose.yaml`). Como rede de
segurança, o preparo do banco também pega um *advisory lock* no Postgres, então
dois preparos simultâneos fazem fila em vez de duplicar.

Teste da sua máquina:

```bash
curl -s https://<DOMINIO>/saude
# {"ok":true}

curl -s https://<DOMINIO>/auth/login -H 'content-type: application/json' \
  -d '{"username":"marina_letras","password":"verso123"}'
# {"token":"..."}

curl -s -o /dev/null -w "%{http_code}\n" -H "X-User-Id: 1" https://<DOMINIO>/feed
# 401 (o bypass de dev não vale em produção)
```

Os containers têm `restart: unless-stopped`: voltam sozinhos se a VM
reiniciar, e os dados ficam no volume `pgdata`. Os logs giram em 5 arquivos de 10 MB por serviço.

## Passo 9: Vercel e CORS

O front lê a URL da API de **`NEXT_PUBLIC_API_URL`** (ver
`frontend/.env.local.example` e `frontend/lib/api.ts`).

1. Siga o passo 4 do [`docs/deploy.md`](deploy.md#passo-4-front-na-vercel),
   mas com:

   ```text
   NEXT_PUBLIC_API_URL = https://<DOMINIO>        <<< o domínio do passo 6, com https, sem barra no fim
   ```

   Essa variável entra no JavaScript **no build**: se mudar, faça **Redeploy**
   na Vercel.

   Domínio da Vercel: `https://______________.vercel.app`   **<<< ANOTE AQUI**

2. Volte à VM e troque o CORS pelo domínio exato da Vercel:

   ```bash
   cd ~/RedeTrilha/deploy/oracle
   nano .env
   # CORS_ORIGINS=https://verso.vercel.app            <<< o domínio da Vercel, sem barra
   docker compose up -d                              # recria a api com o .env novo
   ```

   Para o dev local também falar com a produção:
   `CORS_ORIGINS=https://verso.vercel.app,http://localhost:3000`.

Depois disso, rode o [checklist da banca](deploy.md#checklist-de-verificação-o-que-a-banca-faz)
trocando a URL do Render pela sua.

## Passo 10: monitoramento gratuito

### Ping externo (UptimeRobot)

1. Crie a conta em [uptimerobot.com](https://uptimerobot.com) (plano free).
2. **Add New Monitor**:

   ```text
   Monitor Type:   HTTP(s)
   Friendly Name:  Verso API
   URL:            https://<DOMINIO>/saude
   Interval:       5 minutes
   ```

3. Em **Alert Contacts**, o seu e-mail. Você recebe um aviso se a API cair.

O `/saude` não consulta o banco. Para vigiar o banco também, crie um segundo
monitor do tipo **Keyword** em `https://<DOMINIO>/usuarios?limit=1` procurando
a palavra `total`: essa rota é pública e lê do banco.

### Sentry (opcional)

O backend já tem o `sentry-sdk`, mas ele **só liga se `SENTRY_DSN` estiver
definido**. Vazio, nada é enviado.

1. Em [sentry.io](https://sentry.io) (plano Developer, grátis): **Create
   Project** → plataforma **FastAPI** → copie o **DSN**
   (`https://...@o....ingest.sentry.io/...`).
2. No `.env` da VM: `SENTRY_DSN=<o DSN>`   **<<< COLE AQUI**, e
   `docker compose up -d`.
3. Para desligar: apague o valor e `docker compose up -d` de novo.

Por padrão só erros são enviados (`SENTRY_TRACES_SAMPLE_RATE=0`); traces
gastam a cota grátis.

### Logs

Cada erro 500 vira **uma linha JSON** no log da API, com método, rota, tipo e
mensagem do erro:

```bash
docker compose logs api | grep erro_interno
docker compose logs --since 1h caddy      # acessos, em JSON
docker compose logs backup                # "backup ok: ..." e "enviado para o Object Storage"
```

## Passo 11: backup no Object Storage

O serviço `backup` faz, todo dia às `BACKUP_HORA` (03:30, no fuso `TZ`), um
`pg_dump` em formato custom (comprimido) no volume `backups`:

```text
/backups/diario/verso-AAAA-MM-DDTHHMMSSZ-<host>.dump    os das 7 datas mais novas (BACKUP_DIARIOS)
/backups/semanal/verso-AAAA-MM-DDTHHMMSSZ-<host>.dump   os de domingo, das 4 semanas mais novas (BACKUP_SEMANAIS)
```

O nome leva a data e a hora em UTC e o hostname da VM, então nenhum backup
sobrescreve outro: nem dois no mesmo dia (um manual e o agendado), nem os de
uma VM nova no mesmo bucket. A retenção conta datas, não arquivos: dois
backups do mesmo dia ficam ou saem juntos. O dump do seed tem uns 6 MB. Isso já funciona sem configurar nada. Mas o
volume mora no disco da VM: se a Oracle recolher a VM ou o disco se perder, os
backups vão junto. Por isso o `backup` também copia cada dump para um bucket do
**Object Storage** da Oracle (Always Free: 20 GB no total da conta), pela API
compatível com S3 e com o `rclone`. O que fazer na conta, uma vez:

1. **Bucket.** Menu ☰ → **Storage** → **Buckets** → **Create Bucket**:

   ```text
   Name:              verso-backups
   Default Storage Tier: Standard
   (o resto no padrão; o bucket nasce privado)
   ```

   Crie no compartimento raiz (o padrão da API S3). Nome do bucket:
   `verso-backups`   **<<< ANOTE AQUI** (vai em `OCI_BUCKET`)
2. **Namespace.** Menu do perfil (canto superior direito) → **Tenancy:
   <nome>** → **Object storage namespace** (uma sequência como `axk1abcd2efg`).
   O endpoint é:

   ```text
   https://<namespace>.compat.objectstorage.<regiao>.oci.customer-oci.com
   ex.: https://axk1abcd2efg.compat.objectstorage.sa-saopaulo-1.oci.customer-oci.com
   ```

   A região é o identificador da Home Region (`sa-saopaulo-1`,
   `us-ashburn-1`...), que aparece no topo do console.
   **<<< COLE AQUI** em `OCI_S3_ENDPOINT` e `OCI_REGIAO`.
3. **Customer Secret Key.** Menu do perfil → **User settings** (ou **My
   profile**) → **Customer secret keys** → **Generate secret key** → nome
   `verso-backup`. Copie o **Secret Key** na hora (ele aparece uma vez só); o
   **Access Key** fica na lista. **<<< COLE AQUI** em `OCI_SECRET_KEY` e
   `OCI_ACCESS_KEY`. Cada usuário pode ter até duas chaves; elas não expiram,
   então apague esta depois da entrega se não for manter o deploy.
4. Na VM: `docker compose up -d` (recria o `backup` com o `.env` novo) e um
   backup na hora para conferir:

   ```bash
   docker compose exec backup backup.sh
   # backup ok: /backups/diario/verso-2026-11-25T063000Z-verso-api.dump (6.1M)
   # enviado para o Object Storage: oci:verso-backups/verso
   ./restaurar.sh --listar          # o mesmo arquivo nos dois lados
   ```

O envio usa `rclone copy`, nunca `sync`: um volume local vazio (numa VM nova)
não apaga nada no bucket. No bucket, a retenção é por idade: diários com mais
de 8 dias e semanais com mais de 29 dias saem. Se o envio falhar (chave errada,
rede), o log do `backup` diz `ERRO: o envio ... falhou` e o dump local fica.

## Restaurar um backup

O `restaurar.sh` (em `deploy/oracle`) roda os comandos do Postgres dentro do
container `backup`, que já tem o `pg_restore`, o `rclone` e o volume.

**Teste de restauração** (sem mexer no banco `verso` nem tirar a API do ar):
restaura num banco temporário, compara as contagens com as de produção e apaga
o temporário. Faça uma vez depois de configurar o passo 11 e antes da banca:

```bash
./restaurar.sh --listar
./restaurar.sh ultimo              # o diário mais novo do volume local
./restaurar.sh remoto:ultimo       # o mais novo do Object Storage (baixa antes)
./restaurar.sh remoto:diario/verso-2026-11-25T063000Z-verso-api.dump   # um arquivo
# no backup:   usuarios=184 poemas=11336
# em produção: usuarios=184 poemas=11336
# teste de restauração ok (o banco temporário foi apagado)
```

As contagens batem quando nada foi publicado depois do dump.

**Restaurar de verdade** (substitui o banco `verso`):

```bash
./restaurar.sh --producao diario/verso-2026-11-25T063000Z-verso-api.dump
# pede para digitar "restaurar"; para a api, apaga e recria o banco, restaura e sobe a api
```

O que foi publicado depois do dump se perde: faça antes um
`docker compose exec backup backup.sh` se o banco atual ainda servir para algo.

## Disco e memória da VM

O boot volume grátis tem uns 47 GB, e nele moram o sistema, as imagens do
Docker, o banco (`pgdata`), os backups locais (`backups`) e os logs (no
máximo 50 MB por serviço). O banco e os backups do seed somam menos de 100 MB.

```bash
df -h /                          # uso do disco da VM
docker system df                 # imagens, containers e volumes
docker system df -v | grep -E 'verso_(pgdata|backups)'
docker compose exec db psql -U verso -c "select pg_size_pretty(pg_database_size('verso'))"
```

O `backup` escreve `AVISO: disco da VM com N% de uso` no log quando o disco
passa de 80%. Para liberar: `docker image prune -f` e `docker builder prune -f`
(imagens e cache de build antigos; não tocam nos volumes). Se faltar mesmo, o
boot volume pode crescer até 200 GB sem custo (Instance → Boot volume →
**Edit**, e depois `sudo growpart` na VM).

A memória do Postgres vem dimensionada para a VM de 24 GB, que ele divide com
a API e o Caddy. Numa VM menor (por exemplo, enquanto espera capacidade para
redimensionar), reduza no `.env` e rode `docker compose up -d db`:

| VM | `PG_SHARED_BUFFERS` | `PG_EFFECTIVE_CACHE_SIZE` | `PG_WORK_MEM` | `PG_MAINTENANCE_WORK_MEM` |
|---|---|---|---|---|
| 4 OCPU, 24 GB (padrão) | 2GB | 12GB | 16MB | 512MB |
| 2 OCPU, 12 GB | 1GB | 6GB | 8MB | 256MB |
| 1 OCPU, 6 GB | 512MB | 3GB | 4MB | 128MB |

Com 1 OCPU, use também `WEB_CONCURRENCY=1`.

## Atualizar o deploy

Depois de um merge na `main`:

```bash
cd ~/RedeTrilha && git pull
cd deploy/oracle && docker compose up -d --build
docker image prune -f        # apaga as imagens antigas (libera disco)
```

O `seed` roda de novo, vê que o banco já tem usuários e só põe o banco em dia
(`banco pronto`): cria os índices novos em tabelas que já existiam e, se a
tabela `post_tags` estiver vazia, popula o índice de tags a partir dos posts.
Num banco já em dia, isso é instantâneo. O `db` não é recriado (a imagem não
mudou) e os dados ficam no volume `pgdata`. A API fica fora do ar por alguns
segundos enquanto os workers reiniciam.

Consagrados novos (JSON novo em `backend/data/consagrados/`) não entram pelo
seed, porque o banco não está vazio. Rode o importador uma vez; as tags entram
no índice na mesma transação, sem reiniciar a API:

```bash
docker compose run --rm --entrypoint python seed scripts/importar_consagrados.py
```


Nunca rode `docker compose down -v` na VM: o `-v` apaga os volumes, ou seja, o
banco e os backups locais. Para parar tudo, `docker compose down` (sem `-v`).

## Workers e pool

A `api` roda o uvicorn com `WEB_CONCURRENCY` workers (processos). Vazio, o
padrão é `2 × núcleos + 1`, limitado a `WEB_CONCURRENCY_MAX` (4). Vários
workers não dão problema: o índice de tags (tabela `post_tags`) e o limite de
traduções (contado em `traducoes`) moram no banco, então todo worker vê o mesmo
Em alta e o mesmo limite.

Cada worker abre o próprio pool de conexões (`DB_POOL_*`, lidos pelo
`backend/app/db.py`) e deixa no máximo `DB_POOL_SIZE + DB_MAX_OVERFLOW`
requisições em voo (`app/limite_do_banco.py`). A conta que precisa fechar é
contra o `max_connections` do `db` (60, no `compose.yaml`):

```text
WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW) + folga ≤ max_connections
2 workers × (4 + 2) = 12   ← o padrão do .env.example (medido, abaixo)
4 workers × (5 + 5) = 40   ← cabe sem mexer no max_connections
folga: backup (1), restauração (2), psql de manutenção, 3 reservadas ao superusuário
```

O padrão do `.env.example` é **2 workers com pool 4 + 2**, o que deu o menor
p95 sem erro, e o mais estável, nas duas VMs. Medido com
`backend/scripts/carga.py` (100 usuários logados, mix de 14 rotas de leitura,
30 s, pelo Caddy com HTTPS) contra o compose local com o seed completo (184
usuários, 11.336 poemas), com `db`, `api` e `caddy` presos a 4 núcleos (a VM
do guia) ou a 2. Cada célula traz as rodadas; 0 erro em todas.

**4 núcleos (4 OCPU, 24 GB, a VM do guia):**

| Workers × pool | Pausa média de 3 s | Sem pausa (100 requisições sempre em voo) |
|---|---|---|
| **2 × (4 + 2)** | 27 req/s, **p95 47 e 48 ms** | 146 a 156 req/s, **p95 924, 914, 899 e 804 ms** |
| 4 × (4 + 2) | 26 a 28 req/s, p95 49 e 49 ms | 137 a 172 req/s, p95 1.914, 953, 839 e 2.177 ms |

**2 núcleos (2 OCPU, 12 GB):**

| Workers × pool | Pausa média de 3 s | Sem pausa |
|---|---|---|
| **2 × (4 + 2)** | 28 req/s, p95 46 e 52 ms | 109 a 112 req/s, p95 1.133 e 1.163 ms |
| 2 × (5 + 5) | 27 a 28 req/s, p95 51 e 48 ms | 103 a 106 req/s, p95 1.250 e 1.313 ms |
| 4 × (5 + 5) | 26 a 27 req/s, p95 49 e 50 ms | 102 req/s, p95 1.664 e 1.556 ms |

Com a pausa (gente navegando), tudo empata bem abaixo da meta de 1 s. Sem
pausa, a CPU é o limite: a API, o Postgres e o Caddy dividem os mesmos
núcleos. Com 4 núcleos, 2 workers ficam abaixo de 1 s em todas as rodadas;
4 workers às vezes empatam e às vezes passam de 1,9 s (mais processos
disputando a CPU com o Postgres). Com 2 núcleos, ninguém fecha 1 s sem pausa.

Mudou o número de workers ou o pool e passou de 60? Suba o `max_connections`
no `compose.yaml` junto (cada conexão ociosa custa poucos MB). Passar disso dá
`too many clients already` sob carga.

Compressão: o Caddy comprime as respostas (`encode zstd gzip`). Se a API
também tiver o `GZipMiddleware`, os dois convivem: o Caddy vê que a resposta
já veio com `Content-Encoding` e não comprime de novo.

## A Oracle pode recolher VMs ociosas

Em contas **Free Tier** (sem upgrade), a Oracle pode **parar** uma VM Always
Free considerada ociosa: quando, por 7 dias seguidos, o uso de CPU (percentil
95), de rede e, nas VMs ARM, de memória ficam todos abaixo de 20%. Ela avisa
por e-mail antes. Os dados do disco ficam, e dá para ligar de novo (Instance →
**Start**), mas a URL fica fora do ar até lá.

Como evitar:

- **Até a banca (27/11)** isso não chega a acontecer: são menos de 7 dias.
- O ping do UptimeRobot **não basta** para passar de 20%; ele só avisa se a
  API cair.
- O jeito garantido é o **upgrade para Pay As You Go**: contas pagas não têm a
  regra de ociosidade, e o que é Always Free continua grátis. **Decisão sua**
  (ver o aviso no passo 3).
- Sem upgrade, confira o e-mail da Oracle e o painel da instância de tempos em
  tempos, e religue se ela parar.

**Se a VM sumir** (recolhida e apagada, conta encerrada, disco perdido), os
dados voltam do Object Storage numa VM nova:

1. Refaça os passos 3 a 7 (o IP muda: atualize o DuckDNS ou o sslip.io no
   `DOMINIO`, e o `NEXT_PUBLIC_API_URL` na Vercel, com Redeploy). Use o mesmo
   `.env`, com a mesma configuração do Object Storage.
2. `docker compose up -d --build`. O `seed` popula o banco novo com o seed;
   tudo bem, o próximo passo substitui o banco inteiro.
3. Veja os backups no bucket e restaure o mais novo **da VM antiga** (o
   hostname dela está no nome). Não use `remoto:ultimo` aqui: se a VM nova já
   fez um backup, o mais novo é o do banco recém-semeado.

   ```bash
   ./restaurar.sh --listar
   ./restaurar.sh remoto:diario/verso-AAAA-MM-DDTHHMMSSZ-<vm-antiga>.dump      # teste primeiro
   ./restaurar.sh --producao remoto:diario/verso-AAAA-MM-DDTHHMMSSZ-<vm-antiga>.dump
   ```

Perde-se o que foi publicado depois do último backup (no máximo um dia). Os
backups da VM antiga não são sobrescritos (o hostname e a hora estão no
nome); a retenção por idade do bucket os apaga depois de 8 dias (diários) e
29 dias (semanais), então restaure antes disso.

## Migrar os dados do Supabase (opcional)

Só se você já tinha a rede no ar com o Supabase e quer levar contas e poemas
para o `db` da VM. A ideia: o `seed` cria as tabelas vazias e um `pg_dump`
só dos dados do Supabase entra nelas.

1. Na VM, com o `.env` do passo 7, mas com **`SEED_ON_BOOT=false`** (o banco
   tem de ficar sem dados) e sem `DATABASE_URL`:

   ```bash
   docker compose up -d --build db seed      # tabelas e índices, sem seed
   docker compose ps -a seed                 # Exited (0)
   ```

2. Veja a versão do Postgres do Supabase (Project Settings → Infrastructure,
   ou `select version()` no SQL Editor) e use o cliente da **mesma versão
   principal** ou mais novo (ex.: `postgres:17`). Dump só dos dados do schema
   `public`, pela string do **Session pooler**:

   ```bash
   docker run --rm -v "$PWD:/saida" postgres:17 pg_dump \
     "postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres" \
     --schema=public --data-only --no-owner --no-privileges -Fc -f /saida/supabase.dump
   ```

3. Restaure no `db`, pela rede interna do compose (o mesmo cliente do passo 2):

   ```bash
   docker run --rm --network verso_interna -v "$PWD:/saida" postgres:17 sh -c '
     pg_restore --data-only --disable-triggers --no-owner --no-privileges -f - /saida/supabase.dump |
     grep -v "^SET transaction_timeout" |
     psql -q -v ON_ERROR_STOP=1 -o /dev/null "postgresql://verso:<POSTGRES_PASSWORD>@db:5432/verso"'
   rm supabase.dump                           # tem os hashes de senha
   ```

   O `pg_restore` gera o SQL e o `psql` aplica no Postgres 16 da VM. O `grep`
   tira a única linha que um cliente 17 escreve e o 16 não conhece. O
   `--disable-triggers` deixa entrar as tabelas em qualquer ordem, apesar das
   chaves estrangeiras circulares (`posts`, `comentarios`), e o dump também
   acerta as sequências dos ids. Testado com um dump do cliente 17 restaurado
   no `db` 16: as contagens de usuários, poemas e `post_tags` e a sequência de
   `posts` bateram com a origem.
4. Confira e suba o resto:

   ```bash
   docker compose exec db psql -U verso -c "select count(*) from users" -c "select count(*) from posts"
   docker compose up -d                      # api, caddy e backup
   ```

   Volte `SEED_ON_BOOT=true` no `.env` se quiser (ele só age num banco sem
   usuários). Se o schema do Supabase for de uma versão antiga do Verso, rode
   antes o deploy antigo uma vez contra ele, para o `preparar_banco()` pôr as
   tabelas em dia.

## Alternativa: banco gerenciado no Supabase

O Supabase dá painel, SQL Editor e backups gerenciados, ao custo de mais
latência por consulta (o banco fica fora da VM) e de um teto de conexões.

1. Crie o projeto e pegue a connection string do **Session pooler** (porta
   **5432**): passo 1 do [`docs/deploy.md`](deploy.md#passo-1-banco-no-supabase).
   Crie o projeto na região mais perto da VM:

   | Supabase em | Região da Oracle mais perto |
   |---|---|
   | East US (North Virginia), `us-east-1` | US East (Ashburn) |
   | South America (São Paulo), `sa-east-1` | Brazil East (São Paulo) |

2. No `.env`, além do passo 7:

   ```text
   DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres   <<< COLE AQUI
   POSTGRES_PASSWORD=qualquer-coisa          (não é usada, mas o compose.yaml exige)
   WEB_CONCURRENCY=2
   DB_POOL_SIZE=4
   DB_MAX_OVERFLOW=2
   ```

3. Suba sem o `db` e sem o `backup`:

   ```bash
   docker compose -f compose.yaml -f compose.supabase.yaml up -d --build
   ```

   Use os mesmos `-f` em todo `docker compose` (ou
   `export COMPOSE_FILE=compose.yaml:compose.supabase.yaml`).

**Limite de conexões.** No Session pooler, cada conexão da API ocupa uma
conexão no Supabase, e o **Pool Size** do plano free é 15 (Database → Settings
→ Connection pooling). A conta que precisa fechar:

```text
WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW)  ≤  Pool Size − 3 (folga para o seed e o SQL Editor)
2 workers: 2 × (4 + 2) = 12   (medido no PR #130: 130 req/s, 0 erro, p95 de 1,2 s sem pausa)
4 workers: 4 × (2 + 1) = 12
```

Passar disso dá `too many clients` / `max clients reached` sob carga.

**Backup no Supabase.** O plano free não tem backup diário que você possa
baixar. Faça um dump manual antes da banca e depois de mudanças grandes, com o
cliente da mesma versão do Postgres do projeto:

```bash
docker run --rm -v "$PWD:/saida" postgres:17 pg_dump \
  "postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges -Fc -f /saida/verso-$(date +%F).dump
```

Guarde o `.dump` fora do repositório (ele tem os hashes de senha). Para
restaurar num banco vazio: `pg_restore --no-owner --no-privileges -d
"<DATABASE_URL>" verso-AAAA-MM-DD.dump`.

**Pausa.** Um projeto free sem uso por 7 dias é pausado: a API dá 500 no login
e no feed (o `/saude` continua 200). Abra o projeto e clique em **Restore
project**, e depois `docker compose restart api`.

## Testar tudo localmente antes

Com Docker na sua máquina, dá para subir a mesma pilha (`db`, `seed`, `api`,
`caddy` e `backup`), com o Caddy em portas altas e certificado interno e um
Object Storage falso (`rclone serve s3`) no lugar do da Oracle:

```bash
cd deploy/oracle
cp .env.local.example .env
export COMPOSE_FILE=compose.yaml:compose.local.yaml
docker compose up -d --build
curl -k https://localhost:8443/saude
curl -k https://localhost:8443/auth/login -H 'content-type: application/json' \
  -d '{"username":"marina_letras","password":"verso123"}'
docker compose exec backup backup.sh                     # backup + envio ao S3 falso
./restaurar.sh --listar
./restaurar.sh remoto:ultimo                             # teste de restauração
cd ../../backend && uv run python scripts/carga.py --url https://localhost:8443 --pausa 3
cd ../deploy/oracle && docker compose down -v && rm .env   # derruba e apaga o banco e os backups de teste
```

Para gerar a imagem ARM numa máquina x86 (opcional):

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx build --platform linux/arm64 -t verso-api:arm64 --load backend
```

## O que fazer se...

| Sintoma | Causa provável e solução |
|---|---|
| `docker compose up` diz `defina POSTGRES_PASSWORD no .env` | a linha está vazia: passo 7 |
| `seed` ou `api`: `password authentication failed for user "verso"` | a `POSTGRES_PASSWORD` mudou depois do primeiro `up` (o Postgres guarda a do volume). Volte a antiga, ou troque no banco: `docker compose exec db psql -U verso -c "alter user verso password '<nova>'"` |
| `db` reinicia sem parar | `docker compose logs db`; com o disco cheio, ver [Disco e memória da VM](#disco-e-memória-da-vm) |
| `too many clients already` | workers × pool passou do `max_connections`: [Workers e pool](#workers-e-pool) |
| `backup`: `ERRO: o envio para o Object Storage falhou` | endpoint, região ou chave erradas (passo 11), ou o bucket não existe. O dump local está no volume |
| `backup`: `SignatureDoesNotMatch` / `InvalidAccessKeyId` | `OCI_ACCESS_KEY` e `OCI_SECRET_KEY` trocados, ou a região do endpoint diferente de `OCI_REGIAO` |
| `api` não sobe e o `caddy` fica em `Created` | o `seed` falhou: `docker compose logs seed` |
| `blocked by CORS policy` no console do navegador | `CORS_ORIGINS` sem o domínio **exato** da Vercel (`https://`, sem barra). Edite o `.env` e `docker compose up -d` |
| O front chama `localhost:8000` | `NEXT_PUBLIC_API_URL` não estava no build da Vercel: defina e faça Redeploy |
| `curl https://<DOMINIO>` dá timeout | porta fechada: confira as **duas** barreiras do passo 4 (Security List e `iptables`) |
| Caddy: `challenge failed` / `timeout during connect` | o Let's Encrypt não alcança a porta 80 da VM (passo 4) ou o domínio não aponta para o IP (`nslookup`) |
| Caddy: `too many certificates` / `rateLimited` | limite do Let's Encrypt (comum em sslip.io, que é compartilhado). O Caddy tenta o ZeroSSL sozinho; se não der, use um subdomínio do DuckDNS. Não apague o volume `caddy_data` à toa: ele guarda o certificado |
| Navegador avisa "certificado inválido" | o Caddy ainda está pedindo o certificado (veja `docker compose logs caddy`) ou o `DOMINIO` do `.env` não é o mesmo da URL |
| `Out of capacity` ao criar a VM | passo 3, lista de soluções |
| `permission denied ... docker.sock` | faltou sair e entrar de novo depois do `usermod -aG docker ubuntu` |
| Disco cheio | [Disco e memória da VM](#disco-e-memória-da-vm) |
| Com o Supabase: `Network is unreachable`, `prepared statement ... already exists`, 500 com `/saude` 200 | Direct connection (IPv6), Transaction pooler (6543) ou projeto pausado: ver [Alternativa](#alternativa-banco-gerenciado-no-supabase) e o `docs/deploy.md` |
