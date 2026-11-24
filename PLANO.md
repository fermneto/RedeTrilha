# Plano de produção: Verso, a rede social de poemas

> Plano escrito na segunda, 23/11, para a entrega de sexta, 27/11. O "Status
> final" diz o que foi entregue, e os "Contratos" estão atualizados para o
> código da `main`. As tasks, o grafo e o cronograma ficam como foram
> planejados, com cada task marcada.

## Status final

Entregue na `main` (issue → PR):

| Task | Entrega | Issue | PR |
|---|---|---|---|---|
| P0, P1 | Bypass `X-User-Id` (só com `DEBUG`) e auth real | #2, #3 | #33 |
| P2 | Layout, navegação, tema e `api.ts` com token | #4 | #30, #43 |
| P3 | Telas de login e cadastro | #5 | #44 |
| P4 | Perfil do poeta e selo de consagrado | #6 | #40, #42, #46, #48 |
| P5 | Antologias (backend e telas) | #7 | #36, #53, #56 |
| H1 | Model `Post` e CRUD de `/posts` | #8 | #24 |
| H2, H3 | Feed cronológico com reposts, e curtidas | #9, #10 | #31 |
| H4 | Comentários em árvore | #11 | #38, #41 |
| H5 | Repost e citação | #12 | #37 |
| H6 | PoemaCard, compositor, feed e página do poema | #13 | #39 |
| N0 | Interface do índice de tags | #14 | #21 |
| N1 | Follow com contadores | #15 | #22 |
| N2 | Consagrados: leitura, importador e dados | #16 | #27, #29, #34, #45, #49 |
| N3 | Formas/temas: índice, rotas e tela do Explorar | #17 | #23, #25, #35, #54 |
| N4 | Seed com a cara do nicho | #18 | #47 |
| N6 | `DECISIONS.md` final | #20 | #26, #28, #63 |

Além do plano: tradução por IA (#51), preparação do deploy no Render, na
Vercel e no Supabase (#50, #55), limpeza para o critério de código e
`make bench` (#64), o Acervo de poetas com filtros no lugar da tela Poetas
(#65) e as correções do teste de ponta a ponta (#66).

**Ficou com o Neto:**

- **Deploy público (N5, issue #19, aberta).** O repositório está pronto
  (`render.yaml`, `GET /saude`, Postgres no Supabase); falta criar os serviços
  e ligar as URLs, seguindo o [`docs/deploy.md`](docs/deploy.md).
- **O vídeo** da entrega.

As validações do Henrique e do Pedro ficam nas issues #57 a #62.

## Produto (rascunho para o `DECISIONS.md`)

- **Público:** poetas iniciantes universitários (UFPB e outras) que escrevem e
  não têm onde publicar.
- **Problema:** no X o limite de caracteres quebra o poema; no Instagram o poema
  vira imagem e não dá para citar um verso; os feeds algorítmicos enterram texto
  longo. Além disso, o iniciante lê pouco os clássicos.
- **Como a rede resolve:** um poema é um post de verdade (título, corpo sem
  limite com as quebras de linha preservadas, forma), com conversa em árvore,
  repost/citação de versos e os **consagrados** (Augusto dos Anjos, Bilac,
  Pessoa...) convivendo no mesmo feed.
- **Sinal de sucesso:** o iniciante cita um verso de um consagrado ou de um
  colega e recebe respostas na árvore de comentários.

## Divisão

| Pessoa | Área (revisa PRs dela) | Núcleo | Features | Subagent |
|---|---|---|---|---|
| **Neto** (@fermneto) | Dados | Follow, Seed fake | Consagrados (importador), Formas/temas (hashtags + trending + Explorar), Deploy | `neto-dados` |
| **Henrique** (@hguimaa) | Backend | Posts, Feed, Curtidas, Comentários | Comentários em árvore, Repost + citação | `henrique-backend` |
| **Pedro** (@CorreiaPedro208) | Frontend | Auth, Perfil | Antologias (coleções), layout e identidade visual | `pedro-frontend` |

Cada dono faz a feature **de ponta a ponta** (backend + tela), como no guia 07.

---

## Contratos compartilhados (estado da `main`)

Combinados no dia 1 e atualizados a cada PR que os mudou. Esta seção
descreve o código atual; o OpenAPI completo está em `localhost:8000/docs`.
🔒 = exige `Authorization: Bearer <token>` (com `DEBUG=true`, o header
`X-User-Id` também serve, só em desenvolvimento).

### Convenções

- Listagens por offset devolvem `Pagina`: `{"items", "total", "offset", "limit"}`
  (`schemas/pagina.py`); `limit` vai de 1 a 100.
- Erros em português no `detail`, inclusive os 422 de validação.
- Datas em ISO 8601 UTC.

### `User` (dono: Pedro)

`backend/app/models/user.py`, tabela `users`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | int | |
| `username` | `str` (30), único | `[a-z0-9_]{3,30}`, fora de `USERNAMES_RESERVADOS` (`schemas/user.py`) |
| `name` | `str` (80) | obrigatório |
| `bio` | `str` (1000) | consagrados têm bio maior |
| `avatar_url` | `str` (300) | vazia ou URL http(s) |
| `password_hash` | `str \| None` | `None` = conta consagrada, **sem login** (login → 401) |
| `consagrado` | `bool`, default `False` | selo no perfil e no card |
| `nascimento` | `int \| None` | ano (negativo = a.C.); só consagrados, opcional |
| `morte` | `int \| None` | ano; só consagrados |
| `created_at` | datetime UTC | |

O `User` não tem `idioma`: a língua de um poeta do Acervo é a mais frequente
nos poemas dele.

- `UserOut`: `id`, `username`, `name`, `bio`, `avatar_url`, `consagrado`,
  `nascimento`, `morte`, `created_at`.
- `PerfilOut` (`GET /usuarios/{username}` e `PATCH /usuarios/eu`): o `UserOut`
  mais `seguidores`, `seguindo`, `poemas` (poemas e citações; reposts puros
  não contam) e `sigo`.
- `PATCH /usuarios/eu` 🔒: `name`, `bio` e `avatar_url`, só os enviados; `null`
  explícito → 422.

### `Post` = poema (dono: Henrique)

`backend/app/models/post.py`, tabela `posts`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | int | |
| `autor_id` | FK `users.id` | |
| `titulo` | `str \| None` (200) | opcional |
| `texto` | `Text` | **sem limite**, gravado como veio; vazio só em repost puro |
| `forma` | `str \| None` | uma de `FORMAS` (abaixo) |
| `obra` | `str \| None` | livro de origem (consagrados) |
| `ano` | `int \| None` | ano de publicação original (consagrados) |
| `fonte` | `str \| None` | URL da fonte (consagrados) |
| `idioma` | `str \| None` (ISO 639-1) | padrão `"pt"` no `POST /posts`; `null` = língua desconhecida; nos consagrados, o subdomínio da `fonte`; repost puro fica `null` e usa o do original |
| `tags_extras` | JSON `list[str]` | tags que vêm dos JSONs dos consagrados; somam-se às `#hashtags` e à forma |
| `repost_de_id` | FK `posts.id` \| None | `texto` vazio = repost puro; com texto = citação |
| `repost_removido` | `bool` | citação cujo original foi apagado (`repost_de_id` vira `null`) |
| `created_at` / `updated_at` | datetime UTC | |

Um repost puro por (autor, original), garantido por um índice único parcial
(`uq_repost_puro`).

`FORMAS = ["soneto", "haicai", "trova", "quadra", "cordel", "verso_livre", "prosa_poetica", "outro"]`
fica em `backend/app/schemas/post.py` e é espelhada em `frontend/lib/api.ts`.

- `PostCreate`: `titulo`, `texto` (não pode ficar em branco), `forma`, `idioma`
  e `repost_de_id` (com texto, é citação). `PostUpdate`: os mesmos campos menos
  `repost_de_id`, só os enviados mudam. Só o autor edita ou apaga (403).
- `PostOut`: os campos da tabela (menos `tags_extras`) + `autor: UserOut`,
  `curtidas`, `comentarios`, `reposts`, `curti`, `repostei`,
  `repost_de: PostOut | None` (um nível), `repost_removido`, `tags: list[str]`
  (`#hashtags` + forma + `tags_extras`, normalizadas) e
  `repostado_por: list[UserOut]` (só no feed; vazio fora dele).
- **Apagar um poema com reposts:** os reposts puros são apagados junto; as
  citações continuam, com `repost_de: null` e `repost_removido: true`, e a tela
  mostra "poema removido pelo autor", como no X.
- Repostar um repost aponta para o original. Curtir, comentar, adicionar a uma
  antologia ou traduzir um repost puro age no original.

### Feed e posts do perfil (`FeedPage`)

`GET /feed` 🔒 e `GET /usuarios/{username}/posts` 🔒 devolvem `FeedPage`
(`schemas/feed.py`), que herda da `PostPage` e acrescenta
`proximo_cursor: str | None`.

- Reposts como no X: cada poema aparece uma vez, na ocorrência mais recente.
  `repostado_por` lista todos os seguidos (e o próprio usuário) que repostaram,
  do mais recente para o mais antigo. Citações não deduplicam com o original.
- Paginação como na timeline do X: `limit` de 1 a 100 (padrão 20) e um
  `cursor` opaco. Com `cursor`, ele tem precedência sobre o `offset` e o
  `total` vem `null`; sem cursor, `offset` e `total` valem (teste do núcleo).
  `proximo_cursor` é `null` no fim.
- O feed inclui os próprios poemas. Pode curtir o próprio poema.

### `Follow` (dono: Neto)

Tabela `follows`: `seguidor_id` (FK users), `seguido_id` (FK users),
`created_at`, com unique (`seguidor_id`, `seguido_id`).
`POST`/`DELETE /usuarios/{username}/follow` 🔒 → 204, idempotentes;
`GET /usuarios/{username}/seguidores` e `/seguindo` 🔒 → página de `UserOut`.

### `Comentario` (dono: Henrique)

`backend/app/models/comentario.py`, tabela `comentarios`: `id`, `post_id`,
`autor_id`, `texto` (`Text`), `parent_id` (FK `comentarios.id` \| None),
`removido` (`bool`) e `created_at`.

- `ComentarioOut`: `id`, `post_id`, `texto`, `autor: UserOut | None`,
  `parent_id`, `created_at`, `removido`, `total_respostas` (respostas diretas)
  e `respostas`: a prévia com as primeiras 3 (`PREVIA_RESPOSTAS`), recursiva,
  com o mesmo corte. Removido: `texto` vazio e `autor` `null`.
- `ComentarioPage`: `{"items", "total", "limit", "proximo_cursor"}`, em ordem
  cronológica e paginada por cursor.
- `POST /posts/{id}/comentarios` 🔒, body `{"texto", "parent_id"}` → 201
  `ComentarioOut`. Pai inexistente, de outro poema ou removido → 404. Num repost puro,
  vai para o original.
- `GET /posts/{id}/comentarios?limit=&cursor=` 🔒 → `ComentarioPage` das
  raízes; `GET /comentarios/{id}/respostas?limit=&cursor=` 🔒 → as respostas
  diretas de um comentário.
- `DELETE /comentarios/{id}` 🔒 (só o autor; outro → 403) → 200,
  `{"resultado": "apagado" | "removido", "total_respostas": int}`. Sem
  respostas, sai do banco (`"apagado"`); com respostas, vira o marcador
  "comentário removido" (`"removido"`), e `total_respostas` traz a contagem
  atual das respostas diretas.
- **O marcador fica para sempre** (decisão do Neto, #38 e #67): mesmo que as
  respostas sejam apagadas depois, ele não sai do banco, e apagar de novo não
  faz nada (devolve `"removido"` com o total atual).

### Crítica ancorada no verso (dono: Neto, #71)

Tabela `ancoras_comentario`: `comentario_id` (PK e FK `comentarios.id`),
`verso_inicio` e `verso_fim`. Os versos são as linhas de `texto.split("\n")`
do poema, base 1, **com as linhas em branco contadas**. O trecho não é gravado:
poema publicado não se edita, então ele sai do texto do poema.

- `ComentarioCreate` ganhou `ancora: {"verso_inicio", "verso_fim"} | null`
  (opcional). Só no 1º nível: com `parent_id` → 422. Início depois do fim, fora
  do poema ou trecho só de linhas em branco → 422. Num repost puro, vale o texto
  do original.
- `ComentarioOut` ganhou `ancora: {"verso_inicio", "verso_fim", "trecho"} | null`
  (opcional; `null` nos comentários sem âncora e nas respostas). O marcador
  "comentário removido" continua com a âncora.
- `GET /posts/{id}/comentarios?verso=N` 🔒 → só as raízes cuja âncora cobre o
  verso N, na mesma paginação por cursor.
- `GET /posts/{id}/comentarios/versos` 🔒 → `{"items": [{"verso", "comentarios"}]}`:
  quantos comentários cobrem cada verso (uma crítica de 5–8 conta nos quatro).
- Apagar o comentário (sem respostas) ou o poema apaga a âncora junto.

### Curtidas e reposts (dono: Henrique)

`POST`/`DELETE /posts/{id}/curtir` 🔒 e `POST`/`DELETE /posts/{id}/repostar` 🔒
→ 204, idempotentes.

### Antologias (dono: Pedro)

Tabelas `antologias` (`dono_id`, `nome` (100), `descricao`, `publica`,
`created_at`) e `antologia_poemas` (`antologia_id`, `post_id`, `posicao`,
`created_at`, unique no par).

- `POST /antologias` 🔒 → 201 `AntologiaOut` (`id`, `dono_id`, `dono`, `nome`,
  `descricao`, `publica`, `created_at`, `qtd`).
- `GET /antologias` 🔒 → as minhas; com `?post_id=`, cada item traz
  `contem: bool` (o poema está nela?).
- `GET /usuarios/{username}/antologias` 🔒 → as públicas da pessoa (as
  privadas só aparecem para o próprio dono).
- `GET /antologias/{id}` 🔒 → `AntologiaDetalhe` (`poemas: list[PostOut]` na
  ordem de inserção). `PATCH` e `DELETE /antologias/{id}` 🔒.
- `POST /antologias/{id}/poemas`, body `{"post_id"}`, e
  `DELETE /antologias/{id}/poemas/{post_id}` 🔒 → 204; adicionar de novo não
  duplica.
- Privada de outra pessoa → 404 (não revela que existe); escrita de quem não é
  o dono → 403.

### Tags, Explorar, Em alta e Poema do dia (dono: Neto)

- `GET /tags/{tag}/posts` 🔒 → página, mais novo primeiro. A tag é normalizada
  (casefold e sem acento: `#Solidão` = `#solidao`).
- `GET /tags/trending` 🔒 → `{"items": [{"tag", "contagem"}]}`: top 5 das
  últimas 24 h.
- `GET /explorar?tag=&forma=` 🔒 → página de poemas de todos, sem reposts
  puros; `tag` e `forma` juntos fazem interseção; forma fora de `FORMAS` → 422.
- `GET /poemas/do-dia` 🔒 → `PostOut`: um poema de consagrado, o mesmo para
  todos no mesmo dia UTC (sha256 da data módulo a quantidade, por id); sem
  consagrados → 404.

### Acervo (dono: Neto)

- `GET /acervo` 🔒, com `tipo` (`todos` \| `consagrados` \| `iniciantes`), `q`
  (nome ou @username, sem diferença de acento), `lingua` (ISO 639-1), `epoca`
  (`antiguidade`, `idade_media`, `xvi` … `xx`, pelo ano de morte), `ordem`
  (`alfabetica` \| `seguidos` \| `poemas`), `offset` e `limit` (padrão 24) →
  `AcervoPage` de `PoetaDoAcervo` (`UserOut` + `seguidores`, `poemas`, `sigo`).
- `GET /acervo/filtros` 🔒 → `{"linguas": [{"codigo", "poetas"}],
  "epocas": [{"chave", "rotulo", "inicio", "fim", "poetas"}]}`.
- A tela Poetas (`/usuarios`) virou o Acervo; o front redireciona `/usuarios`
  para `/acervo`. `GET /usuarios` (lista paginada, sem login) continua na API.

### Tradução (dono: Neto)

- `POST /posts/{id}/traduzir` 🔒, body `{"para": "<ISO 639-1>"}` →
  `TraducaoOut` (`titulo`, `texto`, `idioma_origem`, `idioma_destino`,
  `modelo`, `em_cache`).
- Cache na tabela `traducoes`, único por (`post_id`, `idioma_destino`): o mesmo
  pedido não chama a API de novo. Repost puro traduz o original.
- 30 traduções novas por usuário por hora (`core/janela_deslizante.py`); as do
  cache não contam. Passou → 429. Já está na língua → 422. Sem
  `ANTHROPIC_API_KEY` → 503.

### Auth e saúde

- `POST /auth/registro` → 201 `UserOut`; `POST /auth/login` → `{"token"}`
  (usuário inexistente, senha errada ou consagrado → o mesmo 401);
  `GET /auth/eu` 🔒; `POST /auth/logout` 🔒 → 204. Conta nova só nasce no
  registro: `POST /usuarios` e `GET /usuarios/stats` saíram (#64).
- `GET /saude` → `{"ok": true}`, sem login e sem tocar no banco (health check
  do Render).

### Gancho do índice de tags (Neto ↔ Henrique)

`backend/app/core/indice_tags.py` expõe o singleton `indice_tags`:

```python
indice_tags.indexar(post_id: int, tags: set[str], criado_em: datetime) -> None
indice_tags.remover(post_id: int) -> None
indice_tags.posts_da_tag(tag: str) -> list[int]       # mais novo primeiro
indice_tags.trending(desde: datetime, k: int = 5) -> list[tuple[str, int]]
extrair_tags(texto: str, forma: str | None) -> set[str]  # #amor, mais a forma
```

O `services/posts.py` chama `indexar` ao criar ou editar e `remover` ao
apagar; o lifespan reconstrói o índice a partir do banco.

### Componentes do front

- `components/Layout`, `Nav`, `MenuConta` e o tema (serifada para poemas):
  **Pedro**.
- `components/PoemaCard.tsx`, `Compositor.tsx` e `ArvoreComentarios.tsx`:
  **Henrique**. Os outros reusam o card, sem copiá-lo.
- `components/ColunaDireita.tsx` (Descobrir), `CartaoDoAcervo.tsx` e as
  páginas `explorar/` e `acervo/`: **Neto**.
- `lib/api.ts`: dono **Pedro**. Cada um acrescenta os próprios tipos e
  chamadas numa seção com o nome da feature.

### Consagrados: formato de importação

Veja [`docs/consagrados.md`](docs/consagrados.md) e
`backend/data/consagrados/_exemplo.json`.

---

## Tasks

Os IDs são usados nas issues e nos PRs (`[H1] posts CRUD`).

### Pedro: Frontend · Auth · Perfil · Antologias

| ID | Task | Depende de | Bloqueia | Status |
|---|---|---|---|---|
| **P0** | Bypass `X-User-Id` em `deps.py` (guia 01, Passo 0). **Primeira coisa a fazer, leva uns 15 min.** | — | todas as rotas protegidas | concluída |
| **P1** | Auth backend: campos do `User` (contrato acima), `Session`, `/auth/registro`, `/auth/login`, `/auth/eu`, `get_current_user` real; login de consagrado → 401 | P0 | **todos os testes do núcleo** | concluída |
| P2 | Layout, Nav, tema visual e `api.ts` enviando o token | — | H6, N3-front, P4, P5 | concluída |
| P3 | Telas de cadastro e login, guardando o token | P1, P2 | fluxo do vídeo | concluída |
| P4 | Perfil: `GET /usuarios/{username}` com contadores, `PATCH /usuarios/eu`, `GET /usuarios/{username}/posts`; tela com selo "Consagrado" e anos de vida | P1, H1, N1 (contadores) | N2 (tela dos consagrados) | concluída |
| P5 | **Antologias**: models `Antologia` e `AntologiaPoema`, rotas `/antologias` (estilo coleções do CONTRATO), telas "minhas antologias", detalhe e "adicionar à antologia" no card | H1, H6 | — | concluída |

### Henrique: Backend · Poemas · Feed · Conversa

| ID | Task | Depende de | Bloqueia | Status |
|---|---|---|---|---|
| **H1** | Model `Post` (contrato) e CRUD `/posts`; só o autor edita ou apaga; chamadas a `indice_tags` | P0, stub N0 | P4, P5, H2–H5, N2, N3, N4 | concluída |
| H2 | `GET /feed` cronológico paginado (seguidos + próprios, com reposts) | H1, N1 | H6 | concluída |
| H3 | Curtidas idempotentes (`/posts/{id}/curtir`) | H1 | N4 | concluída |
| H4 | **Comentários em árvore**: `core/arvore_comentarios.py` (árvore + recursão), `parent_id`, sem quebrar o teste plano | H1 | H6 | concluída |
| H5 | **Repost + citação**: `POST/DELETE /posts/{id}/repostar` (puro, idempotente); citação = `POST /posts` com `repost_de_id` e `texto` | H1 | H6, N4 | concluída |
| H6 | Front: `PoemaCard`, compositor de poema (título, corpo e forma), feed com "carregar mais", página do poema com a árvore, botões curtir/repostar/citar | P2, H2–H5 | P5, N3-front | concluída |

### Neto: Dados · Consagrados · Formas/Temas · Deploy

| ID | Task | Depende de | Bloqueia | Status |
|---|---|---|---|---|
| **N0** | Stub de `core/indice_tags.py` com as assinaturas do contrato (dia 1) | — | H1 | concluída |
| N1 | Follow: model `Follow` (`follows`), `POST/DELETE /usuarios/{username}/follow` idempotentes, listas e a função de contagem usada pelo perfil | P0 | H2, P4 | concluída |
| N2 | **Consagrados**: scraping (fora do repositório) → JSON no formato de `docs/consagrados.md` → `scripts/importar_consagrados.py` idempotente (cria o user sem senha e os poemas) | P1 (campos do User), H1 | N4, N5 | concluída |
| N3 | **Formas/temas**: índice invertido real em `core/indice_tags.py`, `GET /tags/{tag}/posts`, `GET /tags/trending`, `GET /explorar?tag=&forma=`; tela Explorar com chips de forma e tags clicáveis | H1, H6 (card) | — | concluída |
| N4 | Seed fake do nicho: mais de 20 poetas iniciantes fictícios (cursos da UFPB na bio), mais de 50 poemas originais, follows (inclusive a consagrados), curtidas, comentários em árvore, reposts e citações; `seed_fake(db)` e `make seed` também importa os consagrados | todos os models (H1, H3, H4, H5, N1, P5) | N5 | concluída |
| N5 | Deploy: Render (backend, `SEED_ON_BOOT=true`, **sem DEBUG**) + Vercel (front) + Supabase (Postgres), CORS com a URL pública | N4 | bônus +10 | pendente, com o Neto (#19) |
| N6 | Consolidar o `DECISIONS.md` (produto, decisões, escolha técnica e, opcional, `make bench` do índice invertido contra varredura) | — | entrega | concluída |

---

## Grafo de dependências

```
P0 ──► P1 ──────────────┬──► (testes do núcleo destravam)
 │                      ├──► P3
N0 ──► H1 ──┬──► H2 ◄── N1
            ├──► H3
            ├──► H4
            ├──► H5 ──► H6 ◄── P2
            ├──► P4 ◄── N1
            ├──► N2 ◄── P1
            └──► N3
H6 ──► P5, N3-front
{H1,H3,H4,H5,N1,P5} ──► N4 ──► N5
```

Caminho crítico: **P0 → P1 → H1 → H2/H5 → H6 → N4 → N5.**

## Cronograma

| Dia | Meta | Quem |
|---|---|---|
| **Seg 23 (noite)** | Merge deste plano; uma issue por task; **P0**, **N0**; PRs só com os models (User, Post e Follow) para fixar os contratos | todos |
| **Ter 24** | P1, H1, N1, H2, H3; P2 em paralelo. **Fim do dia: `make test` com os 10 testes do núcleo verdes** | todos |
| **Qua 25** | Features: H4, H5, N3, P5; telas: P3, P4, H6; N2 (importador) | todos |
| **Qui 26** | N4 (seed) → N5 (deploy); integração e polimento; roteiro do vídeo | Neto no deploy; Henrique e Pedro em bugs/UI |
| **Sex 27** | Congelamento ao meio-dia; vídeo (cerca de 4 min), pitch (3 min), `DECISIONS.md` final | todos |

## Limitações e riscos

- **Prazo curto.** Se atrasar, cortar nesta ordem: trending → Explorar com
  filtro → antologias. O núcleo, os consagrados, o repost e a árvore são o
  coração do pitch.
- **Gargalo na auth (P1).** Até ela sair, todos trabalham com o bypass
  `X-User-Id` + `DEBUG=true`.
- **Conflitos.** Os pontos quentes são `main.py`, `api.ts` e `models/user.py`.
  Só o Pedro mexe no `User`; os outros pedem campo novo no PR dele.
- **Deploy no free tier.** O plano era SQLite recriado pelo `SEED_ON_BOOT` a
  cada restart; no fim, o banco é Postgres no Supabase (#55), os dados
  persistem e o seed só roda num banco sem usuários. A primeira request depois
  da hibernação do Render leva cerca de 1 minuto.
- **Direitos autorais.** Só autores mortos até 1955; o importador recusa
  `morte > 1955`.
- **Estruturas em memória** (`indice_tags` e o limite de tradução em
  `janela_deslizante`) zeram no `--reload` e são reconstruídas no lifespan
  (`core/README.md`). A `arvore_comentarios` é montada a cada request.
