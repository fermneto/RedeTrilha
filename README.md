# Verso: a rede social de poemas

O Verso é uma rede social para **quem lê e escreve poesia** e quer publicar o
poema inteiro e conversar sobre ele: a estudante que escreve no caderno, a
professora aposentada que faz sonetos à mão, o motorista que escreve cordel no
ponto final, o aluno do ensino médio que guarda poemas no celular. No X, o limite de caracteres parte um soneto em
fio; no Instagram, o poema vira imagem e não dá para citar um verso; os feeds
ranqueados enterram texto longo. No Verso, o post é o poema (título, corpo sem
limite com as quebras e os recuos preservados, e uma forma), o feed é
cronológico, citar um verso e conversar em árvore são gestos de primeira classe,
e 155 poetas consagrados em domínio público convivem no mesmo feed, no original,
com tradução por IA a um clique. O porquê de cada escolha está no
[DECISIONS.md](DECISIONS.md).

Mini-projeto 3 da Trilha UFPB. Time: Neto (@fermneto), Henrique (@hguimaa) e
Pedro (@CorreiaPedro208).

## Funcionalidades

- **Login e cadastro** com sessão por token; os consagrados são contas sem login.
- **Poemas sem limite de caracteres**, com título opcional e as quebras de linha
  e os recuos preservados (o Tab do compositor insere recuo).
- **Formas:** soneto, haicai, trova, quadra, cordel, verso livre, prosa poética
  ou outro. A forma vira tag (`#soneto`).
- **Feed cronológico com reposts como no X:** cada poema aparece uma vez, na
  posição do repost mais recente, com "repostado por"; paginação por cursor.
- **Repost e citação:** repostar puro ou citar com um texto seu. Se o original
  for apagado, a citação mostra "poema removido pelo autor".
- **Comentários em árvore**, com respostas paginadas e o marcador "comentário
  removido" quando um comentário com respostas é apagado.
- **Curtidas** idempotentes.
- **Perfil** com seguidores, seguindo, poemas, seguir/deixar de seguir e edição
  de nome, bio e URL da foto.
- **Acervo:** todos os poetas, consagrados e poetas do Verso, com busca e filtros por
  tipo, língua e época, e ordenação.
- **Explorar:** chips de forma e busca por tag (`#Solidão` acha `#solidao`).
  Ao lado, na coluna Descobrir (no topo do Explorar em telas estreitas):
  **Em alta** (tags das últimas 24 h), **Poema do dia** (um consagrado, o mesmo
  para todos no dia) e consagrados para seguir.
- **Antologias:** coleções curadas de poemas, públicas ou privadas.
- **Consagrados de domínio público** (mortos até 1955), com selo próprio, anos
  de vida e a fonte de cada poema.
- **Tradução por IA** (Claude Haiku 5.5) para a língua do navegador, com cache
  por (poema, língua) e limite de 30 traduções novas por hora por usuário.

## Onde está no ar

- **Site:** a URL de produção da Vercel (o Neto preenche aqui depois do deploy).
- **API:** uma VM ARM da Oracle Cloud Always Free, com Docker Compose (duas
  réplicas da API e o Caddy, com HTTPS automático, balanceando entre elas) e o
  Postgres na mesma VM, com backup diário para o Object Storage da Oracle. `GET /saude` responde
  `{"ok":true}`.
- **Conta de demonstração:** `marina_letras` / `verso123`.

Passo a passo do deploy em [docs/deploy-oracle.md](docs/deploy-oracle.md). O
Render com o Supabase ([docs/deploy.md](docs/deploy.md)) fica como alternativa simples.

## Como rodar localmente

Instale as dependências uma vez:

```bash
cd backend && uv sync && cd ..
cd frontend && npm install && cp .env.local.example .env.local && cd ..
```

Crie o banco local com o seed (29 poetas fictícios de vários lugares e idades,
com poemas, conversas e rengas, mais os consagrados):

```bash
make check   # confere o ambiente
make reset   # apaga backend/app.db e roda o seed
```

Não há migração: mudou um model, rode `make reset` de novo.

Suba a API e o site em dois terminais:

```bash
make dev-back    # API em localhost:8000, Swagger em localhost:8000/docs
make dev-front   # site em localhost:3000
```

**Conta de demonstração:** `marina_letras` / `verso123` (todos os usuários do
seed usam essa senha).

**Tradução:** exporte `ANTHROPIC_API_KEY` no terminal do backend antes do
`make dev-back`. A chave nunca vai para um arquivo do repositório. Sem ela, o
resto do site funciona e só a tradução responde 503. Os testes nunca chamam a
API.

**Testes e benchmark:**

```bash
make test                # pytest do backend
make bench               # índice invertido de tags contra varredura
cd frontend && npm test  # testes do front (node --test)
```

Se algum comando falhar, veja o [guia 00](docs/guias/00-setup.md).

## Estrutura do repositório

```
backend/app/
  models/    tabelas do SQLAlchemy (User, Post, Comentario, Antologia, Traducao...)
  schemas/   entrada e saída da API (pydantic)
  services/  regras de negócio
  routers/   rotas finas, uma por arquivo, registradas em main.py
  core/      estruturas de dados em Python puro (índice de tags, árvore de
             comentários, janela deslizante da tradução)
backend/scripts/   seed, importador de consagrados, preparar_banco, check_setup, bench, carga
backend/Dockerfile imagem da API (arm64 e amd64)
deploy/oracle/     compose.yaml (2 réplicas da API, Postgres, Caddy, backup), atualizar.sh, restaurar.sh e .env.example
backend/data/consagrados/   um JSON por poeta consagrado
frontend/
  app/         páginas (feed, explorar, escrever, acervo, antologias, perfil,
               u/[username], poema/[id], login, cadastro)
  components/  PoemaCard, Compositor, ArvoreComentarios, Nav, ColunaDireita...
  lib/api.ts   tipos e chamadas à API
```

## Documentação

| Documento | Para quê |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Produto, decisões, features, escolha técnica e uso de IA |
| [PLANO.md](PLANO.md) | Status final, contratos de dados e as tasks do time |
| [CLAUDE.md](CLAUDE.md) | Fluxo de trabalho: Git, padrão de commits e convenções de código |
| [docs/deploy-oracle.md](docs/deploy-oracle.md) | Deploy público principal (VM da Oracle com API e Postgres + Vercel) |
| [docs/deploy.md](docs/deploy.md) | Deploy alternativo (Supabase + Render + Vercel) |
| [docs/consagrados.md](docs/consagrados.md) | Formato de importação dos consagrados |
| [RUBRICA.md](RUBRICA.md) | Como o projeto é avaliado |
| [CONTRATO.md](CONTRATO.md) e [CATALOGO.md](CATALOGO.md) | Sugestões do template para as features |
| [docs/guias/](docs/guias/) | Guias do curso (setup, autenticação, git em equipe, deploy...) |

As rotas reais estão no Swagger, em `localhost:8000/docs`.

## Prazos

| Marco | Data |
|---|---|
| Início | segunda, 16/11/2026 |
| Entrega final | sexta, 27/11/2026 |
