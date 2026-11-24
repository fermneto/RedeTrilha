# Deploy do Verso (Render + Vercel)

Backend no Render (free), front na Vercel (free), como no
[guia 08](guias/08-deploy.md). O repo já vem pronto: `render.yaml` na raiz,
`GET /saude` para o health check, `SEED_ON_BOOT` e `CORS_ORIGINS` lidos do
ambiente. A ordem é: Render, depois Vercel, e por fim voltar ao Render para
pôr a URL da Vercel no CORS.

> **NUNCA defina `DEBUG` no Render**, nem como `false`. Com `DEBUG=true`, o
> header `X-User-Id` entra como qualquer usuário, sem senha. Sem `DEBUG`, ele é
> ignorado (`tests/test_deploy.py` garante isso).

## Variáveis de ambiente

| Onde | Variável | Valor |
|---|---|---|
| Render | `SEED_ON_BOOT` | `true` (já vem do `render.yaml`) |
| Render | `CORS_ORIGINS` | `https://<seu-front>.vercel.app`, sem barra no fim. Mais de uma: separe por vírgula |
| Render | `ANTHROPIC_API_KEY` | opcional, só quando a tradução estiver na `main` (está comentada no `render.yaml`) |
| Render | `DEBUG` | **não existe. Nunca crie.** |
| Vercel | `NEXT_PUBLIC_API_URL` | `https://<seu-back>.onrender.com`, sem barra no fim |

## Passo 1: backend no Render (Blueprint)

1. Em [dashboard.render.com](https://dashboard.render.com): **New** → **Blueprint**.
2. Conecte o GitHub e escolha o repo `fermneto/RedeTrilha`, branch `main`.
3. O Render lê o `render.yaml` e mostra:

   ```text
   Blueprint Name:   verso            (qualquer nome)
   Branch:           main
   Services:         verso-api  (Web Service, Python, Free)
   ```

4. Ele pede os valores das variáveis com `sync: false`:

   ```text
   CORS_ORIGINS:     http://localhost:3000
   ```

   Ainda não há URL da Vercel: ponha `http://localhost:3000` por enquanto
   (o passo 3 troca). Se a `ANTHROPIC_API_KEY` já estiver descomentada no
   `render.yaml`, cole a chave aqui também.
5. **Apply**. O build (`pip install uv && uv sync --frozen`) leva alguns
   minutos. No log, o boot mostra:

   ```text
   seed ok: 3 usuários criados
   consagrados: 59 poetas criados, 0 atualizados; 483 poemas criados, 0 atualizados
   Application startup complete.
   ```

6. Anote a URL do serviço (`https://verso-api-xxxx.onrender.com`) e confira:

   ```bash
   curl -s https://verso-api-xxxx.onrender.com/saude
   # {"ok":true}
   ```

O Python vem do `backend/.python-version` (3.12): o `uv sync` o usa, e baixa
o 3.12 se o Render tiver outro. Se o build reclamar da versão, adicione
`PYTHON_VERSION` = `3.12.14` em Environment.

## Passo 2: front na Vercel

1. Em [vercel.com/new](https://vercel.com/new): **Import** o repo `fermneto/RedeTrilha`.
2. Configure:

   ```text
   Framework Preset:   Next.js        (detectado sozinho)
   Root Directory:     frontend       (Edit → frontend)
   Build Command:      (padrão: next build)
   Output Directory:   (padrão)
   Environment Variables:
     NEXT_PUBLIC_API_URL = https://verso-api-xxxx.onrender.com
   ```

3. **Deploy**. Anote a URL (`https://<projeto>.vercel.app`).

O `NEXT_PUBLIC_API_URL` é embutido no JavaScript **no build**. Mudou a URL do
Render? Altere a variável e faça **Redeploy** na Vercel; só salvar não basta.
O `next.config.ts` não precisa de ajuste: o front só chama a API pelo
navegador (`lib/api.ts`). O build com a variável apontando para o Render foi
testado localmente (`npm run build`).

## Passo 3: CORS com a URL da Vercel

1. No Render: serviço `verso-api` → **Environment** → `CORS_ORIGINS` → **Edit**:

   ```text
   CORS_ORIGINS = https://<projeto>.vercel.app
   ```

   Sem barra no fim (o código tira, mas não custa). Para manter o dev local
   apontando para produção, use `https://<projeto>.vercel.app,http://localhost:3000`.
2. **Save, rebuild, and deploy** (ou *Save and deploy*). O serviço reinicia, e
   o banco volta pelo seed.

Os previews da Vercel (`<projeto>-git-<branch>-....vercel.app`) têm outra URL
e ficam fora do CORS; a banca usa só a URL de produção.

## Limites do free tier

- **Hiberna:** sem tráfego por uns 15 minutos, o serviço dorme. A primeira
  request depois disso leva **cerca de 1 minuto**. Abra a URL uns minutos
  antes da banca e da gravação do vídeo.
- **O banco zera a cada restart, deploy ou hibernação.** O SQLite fica no
  disco efêmero. O `SEED_ON_BOOT=true` repovoa tudo
  (usuários do seed com a senha `verso123` e os consagrados) antes de o índice
  de tags ser montado. Contas e poemas criados na URL pública **somem** no
  próximo restart: não conte com eles para a demo.
- **Push na `main` = redeploy** dos dois lados (Render e Vercel), e o banco
  zera de novo.

## Checklist de verificação (o que a banca faz)

Na URL da Vercel, numa janela anônima:

- [ ] `https://verso-api-xxxx.onrender.com/saude` responde `{"ok":true}` (acorda o backend)
- [ ] **Cadastro:** criar uma conta nova (`/cadastro`)
- [ ] **Login:** sair e entrar com ela (`/login`); entrar também com `ada` / `verso123`
- [ ] **Post:** publicar um poema com quebras de linha e uma `#tag` (`/escrever`); as quebras aparecem iguais
- [ ] **Follow:** seguir um consagrado (por exemplo `/u/augusto_dos_anjos`) e outro usuário
- [ ] **Feed:** a home mostra os poemas de quem você segue
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
| Health check falhando no Render | o boot (seed + consagrados) ainda não terminou; veja o log |
| Contas sumiram | restart ou hibernação: o banco é recriado pelo seed (esperado) |
