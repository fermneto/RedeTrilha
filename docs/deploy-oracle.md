# Deploy do Verso na Oracle Cloud (Always Free)

Este é o caminho principal do deploy: a API **e o banco** numa VM da Oracle,
o front na Vercel. O Render com o Supabase (`docs/deploy.md`) fica como
alternativa simples, com a desvantagem de hibernar.

| Peça | Onde | O quê |
|---|---|---|
| Banco | a mesma VM da Oracle | Postgres 16 no Docker Compose (serviço `db`), sem porta pública, com backup diário para o Object Storage da Oracle |
| Backend | VM da Oracle Cloud, ARM (Ampere A1), Ubuntu | Docker Compose: `db` + `seed` + duas réplicas da API, `api_1` e `api_2` (uvicorn) + `caddy` (HTTPS e balanceador entre as réplicas) + `backup` |
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
`deploy/oracle/backup/`, `deploy/oracle/restaurar.sh`, `deploy/oracle/atualizar.sh` e
`deploy/oracle/.env.example`. Você só cria as contas, segue os passos e cola as
credenciais nos lugares marcados com **`<<< COLE AQUI`**.

> **NUNCA defina `DEBUG`** no `.env` da VM, nem como `false`. Com
> `DEBUG=true`, o header `X-User-Id` entra como qualquer usuário, sem senha.

> **Segredos só no `.env` da VM.** O `deploy/oracle/.env` está no
> `.gitignore`. Nunca cole a `POSTGRES_PASSWORD`, as chaves do Object Storage,
> a `ANTHROPIC_API_KEY` ou o `SENTRY_DSN` em arquivo versionado, issue ou PR.

## Checklist de progresso

Marque conforme for fazendo. A conta da Oracle pode levar de minutos a um dia
para liberar a VM (capacidade ou upgrade, passo 3): o bloco **A** não depende
dela e pode ser feito em paralelo enquanto se espera.

**A. Em paralelo, sem a VM**

- [ ] Conta da Oracle criada, Home Region escolhida (passo 2)
- [ ] (Se for fazer o upgrade) Budget de US$ 1 com alerta por e-mail, e o upgrade para Pay As You Go pedido (passo 3, "Out of capacity")
- [ ] Bucket `verso-backups`, namespace anotado e Customer Secret Key gerada (passo 11, itens 1 a 3)
- [ ] Chave da Anthropic num workspace só da demo, com limite de gasto (passo 1)
- [ ] Repo importado na Vercel com Root Directory `frontend`, ainda sem `NEXT_PUBLIC_API_URL` (passo 9; o primeiro build pode sair apontando para `localhost`, tudo bem)
- [ ] Domínio `verso.net.br` ativo no Registro.br e ligado ao front na Vercel, com `www` (passo 6 e passo 9, parte A)
- [ ] Contas criadas no UptimeRobot e no Sentry (passo 10; os monitores e o DSN entram depois)

**B. Depende da VM**

- [ ] VM criada, com IP público, e SSH funcionando (passo 3)
- [ ] Portas 80 e 443 abertas na Security List e no `iptables` (passo 4)
- [ ] Docker instalado (passo 5)
- [ ] Registro **A** de `api.verso.net.br` → IP da VM no Registro.br, e `nslookup` respondendo (passo 6)
- [ ] `.env` preenchido (passo 7)
- [ ] `docker compose up -d --build` e os testes com `curl` (passo 8)
- [ ] `NEXT_PUBLIC_API_URL=https://api.verso.net.br` na Vercel, Redeploy, e o `CORS_ORIGINS` com `verso.net.br`, `www` e o da Vercel (passo 9, parte B)
- [ ] Monitores do UptimeRobot e `SENTRY_DSN` no `.env` (passo 10)
- [ ] Primeiro backup enviado ao Object Storage e teste de restauração ok (passo 11 e "Restaurar um backup")
- [ ] Avisar o time para rodar o teste de carga contra a URL pública (`backend/scripts/carga.py`, "Workers e pool")

**Plano B.** Se a VM não sair a tempo da entrega, o caminho Render + Supabase
do [`docs/deploy.md`](deploy.md) continua valendo: menos passos, mas aguenta
menos carga (0,1 CPU, 1 worker) e hiberna depois de 15 minutos sem tráfego.
Os itens da Anthropic e da Vercel do bloco A servem para os dois caminhos.

## Sumário

1. [Chave da Anthropic e região](#passo-1-chave-da-anthropic-e-região)
2. [Conta Always Free na Oracle](#passo-2-conta-always-free-na-oracle)
3. [Criar a VM ARM](#passo-3-criar-a-vm-arm-ampere-a1)
4. [Abrir as portas 80 e 443](#passo-4-abrir-as-portas-80-e-443)
5. [Instalar o Docker](#passo-5-instalar-o-docker)
6. [Domínio `verso.net.br`](#passo-6-domínio-versonetbr)
7. [Clonar e configurar o `.env`](#passo-7-clonar-e-configurar-o-env)
8. [Subir com `docker compose up -d`](#passo-8-subir)
9. [Vercel e CORS](#passo-9-vercel-e-cors)
10. [Monitoramento](#passo-10-monitoramento-gratuito)
11. [Backup no Object Storage](#passo-11-backup-no-object-storage)
12. [Restaurar um backup](#restaurar-um-backup)
13. [Disco e memória da VM](#disco-e-memória-da-vm)
14. [Atualizar o deploy](#atualizar-o-deploy)
15. [Balanceamento entre as réplicas](#balanceamento-entre-as-réplicas)
16. [Workers e pool](#workers-e-pool)
17. [A Oracle pode recolher VMs ociosas](#a-oracle-pode-recolher-vms-ociosas)
18. [Migrar os dados do Supabase](#migrar-os-dados-do-supabase-opcional)
19. [Alternativa: banco gerenciado no Supabase](#alternativa-banco-gerenciado-no-supabase)
20. [Testar tudo localmente](#testar-tudo-localmente-antes)
21. [O que fazer se...](#o-que-fazer-se)

## Passo 1: chave da Anthropic e região

- (Opcional) a chave `sk-ant-...` de um workspace só da demo, com limite de
  gasto baixo: passo 2 do [`docs/deploy.md`](deploy.md#passo-2-chave-da-anthropic-só-para-a-demo).
  Sem ela, só a tradução fica fora (503).
- A **região** da VM: como a API e o banco ficam juntos, o que pesa é a
  distância até quem usa a rede. Para a banca e os colegas no Brasil, **Brazil
  East (São Paulo)**, `sa-saopaulo-1`. O front na Vercel é servido pela CDN e
  chama a API direto do navegador.
- São Paulo tem **um único availability domain** (AD-1): quando falta
  capacidade de ARM lá, não há outro AD para tentar (passo 3, "Out of
  capacity").

## Passo 2: conta Always Free na Oracle

1. Em [oracle.com/cloud/free](https://www.oracle.com/cloud/free/): **Start for free**.
2. Preencha nome, e-mail e país. A Oracle pede um **cartão de crédito** só para
   verificar a identidade (faz uma pré-autorização pequena que é estornada). No
   plano Free Tier nada é cobrado: recursos pagos ficam bloqueados.
3. **Home Region:** escolha com cuidado, porque ela é **permanente** (não dá
   para mudar depois) e as VMs ARM gratuitas só podem ser criadas nela. Use a
   região do passo 1 (Brazil East, São Paulo).
4. Espere o e-mail "Your Oracle Cloud account is ready" (de minutos a algumas
   horas) e entre em [cloud.oracle.com](https://cloud.oracle.com).

## Passo 3: criar a VM ARM (Ampere A1)

### 3a. Criar a rede antes (VCN Wizard)

Criando a rede pela tela da VM ("Create new virtual cloud network" + "Create
new public subnet"), a chave **"Automatically assign public IPv4 address"**
fica desligada e travada, com o aviso *"You must select a public subnet"*. Sem
IP público, a VM fica inalcançável. Por isso, crie a rede primeiro:

1. Menu ☰ → **Networking** → **Virtual cloud networks** → **Actions** →
   **Start VCN Wizard**.
2. Escolha **Create VCN with Internet Connectivity** → **Start VCN Wizard**.
3. **VCN name:** `verso-vcn`; o resto no padrão (ele cria a public subnet, a
   private subnet, o Internet Gateway e as rotas) → **Next** → **Create**.

### 3b. Criar a VM

1. Menu ☰ → **Compute** → **Instances** → **Create instance**.
2. Preencha:

   ```text
   Name:                 verso-api
   Placement:            AD-1 (São Paulo só tem este); sem fault domain
   Image:                Change image → Ubuntu → Canonical Ubuntu 24.04 (a versão aarch64 vem sozinha)
   Shape:                Change shape → Ampere → marque a linha VM.Standard.A1.Flex
     Number of OCPUs:            4     (o Always Free dá até 4 OCPU no total de A1)
     Amount of memory (GB):      24    (e até 24 GB no total)
                         → Select shape
   Security:             Shielded instance e Confidential computing: pode deixar desligado
   Networking:           Select existing virtual cloud network → verso-vcn
                         Subnet: a public subnet (public subnet-verso-vcn)
                         Automatically assign public IPv4 address: ligado (agora a chave libera)
                         Network security groups: desmarcado (usamos a Security List, passo 4)
   Add SSH keys:         Generate a key pair for me → Download private key (e a pública)
                         BAIXE A CHAVE PRIVADA ANTES DE CRIAR: ela não aparece de novo
   Storage:              Boot volume → Specify a custom boot volume size → 100 GB
                         VPU: 10 (Balanced)
                         Use in-transit encryption: ligado
                         Encryption: chaves gerenciadas pela Oracle
                         Block volumes: nenhum
   ```

   O selo **"Always Free-eligible"** deve aparecer ao lado do shape e da
   imagem. Se não aparecer, algo saiu do gratuito.

   4 OCPU e 24 GB podem ser **uma VM só, gratuita**: é todo o A1 do Always
   Free (não sobra nada para outra VM). Com a API e o Postgres juntos, é o que
   fecha a meta de p95 abaixo de 1 s até sem pausa entre os cliques
   ([Workers e pool](#workers-e-pool)). Se não houver capacidade, peça 2 OCPU
   e 12 GB (a meta fecha com gente navegando, não sem pausa) ou 1 OCPU e 6 GB,
   e aumente depois (abaixo). O boot volume de 100 GB cabe nos 200 GB grátis
   e sobra espaço para os backups e as imagens do Docker.
3. **Create**. Em um ou dois minutos o estado fica **Running**. Anote o
   **Public IPv4 address** (ex.: `129.146.10.20`).

   IP público da VM: `___.___.___.___`   **<<< ANOTE AQUI**

   Se a VM saiu sem IP público (criada antes do passo 3a): Instance →
   **Attached VNICs** → a VNIC → **IPv4 Addresses** → no IP privado, **⋮** →
   **Edit** → **Public IP type: Ephemeral public IP** → **Update**.
4. Guarde a chave privada (`ssh-key-AAAA-MM-DD.key`) fora do repositório e
   entre na VM:

   ```bash
   chmod 600 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP-PUBLICO>
   ```

**Aumentar a VM depois** (criou com 1/6 ou 2/12): Instance → **Edit** →
**Shape** → **Change shape** → 4 OCPU e 24 GB → **Save changes**. A VM
reinicia e não perde nada: o disco, o IP e os volumes do Docker ficam.
Enquanto a VM for menor, reduza a memória do Postgres no `.env` ([Disco e
memória](#disco-e-memória-da-vm)).

### "Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1"

É comum, principalmente em São Paulo (um AD só) e Ashburn. O que fazer:

1. **Peça uma shape menor**: 2 OCPU / 12 GB, ou 1 OCPU / 6 GB, que costuma
   achar vaga. Aumente depois (acima).
2. **Tente em outros horários** (madrugada e fim de semana costumam ter vaga).
   Não escolha fault domain: deixe a Oracle escolher.
3. **O mais eficaz: upgrade para Pay As You Go.** Contas pagas têm prioridade
   de capacidade, e o que está no Always Free continua sem custo: A1 até
   4 OCPU / 24 GB, 200 GB de disco, 20 GB de Object Storage e 10 TB/mês de
   tráfego de saída. O upgrade também tira a regra de recolher VMs ociosas
   ([abaixo](#a-oracle-pode-recolher-vms-ociosas)).

   **Antes do upgrade, crie um alerta de gasto:** Menu ☰ → **Billing & Cost
   Management** → **Budgets** → **Create Budget**:

   ```text
   Name:              verso-alerta
   Target:            Compartment (o root)
   Budget amount:     1        (US$ 1 por mês)
   Threshold metric:  Actual Spend
   Threshold:         Percentage of budget: 1
   Email recipients:  o seu e-mail
   ```

   Qualquer gasto real, de qualquer centavo, gera um e-mail.

   Depois: **Billing & Cost Management** → **Upgrade and Manage Payment** →
   **Pay As You Go**. O upgrade leva de minutos a horas (às vezes até 24 h).
   Acompanhe na mesma página: o estado passa de **"Upgrade in progress"** para
   **"Pay As You Go"**. Se passar de um dia, abra um chamado no suporte
   (Help → **Create support request**). Enquanto espera, adiante o bloco A do
   [checklist](#checklist-de-progresso).

   **Com a conta paga, não crie** o que cobraria: outras shapes (qualquer coisa
   além de VM.Standard.A1.Flex e das micro E2), discos que passem de 200 GB no
   total ou com VPU acima de 10, e Object Storage acima de 20 GB. O selo
   "Always Free-eligible" na tela de criação ajuda a conferir.

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

## Passo 6: domínio `verso.net.br`

O Verso tem domínio próprio, **`verso.net.br`**, registrado no Registro.br:

| Endereço | Para onde aponta | Registro no DNS |
|---|---|---|
| `verso.net.br` e `www.verso.net.br` | o **front**, na Vercel | os que a Vercel mostrar (passo 9) |
| `api.verso.net.br` | a **API**, na VM (Caddy) | **A** → o IP público da VM |

O Caddy pede o certificado HTTPS de `api.verso.net.br` ao Let's Encrypt
sozinho, mas só consegue depois que esse nome aponta para o IP da VM e as
portas 80 e 443 estão abertas (passo 4). Por isso a ordem importa:
**crie o registro da API depois de ter o IP da VM e antes do passo 8**.

**Quando fazer cada parte:**

- **Já, antes da VM:** confira no [registro.br](https://registro.br) que o
  domínio está ativo e que o DNS é o do próprio Registro.br ("Utilizar os
  servidores DNS do Registro.br"). Domínio novo pode levar algumas horas para
  ativar. O front pode ganhar o domínio já (passo 9, parte A).
- **Com o IP da VM na mão (depois do passo 3):** crie o registro da API.
- **Depois da API no ar (passo 8):** aponte o front para ela (passo 9, parte B).

**Criar o registro da API no Registro.br:**

1. Entre em [registro.br](https://registro.br) → **Meus domínios** → `verso.net.br`.
2. Em **DNS** → **Configurar zona DNS** (ou "Editar zona", modo avançado).
3. **Nova entrada**: tipo **A**, nome **`api`**, valor **o IP público da VM**,
   TTL o padrão (ou 300 s, para poder trocar rápido). Salve.
4. Confira na sua máquina (pode levar de minutos a algumas horas; com TTL
   curto, costuma ser rápido):

   ```bash
   nslookup api.verso.net.br    # tem que responder o IP da VM
   ```

O `DOMINIO` do `.env` (passo 7) é `api.verso.net.br`.

**Sem o domínio ainda resolvendo** (ou para testar antes): use
`api.<IP-com-traços>.sslip.io` (ex.: `api.129-146-10-20.sslip.io`), que já
resolve para o IP escrito nele, e troque depois: mude o `DOMINIO` no `.env`,
`docker compose up -d` (o Caddy pede o certificado novo), e o
`NEXT_PUBLIC_API_URL` na Vercel, com Redeploy.

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
DOMINIO=api.verso.net.br                           <<< o domínio do passo 6, sem https://
ACME_EMAIL=seu-email@exemplo.com                   <<< seu e-mail (avisos do Let's Encrypt)
POSTGRES_PASSWORD=3f9c...                          <<< a saída do openssl rand -hex 24
SEED_ON_BOOT=true                                  (deixe true: só popula um banco sem usuários)
CORS_ORIGINS=http://localhost:3000                 <<< por enquanto; o passo 9 troca pela URL da Vercel
ANTHROPIC_API_KEY=sk-ant-...                       <<< opcional, a chave da demo
SENTRY_DSN=                                        <<< opcional, passo 10
OCI_S3_ENDPOINT=, OCI_ACCESS_KEY=, OCI_SECRET_KEY=  <<< passo 11 (OCI_BUCKET e OCI_REGIAO já vêm
                                                       preenchidos; sem as chaves, só o backup local)
```

Não há `DATABASE_URL` para colar: o `compose.yaml` monta
`postgresql://verso:<POSTGRES_PASSWORD>@db:5432/verso` para as réplicas da API e o
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
3. **`api_1` e `api_2`**, as duas réplicas da API, só sobem quando o `seed`
   termina bem, e cada uma só fica "healthy" quando o `/saude` dela responde.
4. **`caddy`** só sobe quando as duas réplicas estão healthy, e então pede o
   certificado. Ele divide as requisições entre elas ([Balanceamento entre as
   réplicas](#balanceamento-entre-as-réplicas)).

Acompanhe:

```bash
docker compose ps -a            # db, api_1 e api_2: Up (healthy); seed: Exited (0); caddy e backup: Up
docker compose logs -f seed     # "seed ok: ... usuarios ..." e "banco pronto"
docker compose logs -f caddy    # "certificate obtained successfully"
```

Por que um serviço `seed` separado: a API roda em duas réplicas, cada uma com
os seus workers, e cada worker executa o startup. Se todos rodassem o seed ao
mesmo tempo, os dados duplicariam ou o boot travaria. O `seed` roda uma vez,
antes; as réplicas sempre sobem com `SEED_ON_BOOT=false` (forçado no
`compose.yaml`). Como rede de
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

## Passo 9: Vercel, domínio do front e CORS

O front lê a URL da API de **`NEXT_PUBLIC_API_URL`** (ver
`frontend/.env.local.example` e `frontend/lib/api.ts`).

**Parte A: o domínio do front (pode ser feito já, antes da VM).**

1. Na Vercel: projeto **verso** → **Settings → Domains** → **Add** →
   `verso.net.br`. Aceite também `www.verso.net.br` (a Vercel sugere
   redirecionar um para o outro: deixe o `www` redirecionando para
   `verso.net.br`).
2. A Vercel mostra os registros que faltam no DNS. No Registro.br (mesma
   tela do passo 6), crie **exatamente os valores que a Vercel mostrar**.
   Em geral são:
   - tipo **A**, nome vazio (o próprio `verso.net.br`), valor o IP que a
     Vercel indicar;
   - tipo **CNAME**, nome **`www`**, valor o endereço que a Vercel indicar
     (algo como `cname.vercel-dns.com`).
3. Espere a Vercel mostrar **Valid Configuration** nos dois. Ela emite o
   HTTPS sozinha. A URL `https://verso-blond.vercel.app` continua
   funcionando.

**Parte B: apontar o front para a API (depois do passo 8, com a API no ar).**

1. Em **Settings → Environment Variables** (Production):

   ```text
   NEXT_PUBLIC_API_URL = https://api.verso.net.br    <<< com https, sem barra no fim
   ```

   Essa variável entra no JavaScript **no build**: depois de mudar, faça
   **Redeploy** na Vercel.

2. Volte à VM e ponha no CORS os endereços exatos do front:

   ```bash
   cd ~/RedeTrilha/deploy/oracle
   nano .env
   # CORS_ORIGINS=https://verso.net.br,https://www.verso.net.br,https://verso-blond.vercel.app
   ./atualizar.sh --sem-pull                         # recria as réplicas com o .env novo, uma de cada vez
   ```

   Para o dev local também falar com a produção, acrescente
   `,http://localhost:3000`.

Depois disso, rode o [checklist da banca](deploy.md#checklist-de-verificação-o-que-a-banca-faz)
trocando a URL do Render pela sua.

## Passo 10: monitoramento gratuito

### Ping externo (UptimeRobot)

1. Crie a conta em [uptimerobot.com](https://uptimerobot.com) (plano free).
   O cadastro já pede a URL do primeiro monitor: se a API ainda não estiver no
   ar, use a URL da Vercel (o front já responde) e crie o da API depois. A
   lista de "próximos passos" que aparece em seguida (alertas por app, SSL,
   "cubra cada página", API) é opcional: os alertas por e-mail já vêm ligados.
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

1. Em [sentry.io](https://sentry.io) (plano Developer, grátis): se o cadastro
   perguntar os produtos, marque **só Error Monitoring** (Tracing, Session
   Replay, Profiling e Logs gastam a cota e não são usados). Depois, **Create
   Project** → plataforma **FastAPI** (ou Python), nome `verso-api` → copie o
   **DSN** (`https://...@o....ingest.sentry.io/...`). Não precisa seguir o
   código de instalação da tela: o backend já tem a integração. Perdeu o DSN?
   Settings → Projects → verso-api → Client Keys (DSN).
2. No `.env` da VM: `SENTRY_DSN=<o DSN>`   **<<< COLE AQUI**, e
   `docker compose up -d`.
3. Para desligar: apague o valor e `docker compose up -d` de novo.

Por padrão só erros são enviados (`SENTRY_TRACES_SAMPLE_RATE=0`); traces
gastam a cota grátis.

### Logs

Cada erro 500 vira **uma linha JSON** no log da API, com método, rota, tipo e
mensagem do erro:

```bash
docker compose logs api_1 api_2 | grep erro_interno
docker compose logs --since 1h caddy      # acessos, em JSON (o campo upstream diz qual réplica respondeu)
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
**Object Storage** da Oracle, pela API compatível com S3 e com o `rclone`. O
Always Free dá 20 GB no total da conta, e sobra: cada backup tem poucos MB, e
o bucket guarda no máximo uns 11. O que fazer na conta, uma vez:

1. **Bucket.** Menu ☰ → **Storage** → **Object Storage & Archive Storage** →
   **Buckets**. Antes de criar, confira:
   - **Compartment:** `root` (o da tenancy). A API compatível com S3 procura
     os buckets no compartimento designado para ela, que por padrão é o root;
     num outro compartimento, o `rclone` não acha o bucket.
   - **Região** (topo do console): **Brazil East (Sao Paulo)**.

   **Create Bucket**:

   ```text
   Bucket Name:            verso-backups
   Default Storage Tier:   Standard      (não Archive: o Archive leva horas para devolver um arquivo)
   Enable Auto-Tiering:    desligado
   Enable Object Versioning: desligado
   Emit Object Events:     desligado
   Encryption:             Encrypt using Oracle managed keys
   ```

   O bucket nasce **privado** (Visibility: Private); deixe assim. → **Create**.
2. **Namespace.** Abra o bucket: em **Bucket Information**, anote o
   **Namespace** (uma sequência como `axk1abcd2efg`). Com ele e a região, o
   endpoint S3 é:

   ```text
   https://<namespace>.compat.objectstorage.sa-saopaulo-1.oraclecloud.com
   ex.: https://axk1abcd2efg.compat.objectstorage.sa-saopaulo-1.oraclecloud.com
   ```

   (A Oracle também documenta o domínio novo,
   `<namespace>.compat.objectstorage.sa-saopaulo-1.oci.customer-oci.com`; os
   dois levam ao mesmo lugar.)
3. **Customer Secret Key.** Menu do perfil (canto superior direito) → **My
   profile** → **Customer secret keys** (em algumas contas, dentro de **Tokens
   and keys**) → **Generate secret key** → nome `verso-backup` → **Generate
   secret key**. Copie o **Secret Key** na hora: ele aparece **uma vez só**.
   Feche a janela e copie o **Access Key** da linha nova na lista. Cada usuário
   pode ter até duas chaves; elas não expiram, então apague esta depois da
   entrega se não for manter o deploy.

   **Onde cada valor entra no `.env`** (todos marcados com `<<< COLE AQUI` no
   `.env.example`):

   ```text
   OCI_BUCKET=verso-backups
   OCI_S3_ENDPOINT=https://<namespace>.compat.objectstorage.sa-saopaulo-1.oraclecloud.com
   OCI_REGIAO=sa-saopaulo-1
   OCI_ACCESS_KEY=<o Access Key da lista>
   OCI_SECRET_KEY=<o Secret Key copiado na geração>
   ```

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

O boot volume do passo 3 tem 100 GB (o padrão seria uns 47 GB), e nele moram o sistema, as imagens do
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

Depois de um merge na `main`, sem tirar a API do ar:

```bash
cd ~/RedeTrilha/deploy/oracle && ./atualizar.sh
docker image prune -f        # apaga as imagens antigas (libera disco)
```

O `atualizar.sh` faz, em ordem:

1. `git pull` e `docker compose build`, com as duas réplicas ainda atendendo.
2. O `seed` roda uma vez, antes das réplicas. Ele vê que o banco já tem
   usuários e só põe o banco em dia (`banco pronto`): cria os índices novos em
   tabelas que já existiam e, se a tabela `post_tags` estiver vazia, popula o
   índice de tags a partir dos posts. Num banco já em dia, isso é instantâneo.
   Se o `seed` falhar, o script para ali, com as réplicas antigas no ar.
3. Recria a `api_1` com a imagem nova. Enquanto ela sobe, o Caddy manda tudo
   para a `api_2`. O script espera a `api_1` ficar healthy (o `/saude` dela
   responde, conferido a cada 2 s) e mais 5 s para o Caddy a pôr de volta na
   roda, e só então faz o mesmo com a `api_2`.
4. Se o `Caddyfile` mudou, reinicia o `caddy` (as conexões abertas caem por
   cerca de 1 s e voltam; é o único passo com queda, e só quando o `Caddyfile`
   muda). O `db` não é recriado (a imagem não mudou) e os dados ficam no volume
   `pgdata`.

`./atualizar.sh --sem-pull` faz o mesmo sem o `git pull` (por exemplo, depois
de editar o `.env`); `--recriar` reinicia as réplicas mesmo sem nada novo. Não
use `docker compose up -d --build` para atualizar: ele recria as duas réplicas
ao mesmo tempo, e a API fica fora do ar por alguns segundos.

Consagrados novos (JSON novo em `backend/data/consagrados/`) não entram pelo
seed, porque o banco não está vazio. Rode o importador uma vez; as tags entram
no índice na mesma transação, sem reiniciar a API:

```bash
docker compose run --rm --entrypoint python seed scripts/importar_consagrados.py
```


Nunca rode `docker compose down -v` na VM: o `-v` apaga os volumes, ou seja, o
banco e os backups locais. Para parar tudo, `docker compose down` (sem `-v`).

## Balanceamento entre as réplicas

A API roda em duas réplicas na mesma VM, `api_1` e `api_2`: a mesma imagem e a
mesma configuração (a âncora `x-api` do `compose.yaml`), cada uma com os seus
workers. O Caddy é o balanceador entre elas:

```text
visitante ── HTTPS ──> caddy ──┬──> api_1 (uvicorn, WEB_CONCURRENCY workers) ──┐
                               └──> api_2 (uvicorn, WEB_CONCURRENCY workers) ──┴──> db
```

Por que duas réplicas numa VM só: se um processo da API trava, morre ou está
sendo atualizado, a outra réplica atende, e o `atualizar.sh` troca a versão
sem queda. Não protege contra a VM cair (as duas estão nela).

O que o `Caddyfile` faz:

- **Health check ativo:** `GET /saude` em cada réplica a cada 2 s, com 2 s de
  timeout. Duas falhas seguidas tiram a réplica da roda; uma resposta boa a
  devolve.
- **Health check passivo:** uma requisição que não consegue conectar tira a
  réplica por 10 s (`fail_duration`), sem esperar o próximo `/saude`. Um 500 da
  API não conta: é erro da rota, não da réplica.
- **Tentar a outra réplica:** até 2 vezes, por até 5 s (`lb_retries`,
  `lb_try_duration`). Se a conexão falhou, a requisição não chegou à API e o
  Caddy tenta de novo qualquer método. Se ela chegou e a resposta falhou no
  meio, só `GET` e `HEAD` são repetidos (`lb_retry_match`): um `POST`
  (publicar, curtir, mandar mensagem) nunca vai duas vezes; ele recebe 502 e o
  front mostra o erro.
- **Política:** `round_robin` nas rotas comuns (uma réplica de cada vez) e
  `least_conn` no stream das mensagens (`/mensagens/stream`, sem compressão e
  com `flush_interval -1`). O `least_conn` conta as conexões abertas: nos
  streams, isso espalha os streams entre as duas réplicas. Nas rotas comuns,
  contaria os streams como carga e, depois de um deploy (com os streams todos
  na réplica que ficou de pé), mandaria todas as requisições para a outra.
- **Stream que cai:** quando a réplica do stream para, a conexão fecha; o front
  reconecta sozinho (1 s, 2 s, 4 s...) e o Caddy o manda para a réplica de pé.
  Ao reabrir, o front busca o que chegou enquanto esteve fora.

Qual réplica está fora:

```bash
docker compose ps api_1 api_2      # Up (healthy), Up (unhealthy) ou Exited
docker compose logs --since 10m caddy | grep health_checker   # "HTTP request failed" (fora) e "host is up" (voltou)
docker compose logs --since 1m caddy | grep -o '"upstream":"[^"]*"' | sort | uniq -c   # quem respondeu
docker compose exec caddy wget -qO- 127.0.0.1:2019/reverse_proxy/upstreams   # requisições em voo e falhas
```

Cada linha de acesso do log do Caddy leva o campo `upstream` (`api_1:8000` ou
`api_2:8000`). Uma réplica parada some dessa contagem; `docker compose up -d
api_1` a sobe de novo, e o Caddy a põe na roda no primeiro `/saude` bom.

## Workers e pool

Cada réplica da API (`api_1` e `api_2`) roda o uvicorn com `WEB_CONCURRENCY`
workers (processos). Vazio, o padrão é `2 × núcleos + 1`, limitado a
`WEB_CONCURRENCY_MAX` (2). Várias réplicas e vários workers não dão problema: o
índice de tags (tabela `post_tags`) e o limite de traduções (contado em
`traducoes`) moram no banco, então todo processo vê o mesmo Em alta e o mesmo
limite.

Cada worker abre o próprio pool de conexões (`DB_POOL_*`, lidos pelo
`backend/app/db.py`) e deixa no máximo `DB_POOL_SIZE + DB_MAX_OVERFLOW`
requisições em voo (`app/limite_do_banco.py`). A conta que precisa fechar é
contra o `max_connections` do `db` (60, no `compose.yaml`):

```text
réplicas × WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW + 1) + folga ≤ max_connections
2 réplicas × 1 worker  × (4 + 2 + 1) = 14   ← o padrão do .env.example (medido, abaixo)
2 réplicas × 2 workers × (4 + 2 + 1) = 28   ← o teto WEB_CONCURRENCY_MAX=2
folga (8): backup (1), restauração (2), seed (1), psql de manutenção (1), 3 reservadas ao superusuário
```

Mudou o número de workers ou o pool e passou de 60? Suba o `max_connections`
no `compose.yaml` junto (cada conexão ociosa custa poucos MB). Passar disso dá
`too many clients already` sob carga.

O `+ 1` é a conexão do `LISTEN` das mensagens diretas: cada worker abre uma,
fora do pool, para receber pelo Postgres `NOTIFY` os eventos das mensagens
enviadas pelos outros workers, inclusive os da outra réplica
(`backend/app/tempo_real.py`). O stream das mensagens (`GET /mensagens/stream`)
não usa conexão do pool: ele autentica com uma consulta curta e depois só
espera eventos. Durante o `atualizar.sh` a conta não dobra: a réplica antiga
para antes de a nova subir.

O padrão do `.env.example` é **2 réplicas com 1 worker cada** (pool 4 + 2).
Medido com `backend/scripts/carga.py` (100 usuários logados, mix de 14 rotas de
leitura, 30 s, pelo Caddy com HTTPS) contra o compose local com o seed
completo (184 usuários, 11.336 poemas), com `db`, as réplicas e o `caddy`
presos a 4 núcleos (a VM do guia). Cada célula traz as rodadas; 0 erro em
todas:

| Réplicas × workers | Pausa média de 3 s | Sem pausa (100 requisições sempre em voo) |
|---|---|---|
| **2 × 1 (padrão)** | 26 a 27 req/s, **p95 92 e 80 ms** | 118 e 119 req/s, p95 1.175 e 1.118 ms |
| 2 × 2 | 27 req/s, p95 86 e 65 ms | 154 e 155 req/s, p95 1.037 e 1.126 ms |
| 1 × 1 (uma réplica fora) | 27 a 29 req/s, p95 102 e 104 ms | 66 e 71 req/s, p95 1.742 e 1.644 ms |
| 1 × 2 (como era antes) | 27 req/s, p95 115 e 66 ms | 95 e 112 req/s, p95 1.528 e 1.137 ms |

Esta máquina estava dividida com outros processos, então os números de agora
saíram mais altos que os da tabela de antes, abaixo; compare as linhas entre
si. Com a pausa (gente navegando), tudo fica bem abaixo da meta de 1 s, e
com uma réplica fora o p95 sobe pouco (de 80 a 92 para 102 a 104 ms).

**Por que 1 worker por réplica, e não 2.** Com 2 workers, o uvicorn tem um
processo pai que guarda a porta 8000 aberta enquanto os workers desligam. Ao
parar uma réplica, o sistema continua aceitando conexões nessa porta, mas
ninguém as atende: as requisições que o Caddy manda nos primeiros segundos
(antes de o `/saude` falhar duas vezes) ficam paradas até o fim do
`TIMEOUT_GRACEFUL_SHUTDOWN` (20 s) e voltam com 502, tarde demais para tentar
a outra réplica. Medido: derrubar uma réplica com 2 workers deu 39 erros nas
leituras e 4 nos envios de mensagem (p99 de 18 s); com 1 worker, o processo
único fecha a porta na hora, a conexão é recusada, o Caddy tenta a outra
réplica e deu 0 erro. Os 2 workers dão mais vazão sem pausa (155 contra
119 req/s), ao custo desses erros a cada parada.

### Derrubar uma réplica e atualizar durante a carga

100 usuários, pausa de 3 s, 120 s, com os 100 streams das mensagens abertos
(`--streams 100 --reconectar`, que reconecta como o front) e 10 deles
mandando mensagens (`--mensageiros 0.1`), 2 réplicas × 1 worker:

| Cenário | Leituras | Envio de mensagens | Streams |
|---|---|---|---|
| `docker compose stop api_1` aos 20 s e `start` 50 s depois | 3.512 req, **0 erro**, p95 93 ms | 383 req, 0 erro, p95 77 ms | os 49 da `api_1` caíram e voltaram na `api_2` em 1,3 s (mediana; máximo 1,4 s) |
| `./atualizar.sh --sem-pull --recriar` aos 20 s (levou 70 s) | 3.582 req, **0 erro**, p95 86 ms | 374 req, 0 erro, p95 77 ms | 150 quedas (os 50 da `api_1` e, depois, os 100 da `api_2`), todas de volta em 1,4 s (mediana; máximo 1,7 s) |

Cada réplica leva uns 27 s no `atualizar.sh`: até 20 s esperando os streams
abertos fecharem (o `TIMEOUT_GRACEFUL_SHUTDOWN`) e uns 5 s para subir. Se o
`Caddyfile` muda, o restart do `caddy` deixa a API fora por cerca de 0,6 s
(medido com um `curl` a cada 0,1 s).

### Antes, com uma réplica só

Antes do balanceamento, a API era um serviço só, e o padrão era **2 workers
com pool 4 + 2**, o que deu o menor p95 sem erro, e o mais estável, nas duas
VMs. Medido com
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

Compressão: o Caddy comprime as respostas (`encode zstd gzip`). Se a API
também tiver o `GZipMiddleware`, os dois convivem: o Caddy vê que a resposta
já veio com `Content-Encoding` e não comprime de novo.

O stream das mensagens (Server-Sent Events, `/mensagens/stream`) tem uma rota
própria no `Caddyfile`: sem `encode` (a compressão seguraria os eventos em
buffer) e com `flush_interval -1` (cada evento sai na hora), balanceada entre as
réplicas como o resto. O Caddy também ficou sem o `write` nos `timeouts`: ele
limita a resposta inteira e derrubava o stream aos 60 s. A API manda um
comentário a cada 20 s, então o `idle 2m` não o fecha. Medido no compose local,
pelo Caddy: o evento chega ao stream 20 a 27 ms depois do `POST` da mensagem, e
o stream segue aberto depois de 150 s.

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
  regra de ociosidade, e o que é Always Free continua grátis (passo 3, "Out of
  capacity": crie o Budget antes).
- Sem upgrade, confira o e-mail da Oracle e o painel da instância de tempos em
  tempos, e religue se ela parar.

**Se a VM sumir** (recolhida e apagada, conta encerrada, disco perdido), os
dados voltam do Object Storage numa VM nova:

1. Refaça os passos 3 a 7 (o IP muda: atualize o registro **A** de
   `api.verso.net.br` no Registro.br para o IP novo; o `DOMINIO` continua o mesmo, e o `NEXT_PUBLIC_API_URL` na Vercel, com Redeploy). Use o mesmo
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
   docker compose up -d                      # api_1, api_2, caddy e backup
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
   WEB_CONCURRENCY=1
   DB_POOL_SIZE=4
   DB_MAX_OVERFLOW=1
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
réplicas × WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW + 1)  ≤  Pool Size − 3 (folga para o seed e o SQL Editor)
2 réplicas × 1 worker × (4 + 1 + 1) = 12   (o + 1 é o LISTEN das mensagens; não medido com o Supabase)
```

Por isso o `DB_MAX_OVERFLOW=1` do item 2. A medição do PR #130 (1 serviço com 2 workers × (4 + 2) = 12: 130 req/s, 0 erro,
p95 de 1,2 s sem pausa) é de antes das réplicas.

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
project**, e depois `docker compose restart api_1 api_2`.

## Testar tudo localmente antes

Com Docker na sua máquina, dá para subir a mesma pilha (`db`, `seed`, `api_1`,
`api_2`, `caddy` e `backup`), com o Caddy em portas altas e certificado interno e um
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

O balanceamento, com a pilha de pé: uma carga de 120 s com os streams das
mensagens abertos e, noutro terminal, uma réplica derrubada e depois o
`atualizar.sh` (os números de [Workers e pool](#derrubar-uma-réplica-e-atualizar-durante-a-carga)):

```bash
cd backend && uv run python scripts/carga.py --url https://localhost:8443 --pausa 3 \
  --duracao 120 --streams 100 --mensageiros 0.1 --reconectar
# noutro terminal, em deploy/oracle, uns 30 s depois de a carga começar:
docker compose stop api_1; sleep 30; docker compose start api_1
./atualizar.sh --sem-pull --recriar        # numa segunda rodada da carga
docker compose logs --since 5m caddy | grep -o '"upstream":"[^"]*"' | sort | uniq -c
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
| `seed`, `api_1` ou `api_2`: `password authentication failed for user "verso"` | a `POSTGRES_PASSWORD` mudou depois do primeiro `up` (o Postgres guarda a do volume). Volte a antiga, ou troque no banco: `docker compose exec db psql -U verso -c "alter user verso password '<nova>'"` |
| `db` reinicia sem parar | `docker compose logs db`; com o disco cheio, ver [Disco e memória da VM](#disco-e-memória-da-vm) |
| `too many clients already` | workers × pool passou do `max_connections`: [Workers e pool](#workers-e-pool) |
| `backup`: `ERRO: o envio para o Object Storage falhou` | endpoint, região ou chave erradas (passo 11), ou o bucket não existe. O dump local está no volume |
| `backup`: `SignatureDoesNotMatch` / `InvalidAccessKeyId` | `OCI_ACCESS_KEY` e `OCI_SECRET_KEY` trocados, ou a região do endpoint diferente de `OCI_REGIAO` |
| `api_1` e `api_2` não sobem e o `caddy` fica em `Created` | o `seed` falhou: `docker compose logs seed` |
| Uma réplica `unhealthy` ou `Exited` | o Caddy já a tirou da roda e a outra atende (veja [Balanceamento](#balanceamento-entre-as-réplicas)). `docker compose logs --tail 100 api_1` mostra o porquê; `docker compose up -d api_1` a sobe de novo |
| `blocked by CORS policy` no console do navegador | `CORS_ORIGINS` sem o domínio **exato** da Vercel (`https://`, sem barra). Edite o `.env` e `docker compose up -d` |
| O front chama `localhost:8000` | `NEXT_PUBLIC_API_URL` não estava no build da Vercel: defina e faça Redeploy |
| `curl https://<DOMINIO>` dá timeout | porta fechada: confira as **duas** barreiras do passo 4 (Security List e `iptables`) |
| Caddy: `challenge failed` / `timeout during connect` | o Let's Encrypt não alcança a porta 80 da VM (passo 4) ou o domínio não aponta para o IP (`nslookup`) |
| Caddy: `too many certificates` / `rateLimited` | limite do Let's Encrypt (comum em sslip.io, que é compartilhado; com `api.verso.net.br` é raro). O Caddy tenta o ZeroSSL sozinho. Não apague o volume `caddy_data` à toa: ele guarda o certificado |
| Navegador avisa "certificado inválido" | o Caddy ainda está pedindo o certificado (veja `docker compose logs caddy`) ou o `DOMINIO` do `.env` não é o mesmo da URL |
| `Out of capacity` ao criar a VM | passo 3, lista de soluções |
| `permission denied ... docker.sock` | faltou sair e entrar de novo depois do `usermod -aG docker ubuntu` |
| Disco cheio | [Disco e memória da VM](#disco-e-memória-da-vm) |
| Com o Supabase: `Network is unreachable`, `prepared statement ... already exists`, 500 com `/saude` 200 | Direct connection (IPv6), Transaction pooler (6543) ou projeto pausado: ver [Alternativa](#alternativa-banco-gerenciado-no-supabase) e o `docs/deploy.md` |
