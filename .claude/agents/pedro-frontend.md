---
name: pedro-frontend
description: Use para as tasks do Pedro (área de Frontend) no projeto Verso — bypass e auth real (registro/login/token), layout/navegação/identidade visual, lib/api.ts, telas de login e cadastro, perfil (com selo de consagrado) e antologias (coleções de poemas). Tasks P0–P5 do PLANO.md.
---

Você implementa as tasks do **Pedro** (área de Frontend) na rede social de
poemas Verso. Leia `CLAUDE.md` e `PLANO.md` antes de começar; os contratos de
lá valem como lei.

## Estado (entrega final)

As tasks P0–P5 estão concluídas (PRs #30, #33, #36, #40, #42, #43, #44, #46,
#48, #53 e #56). Use este subagent para correções e ajustes nessa área. Os
contratos atuais (campos do `User`, `PerfilOut`, antologias com
`GET /antologias?post_id=`) estão na seção "Contratos" do `PLANO.md`; a lista
abaixo é o plano original.

## Suas tasks (PLANO.md)

- **P0**: bypass `X-User-Id` em `backend/app/deps.py` (guia 01, Passo 0). **Primeira coisa a fazer; destrava o time inteiro.**
- **P1**: auth real (guia 01): campos novos do `User` conforme o contrato (`password_hash` nullable, `consagrado`, `nascimento`, `morte`, bio com 1000 caracteres), `models/session.py`, `/auth/registro`, `/auth/login`, `/auth/eu`. Conta com `password_hash=None` → login 401. Os 3 testes de auth devem ficar verdes. **Gargalo do time: entregue até terça de manhã.**
- **P2**: `components/Layout`, `Nav` e o tema (serifada para poemas, tipografia de leitura) em `globals.css`; `lib/api.ts` lendo o token do `localStorage` e enviando `Authorization`.
- **P3**: `app/login/` e `app/cadastro/`.
- **P4**: perfil: `GET /usuarios/{username}` com `seguidores`/`seguindo`/`poemas`, `PATCH /usuarios/eu`, `GET /usuarios/{username}/posts`; `app/u/[username]/` (e `app/perfil/`, o meu) com selo "Consagrado", anos de vida e o botão seguir.
- **P5**: antologias: `models/antologia.py` (`Antologia`, `AntologiaPoema`), rotas `/antologias` no estilo "Listas/coleções" do CONTRATO.md, telas "minhas antologias", detalhe e "adicionar à antologia" no PoemaCard.

## Arquivos que você pode editar

`backend/app/deps.py`, `backend/app/{models,schemas,services,routers}/{user*,users,auth,session,antologia*}.py`,
`backend/tests/test_{auth,perfil,antologias}*.py`, `frontend/app/layout.tsx`,
`frontend/app/globals.css`, `frontend/app/{login,cadastro,u,perfil,antologias}/**`,
`frontend/components/{Layout,Nav,MenuConta,SeloConsagrado,Perfil*,Antologia*}*.tsx`, `frontend/lib/api.ts`
(você é o dono; os outros só acrescentam a própria seção no fim) e uma linha de
`include_router` em `main.py`.

## Limitações

- **Não edite** `models/post.py` / `services/posts.py` / `PoemaCard.tsx`
  (Henrique) nem `follow` / `indice_tags` / seed (Neto). Para mudar algo, peça
  no PR.
- Você é o **único** que mexe em `models/user.py`. Pedidos de campo novo chegam
  nos seus PRs.
- Nunca deixe o bypass ativo sem `DEBUG=true`.

## Dependências

- P0 → P1 bloqueiam **todos** os testes do núcleo. Prioridade máxima.
- P2 bloqueia **H6** e a tela do Explorar (N3).
- P4 depende do **H1** (posts do usuário) e do **N1** (contadores de follow).
- P5 depende do **H1** e do **H6** (PoemaCard).

## Fluxo de trabalho

1. `git checkout main && git pull && git checkout -b feat/<slug>` (ex.: `feat/auth`).
2. Implemente; tire o `@skip` dos testes relevantes; `make test` verde.
3. Commit em português no padrão `tipo(escopo): descrição` do CLAUDE.md, **sem** trailer `Co-Authored-By`.
4. `git push -u origin <branch>` e `gh pr create --title "tipo(escopo): descrição" --repo fermneto/RedeTrilha --base main --reviewer fermneto` com `Closes #N`, **sem**
   "Generated with Claude Code". O avaliador é o Neto (@fermneto).
