# Plano de produção: Verso, a rede social de poemas

> O nome "Verso" é provisório; o time pode trocá-lo.
> Hoje é segunda, 23/11. **A entrega é sexta, 27/11.** O núcleo precisa ficar
> verde até terça à noite.

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

## Contratos compartilhados (combinar no dia 1, não mudar sem avisar)

### `User` (dono: Pedro, no PR de auth)

Campos novos em `backend/app/models/user.py`:

| Campo | Tipo | Observação |
|---|---|---|
| `password_hash` | `str \| None` | `None` = conta consagrada, **sem login** (login → 401) |
| `consagrado` | `bool`, default `False` | selo no perfil e no card |
| `nascimento` | `int \| None` | ano; só consagrados |
| `morte` | `int \| None` | ano; só consagrados |

O `bio` sobe de 280 para 1000 caracteres (consagrados têm bio maior).
`UserOut` ganha `consagrado`, `nascimento` e `morte`.
`GET /usuarios/{username}` (perfil) ganha `seguidores`, `seguindo` e `poemas`
(contagens).

### `Post` = poema (dono: Henrique)

`backend/app/models/post.py`, tabela `posts`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | int | |
| `autor_id` | FK `users.id` | |
| `titulo` | `str \| None` (200) | opcional |
| `texto` | `Text` | **sem limite**; vazio só em repost puro |
| `forma` | `str \| None` | uma de `FORMAS` (abaixo) |
| `obra` | `str \| None` | livro de origem (consagrados) |
| `ano` | `int \| None` | ano de publicação original (consagrados) |
| `fonte` | `str \| None` | URL da fonte (consagrados) |
| `repost_de_id` | FK `posts.id` \| None | repost: `texto` vazio = repost puro; com texto = citação |
| `created_at` / `updated_at` | datetime UTC | |

`FORMAS = ["soneto", "haicai", "trova", "quadra", "cordel", "verso_livre", "prosa_poetica", "outro"]`
fica em `backend/app/schemas/post.py` e é espelhada em `frontend/lib/api.ts`.

`PostOut`: os campos acima + `autor: UserOut`, `curtidas`, `comentarios`,
`reposts`, `curti: bool`, `repostei: bool`, `repost_de: PostOut | None`
(um nível) e `tags: list[str]`.

### `Follow` (dono: Neto)

Tabela `follows`: `seguidor_id` (FK users), `seguido_id` (FK users),
`created_at`, com unique (`seguidor_id`, `seguido_id`).

### Gancho do índice de tags (Neto ↔ Henrique)

`backend/app/core/indice_tags.py` (Neto) expõe o singleton `indice_tags` com:

```python
indice_tags.indexar(post_id: int, tags: set[str], criado_em: datetime) -> None
indice_tags.remover(post_id: int) -> None
indice_tags.posts_da_tag(tag: str) -> list[int]       # mais novo primeiro
indice_tags.trending(desde: datetime, k: int = 5) -> list[tuple[str, int]]
extrair_tags(texto: str, forma: str | None) -> set[str]  # #amor, mais a forma
```

O `services/posts.py` (Henrique) chama `indexar` ao criar ou editar e `remover`
ao apagar. **O Neto sobe primeiro um stub com essas assinaturas** (dia 1) para
o Henrique não ficar bloqueado.

### Componentes do front

- `components/Layout`, `Nav` e o tema (serifada para poemas): **Pedro**.
- `components/PoemaCard.tsx` (título, corpo `whitespace-pre-wrap`, forma, autor
  com selo, ações): **Henrique**. Pedro e Neto reusam o card, sem copiá-lo.
- `lib/api.ts`: dono **Pedro**. Cada um adiciona os próprios tipos e chamadas
  no fim do arquivo, numa seção com o nome da feature, para evitar conflito.

### Consagrados: formato de importação

Veja [`docs/consagrados.md`](docs/consagrados.md) e
`backend/data/consagrados/_exemplo.json`.

---

## Tasks

Os IDs são usados nas issues e nos PRs (`[H1] posts CRUD`).

### Pedro: Frontend · Auth · Perfil · Antologias

| ID | Task | Depende de | Bloqueia |
|---|---|---|---|
| **P0** | Bypass `X-User-Id` em `deps.py` (guia 01, Passo 0). **Primeira coisa a fazer, leva uns 15 min.** | — | todas as rotas protegidas |
| **P1** | Auth backend: campos do `User` (contrato acima), `Session`, `/auth/registro`, `/auth/login`, `/auth/eu`, `get_current_user` real; login de consagrado → 401 | P0 | **todos os testes do núcleo** |
| P2 | Layout, Nav, tema visual e `api.ts` enviando o token | — | H6, N3-front, P4, P5 |
| P3 | Telas de cadastro e login, guardando o token | P1, P2 | fluxo do vídeo |
| P4 | Perfil: `GET /usuarios/{username}` com contadores, `PATCH /usuarios/eu`, `GET /usuarios/{username}/posts`; tela com selo "Consagrado" e anos de vida | P1, H1, N1 (contadores) | N2 (tela dos consagrados) |
| P5 | **Antologias**: models `Antologia` e `AntologiaPoema`, rotas `/antologias` (estilo coleções do CONTRATO), telas "minhas antologias", detalhe e "adicionar à antologia" no card | H1, H6 | — |

### Henrique: Backend · Poemas · Feed · Conversa

| ID | Task | Depende de | Bloqueia |
|---|---|---|---|
| **H1** | Model `Post` (contrato) e CRUD `/posts`; só o autor edita ou apaga; chamadas a `indice_tags` | P0, stub N0 | P4, P5, H2–H5, N2, N3, N4 |
| H2 | `GET /feed` cronológico paginado (seguidos + próprios, com reposts) | H1, N1 | H6 |
| H3 | Curtidas idempotentes (`/posts/{id}/curtir`) | H1 | N4 |
| H4 | **Comentários em árvore**: `core/arvore_comentarios.py` (árvore + recursão), `parent_id`, sem quebrar o teste plano | H1 | H6 |
| H5 | **Repost + citação**: `POST/DELETE /posts/{id}/repostar` (puro, idempotente); citação = `POST /posts` com `repost_de_id` e `texto` | H1 | H6, N4 |
| H6 | Front: `PoemaCard`, compositor de poema (título, corpo e forma), feed com "carregar mais", página do poema com a árvore, botões curtir/repostar/citar | P2, H2–H5 | P5, N3-front |

### Neto: Dados · Consagrados · Formas/Temas · Deploy

| ID | Task | Depende de | Bloqueia |
|---|---|---|---|
| **N0** | Stub de `core/indice_tags.py` com as assinaturas do contrato (dia 1) | — | H1 |
| N1 | Follow: model `Follow` (`follows`), `POST/DELETE /usuarios/{username}/follow` idempotentes, listas e a função de contagem usada pelo perfil | P0 | H2, P4 |
| N2 | **Consagrados**: scraping (fora do app, em `backend/scripts/scraping/`) → JSON no formato de `docs/consagrados.md` → `scripts/importar_consagrados.py` idempotente (cria o user sem senha e os poemas) | P1 (campos do User), H1 | N4, N5 |
| N3 | **Formas/temas**: índice invertido real em `core/indice_tags.py`, `GET /tags/{tag}/posts`, `GET /tags/trending`, `GET /explorar?tag=&forma=`; tela Explorar com chips de forma e tags clicáveis | H1, H6 (card) | — |
| N4 | Seed fake do nicho: mais de 20 poetas iniciantes fictícios (cursos da UFPB na bio), mais de 50 poemas originais, follows (inclusive a consagrados), curtidas, comentários em árvore, reposts e citações; `seed_fake(db)` e `make seed` também importa os consagrados | todos os models (H1, H3, H4, H5, N1, P5) | N5 |
| N5 | Deploy: Render (backend, `SEED_ON_BOOT=true`, **sem DEBUG**) + Vercel (front), CORS com a URL pública | N4 | bônus +10 |
| N6 | Consolidar o `DECISIONS.md` (produto, decisões, escolha técnica e, opcional, `make bench` do índice invertido contra varredura) | — | entrega |

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
- **Deploy no free tier.** O SQLite some a cada restart, por isso o
  `SEED_ON_BOOT` recria o seed e os consagrados. A primeira request depois da
  hibernação leva cerca de 1 minuto.
- **Direitos autorais.** Só autores mortos até 1955; o importador recusa
  `morte > 1955`.
- **Estruturas em memória** (`indice_tags`, `arvore_comentarios`) zeram no
  `--reload`. São reconstruídas no lifespan (`core/README.md`).
