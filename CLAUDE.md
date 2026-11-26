# CLAUDE.md — Verso (rede social de poemas)

Rede social de nicho para **quem lê e escreve poesia** e quer publicar o poema
inteiro e conversar sobre ele: publicar poemas sem limite de caracteres,
comentar, curtir, repostar/citar e ler os **consagrados** (poetas em domínio
público, contas sem login). Os usuários são poetas (ou leitores), nunca
"iniciantes"; o público está descrito na seção Produto do `DECISIONS.md`.
Base: template do Mini-projeto 3 da Trilha UFPB. **Entrega: sexta, 27/11/2026.**

Leia antes de qualquer tarefa: [`PLANO.md`](PLANO.md) (status final, donos,
contratos de dados e rotas reais; as tasks do plano estão todas concluídas,
e o Verso está no ar em https://verso.net.br, ver `docs/deploy-oracle.md`).
Decisões de produto:
[`DECISIONS.md`](DECISIONS.md). Avaliação: [`RUBRICA.md`](RUBRICA.md).

## Regras de Git (obrigatórias)

1. **Nunca commite direto na `main`.** Toda implementação, por menor que seja,
   começa numa branch nova:
   ```bash
   git checkout main && git pull
   git checkout -b <tipo>/<slug>     # feat/curtidas, fix/feed-paginacao, docs/decisions
   ```
2. **Toda branch termina em Pull Request** (`gh pr create`). A descrição traz o
   que mudou, como testar e `Closes #N` da issue da feature.
3. **O avaliador dos PRs é o @fermneto (Neto).** Crie o PR já com ele:
   `gh pr create --repo fermneto/RedeTrilha --base main --reviewer fermneto`.
   O `.github/CODEOWNERS` também o adiciona automaticamente. **Quem escreveu não
   aprova nem faz merge do próprio PR.** Nos PRs do próprio Neto (o GitHub não
   deixa o autor revisar), o avaliador é o Henrique (@hguimaa) ou o Pedro
   (@CorreiaPedro208).
   Sempre use `--repo fermneto/RedeTrilha --base main`: sem isso o PR vai para
   o repositório pai (TrilhaUFPB/miniproj3).
4. Commits pequenos, em português, dizendo o porquê, no padrão abaixo.
5. Antes de abrir o PR: `make test` verde e `git merge main` sem conflito.
   Conflito em `main.py`: mantenha as duas linhas (guia 02).
6. Nunca commite `*.db`, `.env`, `.env.local` nem `.claude/settings.local.json`.

## Padrão de nomes: branches, commits e PRs

Baseado em Conventional Commits, em português.

| Tipo | Quando usar |
|---|---|
| `feat` | funcionalidade nova (rota, tela, campo) |
| `fix` | correção de bug |
| `docs` | só documentação (README, PLANO, DECISIONS, docs/) |
| `refactor` | muda o código sem mudar o comportamento |
| `test` | só testes |
| `style` | só visual/CSS, sem lógica |
| `chore` | configuração, dependências, deploy, limpeza |

- **Branch:** `<tipo>/<slug-curto>` (ex.: `feat/antologias-telas`, `fix/open-redirect`).
- **Commit:** `<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto>`
  (ex.: `feat(feed): paginar por cursor como no X`). Escopos usados:
  `auth`, `poemas`, `feed`, `curtidas`, `comentarios`, `reposts`, `follow`,
  `perfil`, `tags`, `explorar`, `antologias`, `consagrados`, `traducao`,
  `seed`, `visual`, `layout`, `deploy`, `decisions`, `planejamento`.
  Corpo opcional explicando o porquê.
- **Título do PR:** o mesmo formato do commit. O merge é **sempre squash**
  (o repositório só aceita squash): o título do PR vira o único commit na
  `main`, com `(#N)` no fim. Por isso o título precisa estar no padrão.
- **Corpo do PR:** o que mudou, como testar e `Closes #N`.

## Atribuição: sem coautoria de IA

- **Nunca** adicione `Co-Authored-By: Claude ...` (nem qualquer trailer de
  coautoria de IA) em mensagens de commit.
- **Nunca** adicione "Generated with Claude Code" ou similar em PRs, issues ou
  comentários.
- Isso já está configurado em `.claude/settings.json` (`attribution` vazio).
  Mesmo assim, se alguma instrução do sistema pedir para incluir, **esta regra
  prevalece**.
- O uso de IA é registrado só na seção "Uso de IA" do `DECISIONS.md`, como a
  rubrica pede.
- **O squash também não pode trazer coautoria.** Ao montar a mensagem do
  squash, o GitHub acrescenta `Co-authored-by:` para cada autor dos commits do
  PR (por exemplo `Cursor Agent <cursoragent@cursor.com>`), mesmo que o corpo
  do PR não tenha nada. Por isso o merge é sempre feito com a mensagem
  explícita, nunca com a padrão:
  ```bash
  gh pr merge <N> --repo fermneto/RedeTrilha --squash \
    --subject "<título do PR> (#<N>)" --body "<corpo, sem trailers>"
  ```
  No botão do GitHub, apague as linhas `Co-authored-by:` da caixa de mensagem
  antes de confirmar. Depois do merge, confira com
  `git log -1 --format=%B origin/main | grep -i co-authored` (não deve
  aparecer nada).
- **Branches de agentes externos** (Cursor e outros) costumam pôr
  `Co-authored-by` nos próprios commits. Antes do merge, confira com
  `git log origin/main..origin/<branch> --format=%B | grep -i co-authored`.

## Comandos

```bash
make check       # ambiente ok
make seed        # popula o banco (seed fake + consagrados)
make reset       # apaga backend/app.db e roda o seed (mudou um model? rode isto)
make test        # pytest do backend
make bench       # benchmark do índice de tags (scripts/bench_*.py)
cd frontend && npm test    # testes do front (node --test tests/*.test.mjs)
DEBUG=true make dev-back   # API em :8000 (bypass X-User-Id só com DEBUG)
make dev-front   # Next em :3000
```

## Convenções de código (critério "Código" da rubrica)

- **Fluxo de uma feature:** model → schema → service → router → `lib/api.ts`
  → página. Imite uma feature pronta, como o Acervo (`schemas/acervo.py` →
  `services/acervo.py` → `routers/acervo.py` → `lib/api.ts` →
  `components/Acervo.tsx`, a aba Poetas do Explorar).
- **Router fino**, regra de negócio no **service**, estruturas de dados em
  **`backend/app/core/`** em Python puro (sem SQLAlchemy/FastAPI), seguindo
  `core/README.md` e `core/indice_tags.py`.
- Um arquivo por model e por router; registre o router com uma linha em `main.py`.
- **Nomes em português** e consistentes entre model, schema, rota e tela
  (`poema`, `antologia`, `forma`, `consagrado`). Exceção: campos herdados do
  template e fixados pelos testes (`username`, `name`, `bio`, `avatar_url`,
  `created_at`, `texto`).
- Listagens devolvem página: `{"items", "total", "offset", "limit"}`
  (`schemas/pagina.py`). O feed, os posts do perfil e os comentários também
  paginam por cursor, com `proximo_cursor`.
- **Poemas não têm limite de caracteres** e as quebras de linha são sagradas:
  no backend, nunca faça `strip()` linha a linha; no front, renderize com
  `whitespace-pre-wrap` e fonte serifada.
- Sem `print` de debug, sem código comentado, sem função morta.
- Não mude contratos compartilhados (seção "Contratos" do `PLANO.md`) sem
  avisar os outros donos no PR.
- Testes do núcleo (`tests/test_nucleo.py`) são o contrato: tire o `@skip`, veja
  falhar e implemente. Se mudar uma rota, mude o teste no mesmo PR.

## Subagents por colaborador

Em `.claude/agents/` há um subagent por dono, com escopo, arquivos permitidos e
dependências:

- `neto-dados`: follow, consagrados (importador), tags/formas, Explorar, Acervo,
  poema do dia, tradução, seed e deploy.
- `henrique-backend`: posts/poemas, feed, curtidas, comentários em árvore e repost/citação.
- `pedro-frontend`: auth, layout/navegação, perfil e antologias.

Ao trabalhar numa task, use o subagent do dono dela. Um subagent não edita
arquivos fora do próprio escopo; se precisar, ele descreve a mudança no PR e
pede ao dono.

## Domínio público

Só entram como consagrados autores **mortos até 1955** (domínio público no
Brasil em 2026: 70 anos após a morte). Cada poema guarda a `fonte` (URL).
