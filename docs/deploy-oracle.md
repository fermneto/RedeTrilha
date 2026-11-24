# Deploy do Verso na Oracle Cloud (Always Free)

Este é o caminho principal do deploy. O Render (`docs/deploy.md`) fica como
alternativa simples, com a desvantagem de hibernar.

| Peça | Onde | O quê |
|---|---|---|
| Banco | Supabase | Postgres, pelo **Session pooler** (porta 5432) |
| Backend | VM da Oracle Cloud, ARM (Ampere A1), Ubuntu | Docker Compose: `seed` + `api` (uvicorn com vários workers) + `caddy` (HTTPS) |
| Front | Vercel | Next.js, com root directory `frontend` |

Meta: 100 usuários simultâneos com p95 abaixo de 1 s. A VM não hiberna (ao
contrário do Render free) e tem até 4 núcleos ARM e 24 GB de RAM sem custo.

Tudo o que está no repositório já vem pronto: `backend/Dockerfile`,
`deploy/oracle/compose.yaml`, `deploy/oracle/Caddyfile` e
`deploy/oracle/.env.example`. Você só cria as contas, segue os passos e cola as
credenciais nos lugares marcados com **`<<< COLE AQUI`**.

> **NUNCA defina `DEBUG`** no `.env` da VM, nem como `false`. Com
> `DEBUG=true`, o header `X-User-Id` entra como qualquer usuário, sem senha.

> **Segredos só no `.env` da VM.** O `deploy/oracle/.env` está no
> `.gitignore`. Nunca cole a `DATABASE_URL`, a `ANTHROPIC_API_KEY` ou o
> `SENTRY_DSN` em arquivo versionado, issue ou PR.

## Sumário

1. [Supabase e chave da Anthropic](#passo-1-supabase-e-chave-da-anthropic)
2. [Conta Always Free na Oracle](#passo-2-conta-always-free-na-oracle)
3. [Criar a VM ARM](#passo-3-criar-a-vm-arm-ampere-a1)
4. [Abrir as portas 80 e 443](#passo-4-abrir-as-portas-80-e-443)
5. [Instalar o Docker](#passo-5-instalar-o-docker)
6. [Domínio gratuito](#passo-6-domínio-gratuito)
7. [Clonar e configurar o `.env`](#passo-7-clonar-e-configurar-o-env)
8. [Subir com `docker compose up -d`](#passo-8-subir)
9. [Vercel e CORS](#passo-9-vercel-e-cors)
10. [Monitoramento](#passo-10-monitoramento-gratuito)
11. [Atualizar o deploy](#atualizar-o-deploy)
12. [Workers e pool](#workers-e-pool)
13. [Backups do Supabase](#backups-do-supabase)
14. [A Oracle pode recolher VMs ociosas](#a-oracle-pode-recolher-vms-ociosas)
15. [Testar tudo localmente](#testar-tudo-localmente-antes)
16. [O que fazer se...](#o-que-fazer-se)

## Passo 1: Supabase e chave da Anthropic

Siga os passos 1 e 2 do [`docs/deploy.md`](deploy.md#passo-1-banco-no-supabase):
eles valem igual aqui. Resumo do que você precisa ter em mãos:

- A connection string do **Session pooler** (porta **5432**), com a senha no
  lugar de `[YOUR-PASSWORD]`:
  `postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`
- (Opcional) a chave `sk-ant-...` de um workspace só da demo, com limite de
  gasto baixo. Sem ela, só a tradução fica fora (503).

Anote a **região do projeto do Supabase** (aparece em Project Settings →
General). A VM deve ficar perto dela: cada request da API faz várias consultas
ao banco, e cada consulta paga a distância de ida e volta.

| Supabase em | Região da Oracle mais perto |
|---|---|
| East US (North Virginia), `us-east-1` | US East (Ashburn) |
| South America (São Paulo), `sa-east-1` | Brazil East (São Paulo) |

## Passo 2: conta Always Free na Oracle

1. Em [oracle.com/cloud/free](https://www.oracle.com/cloud/free/): **Start for free**.
2. Preencha nome, e-mail e país. A Oracle pede um **cartão de crédito** só para
   verificar a identidade (faz uma pré-autorização pequena que é estornada). No
   plano Free Tier nada é cobrado: recursos pagos ficam bloqueados.
3. **Home Region:** escolha com cuidado, porque **não dá para mudar depois** e
   as VMs ARM gratuitas só podem ser criadas nela. Use a tabela do passo 1.
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
     OCPUs:              2          (máximo grátis: 4 no total da conta)
     Memory (GB):        12         (máximo grátis: 24 no total da conta)
   Networking:           Create new virtual cloud network (padrão) + Create new public subnet
                         Assign a public IPv4 address: Yes
   Add SSH keys:         Generate a key pair for me → Download private key (e a pública)
   Boot volume:          padrão (cerca de 47 GB; o grátis é até 200 GB no total)
   ```

   O selo **"Always Free-eligible"** deve aparecer ao lado do shape e da
   imagem. Se não aparecer, algo saiu do gratuito.

   2 OCPU e 12 GB sobram para a meta de 100 usuários. Se quiser, use 4 e 24
   (o total grátis), mas aí não sobra nada para outra VM.
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
2. Peça menos: **1 OCPU e 6 GB** costuma achar vaga; depois dá para aumentar
   (Instance → **Edit** → shape) quando houver capacidade.
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
nano .env
```

Preencha cada linha marcada com **`<<< COLE AQUI`** (no `nano`: Ctrl+O, Enter
para salvar; Ctrl+X para sair):

```text
DOMINIO=api.129-146-10-20.sslip.io                 <<< o domínio do passo 6, sem https://
ACME_EMAIL=seu-email@exemplo.com                   <<< seu e-mail (avisos do Let's Encrypt)
DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres   <<< passo 1
SEED_ON_BOOT=true                                  (deixe true: só popula um banco sem usuários)
CORS_ORIGINS=http://localhost:3000                 <<< por enquanto; o passo 9 troca pela URL da Vercel
ANTHROPIC_API_KEY=sk-ant-...                       <<< opcional, a chave da demo
SENTRY_DSN=                                        <<< opcional, passo 10
```

Os outros valores (`WEB_CONCURRENCY`, `DB_POOL_*`) já vêm com padrões seguros;
veja [Workers e pool](#workers-e-pool) antes de mexer.

Cuidados com o `.env`: sem aspas, sem espaço em volta do `=`, e nada de
comentário na mesma linha do valor. Se a senha do banco tiver `@ : / # %`,
gere outra só com letras e números no Supabase.

## Passo 8: subir

Ainda em `RedeTrilha/deploy/oracle`:

```bash
docker compose up -d --build
```

O primeiro build leva alguns minutos (compila a imagem para ARM na própria
VM). A ordem é automática:

1. **`seed`** cria as tabelas e, com o banco vazio, roda o seed (poetas do
   seed + consagrados). Pode levar alguns minutos no Supabase. Depois ele sai.
2. **`api`** só sobe quando o `seed` termina bem, e só fica "healthy" quando
   `/saude` responde.
3. **`caddy`** só sobe quando a `api` está healthy, e então pede o certificado.

Acompanhe:

```bash
docker compose ps -a            # seed: Exited (0); api: Up (healthy); caddy: Up
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
reiniciar. Os logs giram em 5 arquivos de 10 MB por serviço.

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

O `/saude` não consulta o banco. Para vigiar o Supabase também (ele pausa
depois de 7 dias sem uso), crie um segundo monitor do tipo **Keyword** em
`https://<DOMINIO>/usuarios?limit=1` procurando a palavra `total`: essa rota é
pública e lê do banco.

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
```

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
Num banco já em dia, isso é instantâneo. Os dados ficam no Supabase. A API fica fora do ar por alguns
segundos enquanto os workers reiniciam.

Consagrados novos (JSON novo em `backend/data/consagrados/`) não entram pelo
seed, porque o banco não está vazio. Rode o importador uma vez; as tags entram
no índice na mesma transação, sem reiniciar a API:

```bash
docker compose run --rm --entrypoint python seed scripts/importar_consagrados.py
```

## Workers e pool

A `api` roda o uvicorn com `WEB_CONCURRENCY` workers (processos). Vazio, o
padrão é `2 × núcleos + 1`, limitado a `WEB_CONCURRENCY_MAX` (4).

O `.env.example` vem com `WEB_CONCURRENCY=2` e o pool `4 + 2` por worker, a
configuração medida no PR #130 (130 req/s, 0 erro, p95 de 1,2 s). Vários
workers não dão problema: o índice de tags (tabela `post_tags`) e o limite de
traduções (contado em `traducoes`) moram no banco, então todo worker vê o mesmo
Em alta e o mesmo limite.

Cada worker abre o próprio pool de conexões. No Session pooler, cada conexão
da API ocupa uma conexão no Supabase, e o **Pool Size** do plano free é 15
(Supabase → Database → Settings → Connection pooling). A conta que precisa
fechar:

```text
WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW)  ≤  Pool Size − 3 (folga para o seed e o SQL Editor)
1 worker:  1 × (5 + 5) = 10
2 workers: 2 × (4 + 2) = 12   (o padrão do .env.example)
4 workers: 4 × (2 + 1) = 12
```

Passar disso dá `too many clients` / `max clients reached` sob carga (no teste
local com 8 workers e o pool padrão, foi o que aconteceu). As variáveis
`DB_POOL_*` são lidas pelo `backend/app/db.py`.

Compressão: o Caddy comprime as respostas (`encode zstd gzip`). Se a API
também tiver o `GZipMiddleware`, os dois convivem: o Caddy vê que a resposta
já veio com `Content-Encoding` e não comprime de novo.

## Backups do Supabase

- O plano free **não tem backup diário que você possa baixar** pelo painel.
  Faça um dump manual antes da banca e depois de mudanças grandes:

  ```bash
  # na sua máquina ou na VM, com o cliente do Postgres 15+ (sudo apt-get install postgresql-client)
  pg_dump "postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres" \
    --no-owner --no-privileges -Fc -f verso-$(date +%F).dump
  ```

  Guarde o `.dump` fora do repositório (ele tem os hashes de senha).
- Para restaurar num banco vazio:
  `pg_restore --no-owner --no-privileges -d "<DATABASE_URL>" verso-AAAA-MM-DD.dump`.
- Use a string do **Session pooler** (5432) também no `pg_dump`.

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

## Testar tudo localmente antes

Com Docker na sua máquina, dá para subir a mesma pilha com um Postgres
descartável no lugar do Supabase e o Caddy com certificado interno:

```bash
cd deploy/oracle
cp .env.local.example .env
docker compose -f compose.yaml -f compose.local.yaml up -d --build
curl -k https://localhost:8443/saude
curl -k https://localhost:8443/auth/login -H 'content-type: application/json' \
  -d '{"username":"marina_letras","password":"verso123"}'
docker compose -f compose.yaml -f compose.local.yaml down -v   # derruba e apaga o banco de teste
rm .env
```

Para gerar a imagem ARM numa máquina x86 (opcional):

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx build --platform linux/arm64 -t verso-api:arm64 --load backend
```

## O que fazer se...

| Sintoma | Causa provável e solução |
|---|---|
| `seed` sai com `Network is unreachable` | você colou a **Direct connection** do Supabase, que é só IPv6 (a VM e o Docker usam IPv4). Use o **Session pooler** |
| `prepared statement "..." already exists` | você colou o **Transaction pooler** (porta 6543), que não mantém sessão e quebra os prepared statements do psycopg. Use o Session pooler (5432) |
| `password authentication failed` | senha errada, ou o `[YOUR-PASSWORD]` ficou com colchetes |
| `too many clients` / `max clients reached` | workers × pool passou do Pool Size do Supabase: veja [Workers e pool](#workers-e-pool) |
| `api` não sobe e o `caddy` fica em `Created` | o `seed` falhou: `docker compose logs seed` |
| `blocked by CORS policy` no console do navegador | `CORS_ORIGINS` sem o domínio **exato** da Vercel (`https://`, sem barra). Edite o `.env` e `docker compose up -d` |
| O front chama `localhost:8000` | `NEXT_PUBLIC_API_URL` não estava no build da Vercel: defina e faça Redeploy |
| `curl https://<DOMINIO>` dá timeout | porta fechada: confira as **duas** barreiras do passo 4 (Security List e `iptables`) |
| Caddy: `challenge failed` / `timeout during connect` | o Let's Encrypt não alcança a porta 80 da VM (passo 4) ou o domínio não aponta para o IP (`nslookup`) |
| Caddy: `too many certificates` / `rateLimited` | limite do Let's Encrypt (comum em sslip.io, que é compartilhado). O Caddy tenta o ZeroSSL sozinho; se não der, use um subdomínio do DuckDNS. Não apague o volume `caddy_data` à toa: ele guarda o certificado |
| Navegador avisa "certificado inválido" | o Caddy ainda está pedindo o certificado (veja `docker compose logs caddy`) ou o `DOMINIO` do `.env` não é o mesmo da URL |
| 500 no login e no feed, mas `/saude` dá 200 | o projeto do Supabase foi pausado (7 dias sem uso): **Restore project** e depois `docker compose restart api` |
| `Out of capacity` ao criar a VM | passo 3, lista de soluções |
| `permission denied ... docker.sock` | faltou sair e entrar de novo depois do `usermod -aG docker ubuntu` |
| Disco cheio | `docker image prune -f` e `docker builder prune -f` |
