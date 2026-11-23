# CLAUDE.md — Verso (rede social de poemas)

Rede social de nicho para **poetas iniciantes universitários**: publicar poemas
sem limite de caracteres, comentar, curtir, repostar/citar e ler os
**consagrados** (poetas em domínio público, contas sem login). Base: template do
Mini-projeto 3 da Trilha UFPB. **Entrega: sexta, 27/11/2026.**

Leia antes de qualquer tarefa: [`PLANO.md`](PLANO.md) (tasks, donos,
dependências e contratos de dados). Avaliação: [`RUBRICA.md`](RUBRICA.md).

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
4. Commits pequenos, em português, dizendo o porquê.
5. Antes de abrir o PR: `make test` verde e `git merge main` sem conflito.
   Conflito em `main.py`: mantenha as duas linhas (guia 02).
6. Nunca commite `*.db`, `.env`, `.env.local` nem `.claude/settings.local.json`.

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

## Comandos

```bash
make check       # ambiente ok
make seed        # popula o banco (seed fake + consagrados)
make test        # pytest do backend
DEBUG=true make dev-back   # API em :8000 (bypass X-User-Id só com DEBUG)
make dev-front   # Next em :3000
```

## Convenções de código (critério "Código" da rubrica)

- **Fluxo de uma feature:** model → schema → service → router → `lib/api.ts`
  → página. Imite o slice `/usuarios`.
- **Router fino**, regra de negócio no **service**, estruturas de dados em
  **`backend/app/core/`** em Python puro (sem SQLAlchemy/FastAPI), seguindo
  `core/README.md` e `core/contadores.py`.
- Um arquivo por model e por router; registre o router com uma linha em `main.py`.
- **Nomes em português** e consistentes entre model, schema, rota e tela
  (`poema`, `antologia`, `forma`, `consagrado`). Exceção: campos herdados do
  template e fixados pelos testes (`username`, `name`, `bio`, `avatar_url`,
  `created_at`, `texto`).
- Listagens devolvem página: `{"items", "total", "offset", "limit"}`.
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

- `neto-dados`: follow, consagrados (importador), tags/formas, seed e deploy.
- `henrique-backend`: posts/poemas, feed, curtidas, comentários em árvore e repost/citação.
- `pedro-frontend`: auth, layout/navegação, perfil e antologias.

Ao trabalhar numa task, use o subagent do dono dela. Um subagent não edita
arquivos fora do próprio escopo; se precisar, ele descreve a mudança no PR e
pede ao dono.

## Domínio público

Só entram como consagrados autores **mortos até 1955** (domínio público no
Brasil em 2026: 70 anos após a morte). Cada poema guarda a `fonte` (URL).
