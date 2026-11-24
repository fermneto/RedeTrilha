# Deploy do Verso (Supabase + Render + Vercel)

Três peças, todas no plano free:

| Peça | Onde | O quê |
|---|---|---|
| Banco | Supabase | Postgres. Os dados **persistem** entre os reinícios do backend |
| Backend | Render (`virginia`) | FastAPI, criado pelo `render.yaml` da raiz |
| Front | Vercel | Next.js, com root directory `frontend` |

A ordem é: Supabase, Render, Vercel, e por fim voltar ao Render para pôr a URL
da Vercel no CORS. O repo já vem pronto: `render.yaml`, `GET /saude` para o
health check, o driver do Postgres (psycopg 3) e as variáveis lidas do
ambiente.

> **NUNCA defina `DEBUG` no Render**, nem como `false`. Com `DEBUG=true`, o
> header `X-User-Id` entra como qualquer usuário, sem senha. Sem `DEBUG`, ele é
> ignorado (`tests/test_deploy.py` garante isso).

## Variáveis de ambiente

| Onde | Variável | Valor |
|---|---|---|
| Render | `DATABASE_URL` | a connection string do **Session pooler** do Supabase (passo 1) |
| Render | `SEED_ON_BOOT` | `true` (já vem do `render.yaml`). Popula o banco só se ele estiver **sem usuários** |
| Render | `CORS_ORIGINS` | `https://<projeto>.vercel.app`, sem barra no fim. Mais de uma: separe por vírgula |
| Render | `ANTHROPIC_API_KEY` | a chave **só da demo**, com limite de gasto baixo (passo 2). Sem ela, só a tradução fica fora (503) |
| Render | `DEBUG` | **não existe. Nunca crie.** |
| Vercel | `NEXT_PUBLIC_API_URL` | `https://verso-api-xxxx.onrender.com`, sem barra no fim |

## Passo 1: banco no Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard): **New project**.

   ```text
   Organization:       (a sua)
   Project name:       verso
   Database Password:  (Generate a password → copie e guarde)
   Region:             East US (North Virginia)
   Pricing plan:       Free
   ```

   Use a região East US: ela fica ao lado do Render (`virginia`), e cada
   request da API faz várias consultas ao banco. South America (São Paulo)
   também funciona, mas cada consulta atravessa o continente.
2. Espere o projeto subir (uns 2 minutos). No topo da página do projeto,
   clique em **Connect**.
3. Na aba **Connection String**, escolha:

   ```text
   Type:     URI
   Method:   Session pooler        ← este
   ```

   A string tem esta cara (porta **5432**):

   ```text
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

   - **Não use o "Transaction pooler"** (porta 6543): ele não mantém a sessão
     entre as consultas e quebra os prepared statements do psycopg.
   - **Não use a "Direct connection"**: ela é só IPv6, e o Render não alcança.
4. Troque `[YOUR-PASSWORD]` pela senha do passo 1, sem os colchetes. Se a senha
   tiver `@`, `:`, `/`, `#` ou `%`, gere outra só com letras e números (ou
   codifique esses caracteres na URL).
5. Guarde a string: ela é o `DATABASE_URL` do passo 3. Ela é um segredo, então
   não a cole no repo nem em issues.

O backend aceita `postgresql://` e `postgres://` e troca sozinho para o driver
psycopg 3. As tabelas são criadas no primeiro boot do Render
(`create_all`), e não há nada a fazer no SQL Editor.

Se a tabela `users` já existir no Postgres (criada antes do limite de 500
caracteres da `avatar_url`), rode uma vez no SQL Editor:
`ALTER TABLE users ALTER COLUMN avatar_url TYPE varchar(500);`

## Passo 2: chave da Anthropic só para a demo

A tradução fica ligada na URL pública, limitada a 30 traduções por hora por
usuário. Mesmo assim, a URL é aberta a qualquer um, então use uma chave isolada:

1. Em [console.anthropic.com](https://console.anthropic.com), crie um workspace
   só para a demo (por exemplo, `verso-demo`) e defina nele um **limite de gasto
   baixo**, por exemplo **US$ 5** por mês.
2. Dentro desse workspace: **API Keys** → **Create Key** → nome `verso-render`.
   Copie a chave (`sk-ant-...`), que só aparece uma vez.
3. Depois da entrega, apague essa chave.

## Passo 3: backend no Render (Blueprint)

1. Em [dashboard.render.com](https://dashboard.render.com): **New** → **Blueprint**.
2. Conecte o GitHub e escolha o repo `fermneto/RedeTrilha`, branch `main`.
3. O Render lê o `render.yaml` e mostra:

   ```text
   Blueprint Name:   verso
   Branch:           main
   Services:         verso-api  (Web Service, Python, Free, Virginia)
   ```

4. Ele pede os valores das variáveis com `sync: false`:

   ```text
   DATABASE_URL:       postgresql://postgres.abcd...:SENHA@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   CORS_ORIGINS:       http://localhost:3000
   ANTHROPIC_API_KEY:  sk-ant-...            (a chave da demo, do passo 2)
   ```

   Ainda não há URL da Vercel: ponha `http://localhost:3000` em `CORS_ORIGINS`
   por enquanto (o passo 5 troca).

   A `ANTHROPIC_API_KEY` fica só no painel do Render, nunca num arquivo.

   O Render só pede esses valores **na criação do Blueprint**. Para mudar um
   deles depois, use **Environment** no painel do serviço.
5. **Apply**. O build (`pip install uv && uv sync --frozen`) leva alguns
   minutos. No primeiro boot, com o banco vazio, o log mostra duas linhas do
   seed e depois o startup (os números crescem conforme entram consagrados:
   são dezenas de poetas, centenas de poemas e uma centena de usuários):

   ```text
   consagrados: <N> poetas criados, 0 atualizados; <N> poemas criados, 0 atualizados
   seed ok: <N> usuarios, <N> poemas, <N> follows, <N> curtidas, <N> comentarios, <N> antologias
   Application startup complete.
   ```

   Se o `seed ok` não aparecer no primeiro boot, o banco do Supabase já tinha
   usuários (por exemplo, de um teste anterior).

   Nos boots seguintes o banco já tem usuários, então o seed não roda e só
   aparece o `Application startup complete.`
6. Anote a URL do serviço (`https://verso-api-xxxx.onrender.com`) e confira:

   ```bash
   curl -s https://verso-api-xxxx.onrender.com/saude
   # {"ok":true}
   ```

O Python vem do `backend/.python-version` (3.12): o `uv sync` o usa, e baixa
o 3.12 se o Render tiver outro. Se o build reclamar da versão, adicione
`PYTHON_VERSION` = `3.12.14` em Environment.

## Passo 4: front na Vercel

1. Em [vercel.com/new](https://vercel.com/new): **Import** o repo `fermneto/RedeTrilha`.
2. Configure:

   ```text
   Project Name:       verso
   Framework Preset:   Next.js        (detectado sozinho)
   Root Directory:     frontend       (Edit → frontend)
   Build Command:      (padrão: next build)
   Output Directory:   (padrão)
   Environment Variables:
     NEXT_PUBLIC_API_URL = https://verso-api-xxxx.onrender.com
   ```

3. **Deploy**. A URL de produção fica `https://verso.vercel.app`. Se esse
   domínio estiver ocupado, a Vercel sugere outro (por exemplo,
   `verso-xxxx.vercel.app`). Anote o domínio que ela der e use-o no passo 5.

   Domínio de produção: `https://______________.vercel.app`

O `NEXT_PUBLIC_API_URL` é embutido no JavaScript **no build**. Se a URL do
Render mudar, altere a variável e faça **Redeploy** na Vercel; só salvar não
basta. O `next.config.ts` não precisa de ajuste, porque o front só chama a API
pelo navegador (`lib/api.ts`).

## Passo 5: CORS com a URL da Vercel

1. No Render: serviço `verso-api` → **Environment** → `CORS_ORIGINS` → **Edit**:

   ```text
   CORS_ORIGINS = https://verso.vercel.app
   ```

   Use o domínio exato do passo 4, sem barra no fim (o código tira a barra, mas
   não custa). Para o dev local também falar com a produção, use
   `https://verso.vercel.app,http://localhost:3000`.
2. **Save, rebuild, and deploy** (ou *Save and deploy*). O serviço reinicia, e
   os dados continuam no Supabase.

Os previews da Vercel (`verso-git-<branch>-....vercel.app`) têm outra URL e
ficam fora do CORS. A banca usa só a URL de produção.

## Limites do free tier

- **Render hiberna:** sem tráfego por uns 15 minutos, o serviço dorme, e a
  primeira request depois disso leva **cerca de 1 minuto**. Abra a URL uns
  minutos antes da banca e da gravação do vídeo. Os dados não se perdem, porque
  estão no Supabase.
- **Supabase pausa após 1 semana sem uso:** um projeto free sem atividade por
  7 dias é pausado, e a API passa a dar erro 500 no login e no feed (o
  `/saude` continua 200, porque não consulta o banco). Para reativar: no
  dashboard do Supabase, abra o projeto e clique em **Restore project**
  (leva alguns minutos). Depois, reinicie o serviço no Render (**Manual
  Deploy** → **Restart service**). Faça a conferência dois dias antes da banca
  para ter folga.
- **O seed roda uma vez só.** Com `SEED_ON_BOOT=true`, ele só popula um banco
  sem usuários. Contas e poemas criados na URL pública ficam entre deploys e
  reinícios. Por isso, um poema de teste publicado na véspera continua lá na
  banca: apague o que não quiser mostrar.
- **Consagrados novos não entram sozinhos.** Como o seed não roda de novo, um
  JSON novo em `backend/data/consagrados/` não chega à produção pelo deploy.
  Rode o importador apontando para o Supabase e reinicie o Render, para o
  índice de tags ser reconstruído:

  ```bash
  cd backend && DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' \
    uv run python scripts/importar_consagrados.py
  ```

- **Push na `main` = redeploy** do Render e da Vercel (os dados ficam).

## Checklist de verificação (o que a banca faz)

Na URL da Vercel, numa janela anônima:

- [ ] `https://verso-api-xxxx.onrender.com/saude` responde `{"ok":true}` (acorda o backend)
- [ ] **Login com a demo:** `marina_letras` / `verso123`; o feed já vem cheio (prova que o seed rodou no Supabase)
- [ ] **Cadastro:** criar uma conta nova (`/cadastro`)
- [ ] **Login:** sair e entrar com ela (`/login`)
- [ ] **Post:** publicar um poema com quebras de linha e uma `#tag` (`/escrever`); as quebras aparecem iguais
- [ ] **Follow:** seguir um consagrado (por exemplo `/u/augusto_dos_anjos`) e outro usuário
- [ ] **Feed:** a home mostra os poemas de quem você segue
- [ ] **Tradução:** traduzir um poema funciona (a chave da demo está certa)
- [ ] **Persistência:** no Render, **Manual Deploy** → **Restart service**; depois do boot, a conta nova e o poema continuam lá
- [ ] DevTools → Console sem `blocked by CORS policy`
- [ ] Rota protegida sem token dá 401, mesmo com `X-User-Id`:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -H "X-User-Id: 1" https://verso-api-xxxx.onrender.com/feed
  # 401
  ```

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `blocked by CORS policy` | `CORS_ORIGINS` sem a URL exata da Vercel (`https`, sem barra), ou o backend ainda acordando ([guia 04](guias/04-erros-classicos.md#2-cors)) |
| Front chama `localhost:8000` | `NEXT_PUBLIC_API_URL` não estava definida no build: defina e faça Redeploy |
| Boot falha com `password authentication failed` | senha errada no `DATABASE_URL`, ou o `[YOUR-PASSWORD]` ficou com os colchetes |
| Boot falha com `Network is unreachable` | você colou a "Direct connection" (IPv6): use o Session pooler |
| `prepared statement ... already exists` | você colou o Transaction pooler (porta 6543): use o Session pooler (5432) |
| 500 no login e no feed, mas `/saude` 200 | o projeto do Supabase foi pausado: **Restore project** |
| Health check falhando no primeiro deploy | o seed ainda está rodando no banco vazio; veja o log |
