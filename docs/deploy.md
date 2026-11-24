# Deploy do Verso (Supabase + Render + Vercel)

> **O caminho principal agora é a Oracle Cloud Always Free:
> [`docs/deploy-oracle.md`](deploy-oracle.md).** A VM não hiberna e roda a API
> com vários workers atrás do Caddy (HTTPS automático). Este guia, com o
> Render, fica como **alternativa simples**: menos passos, mas o serviço dorme
> depois de 15 minutos sem tráfego. Os passos do Supabase (1), da chave da
> Anthropic (2) e da Vercel (4) valem para os dois caminhos.

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
| Render | `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE` | opcionais; os padrões (5, 5, 10 s, 300 s) servem para 1 worker. Ver "Desempenho" |
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

## Desempenho: pool, fila, índices, cache e gzip

Meta: 100 usuários simultâneos, p95 abaixo de 1 s e nenhum erro.

### Pool de conexões

Cada processo (worker) do uvicorn tem o seu pool do SQLAlchemy (`app/db.py`),
configurado pelo ambiente:

| Variável | Padrão | O quê |
|---|---|---|
| `DB_POOL_SIZE` | 5 | conexões que o worker mantém abertas |
| `DB_MAX_OVERFLOW` | 5 | conexões extras nos picos, fechadas depois |
| `DB_POOL_TIMEOUT` | 10 | segundos esperando conexão livre antes do erro |
| `DB_POOL_RECYCLE` | 300 | segundos até trocar a conexão por uma nova (o pooler derruba as velhas) |

O teto de um worker é `DB_POOL_SIZE + DB_MAX_OVERFLOW` (10 no padrão). O
Session pooler do Supabase (porta 5432) dá **uma conexão do Postgres para cada
conexão de cliente**, e o pool dele no plano free é de 15 conexões (confira em
**Database → Settings → Connection pooling → Pool Size**). A conta é:

```text
workers × (DB_POOL_SIZE + DB_MAX_OVERFLOW) + folga ≤ Pool Size do Supabase
1 worker  × (5 + 5) = 10   + 5 de folga (SQL Editor, importador, seed) = 15   ← padrão do código, Render free
2 workers × (4 + 2) = 12   + 3 de folga = 15                                   ← recomendado: WEB_CONCURRENCY=2 DB_POOL_SIZE=4 DB_MAX_OVERFLOW=2
3 workers × (3 + 1) = 12   + 3 de folga = 15                                   ← DB_POOL_SIZE=3 DB_MAX_OVERFLOW=1
```

Recomendado (decisão do Neto): **2 workers com pool 4 + 2**, que já é o padrão
do `deploy/oracle/.env.example`. Medido com 100 usuários simultâneos sem pausa
entre cliques: 130 req/s, 0 erro e p95 de 1,2 s, contra 78 req/s e p95 de 1,6 s
com 1 worker. Vários workers veem os mesmos dados: o índice de tags e o limite
de tradução moram no banco (ver `docs/deploy-oracle.md`, "Workers e pool").

Passou do limite, o pooler recusa a conexão nova e a API dá 500. Com mais
workers (`--workers N` no `startCommand`, ou `WEB_CONCURRENCY`), baixe o pool
na mesma conta. O Render free tem 0,1 CPU: lá, mais de 1 worker não ajuda.

### Fila do banco

As rotas são síncronas e rodam no threadpool (40 threads), e a sessão segura a
conexão do começo ao fim da requisição. Com mais requisições em voo do que
conexões, as threads ficavam presas esperando conexão, as conexões com
requisições que esperavam thread, e tudo parava até o `pool_timeout` (500). Com
100 usuários simultâneos no Postgres, sem a fila, quase toda requisição dava
`QueuePool limit ... reached`. O `app/limite_do_banco.py` deixa no máximo
`DB_POOL_SIZE + DB_MAX_OVERFLOW` requisições em voo por worker; as outras
esperam no event loop, na ordem de chegada. O `/saude` fica fora da fila.

### Índices

Declarados nos models. O `create_all` só os cria junto com uma tabela nova, então
o `preparar_banco()` (`app/main.py`, chamado no boot e pelo serviço `seed` da
Oracle) cria também, dentro do mesmo lock, os índices dos models que faltam em
tabelas que já existiam (`criar_indices_que_faltam`). O deploy não tem passo
manual: o banco antigo ganha os índices no próximo boot.

Alternativa manual, se preferir criar antes do deploy, no SQL Editor (ou com
`psql "$DATABASE_URL"`):

```sql
CREATE INDEX IF NOT EXISTS ix_posts_autorais ON posts (autor_id, created_at, id)
  INCLUDE (idioma, forma) WHERE NOT (repost_de_id IS NOT NULL AND texto = '');
CREATE INDEX IF NOT EXISTS ix_posts_originais ON posts (id)
  INCLUDE (autor_id) WHERE repost_de_id IS NULL;
CREATE INDEX IF NOT EXISTS ix_comentarios_do_poema
  ON comentarios (post_id, parent_id, created_at, id);
VACUUM ANALYZE posts;
VACUUM ANALYZE comentarios;
```

O `VACUUM` atualiza o mapa de visibilidade, sem o qual o Postgres não faz
Index Only Scan. O boot não roda `VACUUM`; sem ele, o autovacuum do Supabase faz
isso sozinho depois de algum tempo. Para conferir: `\di ix_*` no psql, ou
`SELECT indexname FROM pg_indexes WHERE tablename IN ('posts', 'comentarios');`.

- `ix_posts_autorais`: os poemas autorais (tudo menos o repost puro), com as
  colunas que as agregações leem. Servem a ele a contagem de poemas por autor
  (perfil, Acervo, sugestões), a língua de cada autor, o total do Explorar e os
  consagrados do "Para você". O predicado tem de ser **exatamente** o que o
  SQLAlchemy escreve para `~Post.repost_puro`, senão o Postgres não usa o
  índice parcial.
- `ix_posts_originais`: o poema do dia conta e percorre por id só os originais.
- `ix_comentarios_do_poema`: a página de comentários de um poema sai do índice
  já ordenada. Com os 52 comentários do seed, o Postgres ainda prefere ler a
  tabela; o índice passa a valer quando ela crescer.

### Cache HTTP

`Cache-Control` só nas rotas iguais para todo mundo (`app/cache_http.py`):

| Rota | Header |
|---|---|
| `GET /tags/trending` (Em alta) | `private, max-age=60` |
| `GET /tags/busca` | `private, max-age=60` |
| `GET /acervo/filtros` | `private, max-age=300` |
| `GET /preferencias/opcoes` | `private, max-age=3600` |
| `GET /usuarios` (sem login) | `public, max-age=60` |

`private` porque essas rotas exigem login: um cache compartilhado entregaria a
resposta sem conferir o token. Ficam **sem cache** as rotas com dado de quem
pede: feed, "Para você", perfil (`sigo`), poema (`curti`, `repostei`), poema do
dia (`curti`), Explorar, Acervo (`sigo`), sugestões, rengas (`posso_escrever`),
comentários e antologias. O poema do dia fica sem cache (decisão do Neto): o
poema é o mesmo o dia todo, mas a resposta traz `curti` e `repostei`.

No front, o `request` do `lib/api.ts` usa o cache do navegador (`cache:
"default"`) só nessas cinco rotas (`modoDeCache`); o resto continua `no-store`.
Rota nova com `cache(...)` no backend entra também no `ROTAS_COM_CACHE` do front.

### Gzip

`GZipMiddleware` com `minimum_size=1000` no `main.py`: respostas de 1 KB ou
mais saem comprimidas quando o cliente manda `Accept-Encoding: gzip` (o
navegador sempre manda). Feeds e poemas são texto: uma página do feed cai de
37 KB para 8,5 KB (23%).

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
  Rode o importador apontando para o Supabase (as tags entram no índice na
  mesma transação; não precisa reiniciar o Render):

  ```bash
  cd backend && DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' \
    uv run python scripts/importar_consagrados.py
  ```

- **Push na `main` = redeploy** do Render e da Vercel (os dados ficam).
- **Banco criado antes do índice de tags no banco.** Não tem passo manual: o
  preparo do banco (`preparar_banco()` em `main.py`, no boot e no serviço
  `seed` da Oracle) cria a tabela `post_tags`, cria o índice
  `ix_traducoes_pedida_por_id_created_at` se faltar e, com `post_tags` vazia,
  popula o índice de tags a partir dos posts, tudo sob o mesmo *advisory lock*.
  Alternativa manual (idempotente, pode rodar de novo):

  ```bash
  cd backend && DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' \
    uv run python scripts/popular_post_tags.py
  ```

  ```sql
  CREATE INDEX IF NOT EXISTS ix_traducoes_pedida_por_id_created_at
    ON traducoes (pedida_por_id, created_at);
  ```

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
