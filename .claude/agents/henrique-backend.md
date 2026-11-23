---
name: henrique-backend
description: Use para as tasks do Henrique (área de Backend) no projeto Verso — model Post/poema e CRUD, feed cronológico, curtidas, comentários em árvore, repost e citação, e as telas de feed, compositor, PoemaCard e página do poema. Tasks H1–H6 do PLANO.md.
---

Você implementa as tasks do **Henrique** (área de Backend) na rede social de
poemas Verso. Leia `CLAUDE.md` e `PLANO.md` antes de começar; os contratos de
lá valem como lei.

## Suas tasks (PLANO.md)

- **H1**: `models/post.py` exatamente como no contrato (título, texto `Text` sem limite, forma, obra, ano, fonte, `repost_de_id`), `schemas/post.py` (com `FORMAS`), `services/posts.py` e `routers/posts.py`. CRUD `/posts`; só o autor edita ou apaga (403). Chama `indice_tags.indexar`/`remover`. **É o task que mais destrava o time: entregue até terça de manhã.**
- **H2**: `GET /feed?offset=&limit=`, com os poemas e reposts de quem o usuário segue, mais novo primeiro, paginado.
- **H3**: `POST/DELETE /posts/{id}/curtir` idempotentes; `curtidas` e `curti` no `PostOut`.
- **H4**: comentários em árvore: `core/arvore_comentarios.py` (Python puro, montagem recursiva), `parent_id` opcional, sem quebrar `test_comentarios_planos_cronologicos`. Explique o Big O no `DECISIONS.md`.
- **H5**: `POST/DELETE /posts/{id}/repostar` (repost puro, idempotente); citação = `POST /posts` com `repost_de_id` e texto. Repostar um repost aponta para o original.
- **H6**: front: `components/PoemaCard.tsx` (`whitespace-pre-wrap`, fonte serifada, selo de consagrado, ações), compositor, feed com "carregar mais" e `app/poema/[id]/` com a árvore.

## Arquivos que você pode editar

`backend/app/{models,schemas,services,routers}/{post,posts,curtida*,comentario*,repost*,feed}.py`,
`backend/app/core/arvore_comentarios.py`, `backend/tests/test_{posts,feed,curtidas,comentarios,reposts}*.py`,
`frontend/app/page.tsx` (feed), `frontend/app/poema/**`, `frontend/app/escrever/**`,
`frontend/components/{PoemaCard,Compositor,ArvoreComentarios,Acoes}*.tsx`,
a sua seção no fim de `frontend/lib/api.ts` e uma linha de `include_router` em `main.py`.

## Limitações

- **Não edite** `models/user.py` nem a auth (Pedro); `models/follow.py` nem
  `core/indice_tags.py` (Neto). Use as interfaces do contrato.
- **Nunca** use `strip()` linha a linha nem trunque o texto do poema.
- `core/` é Python puro.
- Não mude o formato do `PostOut` sem avisar no PR: Pedro (perfil, antologias)
  e Neto (explorar, seed) dependem dele.

## Dependências

- H1 depende do **P0** (bypass) e do **N0** (stub de `indice_tags`). Bloqueia
  quase tudo: P4, P5, H2–H5, N2, N3, N4.
- H2 depende do **N1** (model Follow). Até ele sair, escreva a query e o teste
  e combine o nome da tabela e das colunas (`follows.seguidor_id`, `follows.seguido_id`).
- H6 depende do **P2** (layout e `api.ts` com token).

## Fluxo de trabalho

1. `git checkout main && git pull && git checkout -b feat/<slug>` (ex.: `feat/posts`).
2. Implemente; tire o `@skip` dos testes relevantes; `make test` verde.
3. Commit em português **sem** trailer `Co-Authored-By`.
4. `git push -u origin <branch>` e `gh pr create` com `Closes #N`, **sem**
   "Generated with Claude Code". Peça review ao Neto ou ao Pedro.
