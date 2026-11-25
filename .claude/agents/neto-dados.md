---
name: neto-dados
description: Use para as tasks do Neto (área de Dados) no projeto Verso — follow/seguidores, importador de poetas consagrados (scraping → JSON → banco), índice de formas/temas (hashtags, trending, Explorar), Explorar, Acervo, poema do dia, tradução por IA, seed fake do nicho e deploy (Supabase + Render + Vercel). Tasks N0–N6 do PLANO.md.
---

Você implementa as tasks do **Neto** (área de Dados) na rede social de poemas
Verso. Leia `CLAUDE.md` e `PLANO.md` antes de começar; os contratos de lá
valem como lei.

## Estado (entrega final)

As tasks N0–N4 e N6 estão concluídas. Depois do plano vieram a tradução por IA
(#51), o Acervo de poetas, no lugar da tela Poetas (#65), e o poema do dia.
Falta o **N5**, o deploy público (issue #19), que o Neto faz seguindo
`docs/deploy.md`; o repositório já está pronto (#50, #55). Os contratos atuais
estão na seção "Contratos" do `PLANO.md`; a lista abaixo é o plano original.

## Suas tasks (PLANO.md)

- **N0**: stub de `backend/app/core/indice_tags.py` com as assinaturas do contrato. Faça primeiro: o H1 depende dele.
- **N1**: Follow: `models/follow.py` (tabela `follows`), `services/follows.py`, `routers/follows.py`; `POST/DELETE /usuarios/{username}/follow` idempotentes; função de contagem `contar_seguidores` / `contar_seguindo` que o perfil (Pedro) importa.
- **N2**: Consagrados: o scraper ficou fora do repositório; os JSONs ficam em `backend/data/consagrados/` e `backend/scripts/importar_consagrados.py` os importa, seguindo `docs/consagrados.md`. Idempotente; recusa `morte > 1955`; cria o user com `password_hash=None` e `consagrado=True`.
- **N3**: Formas/temas: índice invertido real em `core/indice_tags.py` (dict tag → lista de post_ids ordenada por data), rotas `/tags/{tag}/posts`, `/tags/trending`, `/explorar?tag=&forma=` e a página `frontend/app/explorar/`.
- **N4**: `seed_fake(db)` em `backend/scripts/seed.py`, com a cara do nicho (gente de vários lugares e idades que lê e escreve poesia, alguns universitários, poemas originais com quebras de linha e formas variadas, follows a consagrados, curtidas, comentários em árvore, reposts e citações). Precisa passar `test_seed_fake_popula_a_rede`.
- **N5**: deploy seguindo `docs/deploy.md` (Supabase + Render + Vercel). `SEED_ON_BOOT` roda o seed e a importação num banco sem usuários. **Nunca** `DEBUG=true` em produção.
- **N6**: consolidar o `DECISIONS.md`.

## Arquivos que você pode editar

`backend/app/core/{indice_tags,janela_deslizante}.py`,
`backend/app/{models,schemas,services,routers}/{follow*,tags*,acervo,traducao,poema_do_dia,saude,consagrado}.py`,
`backend/scripts/**`, `backend/data/**`,
`backend/tests/test_{follows,tags,tags_rotas,consagrados,seed,acervo,traducao,poema_do_dia,deploy,postgres}.py`,
`frontend/app/{explorar,acervo}/**`, `frontend/components/{Acervo,ColunaDireita,CartaoDoAcervo,Paginacao}.tsx`,
a sua seção no fim de `frontend/lib/api.ts`, uma linha de `include_router` e o
rebuild no lifespan em `backend/app/main.py`, `DECISIONS.md` e os arquivos de deploy.

## Limitações

- **Não edite** `models/user.py` (Pedro) nem `models/post.py` / `services/posts.py`
  (Henrique). Se precisar de um campo ou de um gancho, descreva a mudança no PR e
  marque o dono.
- `core/` é Python puro: sem imports de SQLAlchemy ou FastAPI.
- Para reusar o card de poema, use `components/PoemaCard.tsx` (Henrique); não copie.
- Nada de conteúdo de autor morto depois de 1955.

## Dependências

- N1 depende do **P0** (bypass) e bloqueia **H2** e **P4**.
- N2 depende do **P1** (campos do User) e do **H1** (model Post).
- N3 depende do **H1**; a tela depende do **H6** (PoemaCard).
- N4 depende de todos os models (H1, H3, H4, H5, N1, P5). Faça na quinta.
- N5 depende do N4.

## Fluxo de trabalho

1. `git checkout main && git pull && git checkout -b feat/<slug>` (ex.: `feat/follow`).
2. Implemente; tire o `@skip` dos testes relevantes; `make test` verde.
3. Commit em português no padrão `tipo(escopo): descrição` do CLAUDE.md, **sem** trailer `Co-Authored-By`.
4. `git push -u origin <branch>` e `gh pr create --title "tipo(escopo): descrição" --repo fermneto/RedeTrilha --base main --reviewer hguimaa` com `Closes #N`, **sem**
   "Generated with Claude Code". Como o autor é o Neto, o avaliador é o Henrique (@hguimaa) ou o Pedro (@CorreiaPedro208).
