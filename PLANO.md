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
Vercel e no Supabase (#50, #55, hoje a alternativa ao deploy na Oracle),
limpeza para o critério de código e `make bench` (#64), o Acervo de poetas com filtros no lugar da tela Poetas
(#65) e as correções do teste de ponta a ponta (#66).

**Deploy público (N5, issue #19, fechada):** no ar numa VM da Oracle Cloud
em São Paulo, e não no Render, com a `main` até o #184. A API está em
https://api.verso.net.br (Caddy com HTTPS na frente de 2 réplicas, Postgres 16
na mesma VM e backup diário às 03:30 enviado ao Object Storage da Oracle); o
front está na Vercel, em https://verso.net.br (também
https://verso-blond.vercel.app). As atualizações saem com
`deploy/oracle/atualizar.sh`, uma réplica de cada vez, sem tirar o site do ar.
O envio do backup ao Object Storage funciona desde o #184 (faltavam as
autoridades certificadoras na imagem), e o teste de restauração a partir do
bucket deu os mesmos números nas duas pontas (189 usuários e 11.340 poemas,
em 26/11). Passo a passo em [`docs/deploy-oracle.md`](docs/deploy-oracle.md);
o Render com o Supabase ([`docs/deploy.md`](docs/deploy.md)) fica como
alternativa.

**Ficou com o Neto:** **o vídeo** da entrega, em andamento.

As validações do Henrique e do Pedro ficam nas issues #57 a #62.

## Produto (rascunho para o `DECISIONS.md`)

- **Público:** pessoas que leem e escrevem poesia e querem publicar o poema
  inteiro e conversar sobre ele (a versão final está no `DECISIONS.md`).
- **Problema:** no X o limite de caracteres quebra o poema; no Instagram o poema
  vira imagem e não dá para citar um verso; os feeds algorítmicos enterram texto
  longo. Além disso, quase ninguém lê os clássicos ao lado do que escreve.
- **Como a rede resolve:** um poema é um post de verdade (título, corpo sem
  limite com as quebras de linha preservadas, forma), com conversa em árvore,
  repost/citação de versos e os **consagrados** (Augusto dos Anjos, Bilac,
  Pessoa...) convivendo no mesmo feed.
- **Sinal de sucesso:** alguém cita um verso de um consagrado ou de outro
  poeta da rede e recebe respostas na árvore de comentários.

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
| `avatar_url` | `str` (500) | vazia ou URL http(s) |
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
  mais `seguidores`, `seguindo`, `poemas` (poemas e citações, mais 1 por renga
  de que a pessoa participou, criando ou escrevendo estrofe; reposts puros não
  contam; o Acervo usa a mesma conta) e `sigo`.
- `PATCH /usuarios/eu` 🔒: `name`, `bio` e `avatar_url`, só os enviados; `null`
  explícito → 422.

### `Post` = poema (dono: Henrique)

`backend/app/models/post.py`, tabela `posts`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | int | |
| `autor_id` | FK `users.id` | |
| `titulo` | `str \| None` (200) | opcional |
| `texto` | `Text` | **sem limite**, gravado como veio; vazio só em repost puro; pode ter as marcas de formatação (abaixo) |
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

**Formato do texto (#137):** o `texto` continua uma string de texto puro, mas
pode ter negrito, itálico, sublinhado e tachado num subconjunto de Markdown:
`**negrito**`, `*itálico*`, `++sublinhado++` e `~~tachado~~`, com `\` antes de
`*`, `+`, `~` ou `\` para o caractere literal. Uma marca nunca atravessa a
quebra de linha (o compositor fecha e reabre em cada verso), então
`texto.split("\n")` tem o mesmo número de linhas com ou sem marcas. Um
delimitador só abre antes de um caractere que não é espaço e só fecha depois de
um; o que não fecha no mesmo verso é literal (`* * *`, `2 * 3` e o `shade*,` de
um consagrado continuam como estão). As regras ficam em `core/marcas.py`
(`texto_sem_marcas`) e em `frontend/lib/marcas.ts`, com os mesmos casos de
teste (`backend/tests/casos_marcas.json`). Valem no `texto` do poema, da
citação, do rascunho e da estrofe de renga; comentários (e mensagens diretas)
são texto puro, sem interpretação. A oficina mede, as `#tags` se extraem e o
"verso em branco" da âncora se testa no texto sem as marcas; o `trecho` da
âncora, a tradução e o `trecho` do Em alta trazem as marcas (o verso do Em alta
é escolhido no texto sem marcas e exibido formatado).

`FORMAS = ["soneto", "haicai", "trova", "quadra", "cordel", "verso_livre", "prosa_poetica", "outro"]`
fica em `backend/app/schemas/post.py`, tirada de `ROTULOS_DAS_FORMAS` (código →
rótulo, "prosa_poetica" → "prosa poética"). Os limites dos campos (username,
senha, nome, bio, título, antologia, renga, oficina, mensagem) ficam em
`backend/app/core/limites.py`, e os schemas validam com eles. O servidor é a
fonte: `GET /preferencias/opcoes` entrega as formas com rótulo e os limites;
`frontend/lib/vocabulario.ts` guarda a única cópia de reserva, para o que não
espera a rede (validação do cadastro, seletores do compositor e do Explorar), e
`tests/vocabulario.test.mjs` confere que ela bate com o backend.

- `PostCreate`: `titulo`, `texto` (não pode ficar em branco), `forma`, `idioma`
  e `repost_de_id` (com texto, é citação), ou `renga_citada_id` (citação de uma
  renga, #171; os dois juntos → 422). Só o autor apaga (403).
- **Poema publicado é imutável** (decisão do Neto, #73): não há `PATCH /posts/{id}`
  (405). Para corrigir, o autor apaga e publica de novo, perdendo curtidas e
  comentários. O que se edita é o rascunho (abaixo). O importador de
  consagrados continua atualizando os posts direto no banco.
- `PostOut`: os campos da tabela (menos `tags_extras`) + `autor: UserOut`,
  `curtidas`, `comentarios`, `reposts`, `curti`, `repostei`,
  `repost_de: PostOut | None` (um nível), `repost_removido`, `tags: list[str]`
  (`#hashtags` + forma + `tags_extras`, normalizadas) e
  `repostado_por: list[UserOut]` (só no feed; vazio fora dele). Desde #171,
  também `renga_citada_id` e `renga_citada: RengaDetalhe | None` (a renga que o
  poema cita, com as estrofes, um nível); a renga de quem bloqueou quem vê vem
  `null` com `repost_indisponivel: true`.
- **Citação de renga (#171):** tabela nova `citacoes_renga` (`post_id` PK e FK
  `posts.id`, `renga_id`), nenhuma coluna em `posts`. O poema que cita é um
  poema comum (entra no feed, no perfil, no Explorar); apagá-lo apaga o vínculo.
- **Apagar um poema com reposts:** os reposts puros são apagados junto; as
  citações continuam, com `repost_de: null` e `repost_removido: true`, e a tela
  mostra "poema removido pelo autor", como no X.
- Repostar um repost aponta para o original. Curtir, comentar, adicionar a uma
  antologia ou traduzir um repost puro age no original.

### Feed e posts do perfil (`FeedPage`)

`GET /feed` 🔒 e `GET /usuarios/{username}/posts` 🔒 devolvem `FeedPage`
(`schemas/feed.py`): uma `Pagina` de itens com `tipo`, mais
`proximo_cursor: str | None`. Cada item é:

- `PoemaNoFeed` (`tipo: "poema"`): o `PostOut` de sempre, com o campo `tipo`.
- `RengaNoFeed` (`tipo: "renga"`): `renga: RengaDetalhe`, `atividade`
  (`"abriu"` | `"escreveu"` | `"encerrou"` | `"repostou"`) e `por: list[UserOut]`,
  o rótulo "fulano abriu uma renga" / "fulano escreveu uma estrofe" / "fulano
  encerrou a renga" / "fulano repostou" (ver abaixo).

O `GET /explorar` e o `GET /tags/{tag}/posts` continuam em `PostPage`, sem `tipo`.

- Reposts como no X: cada poema aparece uma vez, na ocorrência mais recente.
  `repostado_por` lista todos os seguidos (e o próprio usuário) que repostaram,
  do mais recente para o mais antigo. Citações não deduplicam com o original.
- Paginação como na timeline do X: `limit` de 1 a 100 (padrão 20) e um
  `cursor` opaco. Com `cursor`, ele tem precedência sobre o `offset` e o
  `total` vem `null`; sem cursor, `offset` e `total` valem (teste do núcleo).
  `proximo_cursor` é `null` no fim (no perfil; o feed não tem fim, ver abaixo).
- **Feed infinito, como no X** (`services/feed_infinito.py`, `core/continuacao.py`):
  o `GET /feed` e o `GET /feed/para-voce` nunca têm última página; o
  `proximo_cursor` só vem `null` com o banco sem poemas. Cada aba é uma corrente
  de trechos: Seguindo = quem a pessoa segue → o "Para você" do topo (sem o que a
  sessão já viu) → a continuação; "Para você" = o cronológico (o inédito, sem o
  que a pessoa já viu em qualquer sessão) → a continuação. A continuação
  intercala, 3 para 1, poemas de consagrados e os 50 mais curtidos da comunidade
  (em volta, podendo repetir; sem poema da comunidade, os de qualquer conta). Os
  consagrados saem numa fila ordenada e cortada no banco (`ORDER BY ... LIMIT`):
  prioridade pelas formas e escolas de `preferencias`, depois a língua de quem lê
  (`?lingua=` ou a dos poemas da pessoa), depois os mais recentes. Na primeira
  rodada, só os que a pessoa nunca viu (nem nesta sessão, nem em outra); quando
  acabam, a fila recicla do topo, com todos. **`FeedPage` ganhou `fim_em: int |
  None`** (aditivo): a posição, nesta página, onde acabou o primeiro trecho; o
  front põe ali a folha "você leu tudo de quem segue" (Seguindo) ou "você está em
  dia" (Para você). Só na página da virada; `null` nas outras e no perfil.
  **`subiu_por` ganhou `"curtidas"` e `"releitura"`**: o mais curtido e o
  consagrado reciclado, os únicos itens que podem repetir. Com cursor, a página
  enche passando de um trecho para o seguinte; por offset, vale só o primeiro
  trecho (com o `total` dele), e no fim o `proximo_cursor` já aponta o seguinte.
  O cursor leva o trecho (marca `pv` ou `mais` na frente; sem marca, o primeiro
  trecho da aba, e os cursores de antes continuam valendo). O `GET /feed` aceita
  também `?lingua=` para o "Para você" que vem depois.
- **Já visto entre sessões** (`services/vistos_no_feed.py`): tabela nova
  `vistos_no_feed` (`user_id`, `tipo` "poema"|"renga", `alvo_id`, `visto_em`;
  chave primária nos três primeiros, o único índice). `POST /feed/vistos` 🔒
  `{"itens": [{"tipo": "poema", "id": 12}, ...]}` (1 a 100; 204; repetido não
  duplica, só atualiza o `visto_em`) recebe as folhas que apareceram na tela; o
  front manda em lotes. O "Para você" inédito e a primeira rodada dos
  consagrados pulam esses itens; o trecho de quem a pessoa segue, não. No "Para
  você", o item já visto volta quando a atividade que o sobe (repost, comentário,
  estrofe) é posterior ao `visto_em`.
- O feed inclui os próprios poemas. Pode curtir o próprio poema.
- Rengas como reposts: uma renga entra no feed de quem segue o criador ou
  alguém que escreveu estrofe (e no de quem participou), uma vez só, na
  atividade mais recente de um seguido. As atividades são as estrofes e o
  encerramento pelo criador (`encerrada_em`); fechar pelo limite não é
  encerramento. O rótulo é o da atividade mais recente: estrofe do criador →
  `"abriu"` (o criador aparece sempre como quem abriu), estrofe de outra
  pessoa → `"escreveu"` com todos os seguidos que escreveram (menos o
  criador), quem escreveu por último primeiro, e encerramento → `"encerrou"`.
  Fechada, continua no feed. No perfil, a renga aparece na estrofe mais
  recente da pessoa (o encerramento não conta).
- **Repost de renga (#171):** o repost de um seguido (ou do próprio usuário) é
  mais uma atividade da renga, `"repostou"`, com `por` = todos os seguidos que
  repostaram, quem repostou por último primeiro (como o `repostado_por`). Também
  no perfil de quem repostou e no "Para você".
- Desempate do cursor: a posição é (data, chave), com chave = 4·id + 3 para
  repost de renga, 4·id + 2 para post, 4·id + 1 para estrofe e 4·id (id da
  renga) para encerramento; o cursor continua opaco (os de antes de #171 deixam
  de valer).
- **Sem repetidos na sessão de leitura:** o cursor do feed (Seguindo, "Para
  você" e posts do perfil) carrega, além da posição, o conjunto dos poemas e
  rengas que a sessão já recebeu (`core/vistos.py`: ids por tipo, em diferenças,
  zlib e base64 de URL; umas 25 páginas cabem em poucas centenas de
  caracteres). As páginas seguintes pulam esses itens, então o que saiu numa
  página não volta, nem quando a atividade que o subiu some no meio da leitura
  (repost desfeito, comentário apagado, renga do "Para você" que fecha). O
  cursor de antes, só com a posição, continua aceito (sem nada visto). O
  `FeedPage` não mudou. No front, `juntarAoFeed` (`lib/api.ts`) deduplica pelo
  poema ou renga mostrados (repost puro = o original), fica a primeira
  ocorrência e soma quem repostou no rótulo dela.
- **Sessão de leitura do Início (só no front, `lib/sessaoDoFeed.ts`):** cada
  aba guarda os itens, o cursor e a folha onde a pessoa parou, num módulo
  espelhado no `sessionStorage` (por conta). Trocar de aba, ir a outra página e
  voltar, seguir alguém ou recarregar reabre na mesma folha; tocar em Início
  estando no Início recomeça as duas abas do topo. Uma vez só entre as abas:
  o poema ou renga fica com a aba em que a pessoa chegou na folha dele, e a
  outra aba o pula (o que só foi carregado adiantado não conta, para não
  esvaziar o "Para você"); página que vem toda filtrada puxa a próxima.

### Feed "Para você", onboarding e sugestões (dono: Neto)

- `GET /feed/para-voce` 🔒 → `FeedPage`, com a mesma paginação (cursor, ou
  offset com `total`) e os mesmos itens tipados do `GET /feed`, mas da rede
  inteira (seguidos ou não, inclusive os próprios): poemas e citações; reposts
  puros, como no X (o poema aparece uma vez, na data do repost mais recente, com
  `repostado_por`); reposts de renga, abertas ou fechadas, do mesmo jeito (#171:
  a renga na data do repost mais recente, rótulo `"repostou"`); rengas que não
  fecharam (na estrofe mais recente, com o rótulo `"abriu"`/`"escreveu"`); poemas de consagrados rareados (um por
  janela de 3 h: o mais recente na língua de quem vê, se a janela tiver algum,
  senão o mais recente de qualquer língua); e poemas que receberam comentário,
  que sobem na data do comentário mais recente. Cronológico pela atividade, sem ranking por
  engajamento; a mistura fica em `core/mistura.py`. O rótulo é o da atividade
  mais recente (repost → `repostado_por`; comentário → `comentado_por`).
- `GET /feed/para-voce?lingua=en` (opcional, ISO 639-1, 422 fora do padrão):
  a língua de quem vê, que o front manda com a do navegador. Sem ela, vale a
  mais frequente nos poemas da própria pessoa (a mesma regra de
  `GET /sugestoes`); sem nenhuma das duas, fica o mais recente de cada janela.
  A escolha depende só da janela e da língua da requisição, então o cursor é
  estável.
- `PoemaNoFeed` ganhou dois campos opcionais, só preenchidos no "Para você":
  `subiu_por: "comentario" | "critica" | "curtidas" | None` ("curtidas" só na
  continuação do feed infinito, nas duas abas) (crítica = comentário ancorado
  nos versos) e `comentado_por: list[UserOut]` (quem comentou, por último
  primeiro). No perfil e no trecho do Seguindo de quem a pessoa segue, vêm `null` e `[]`.
- Desempate do cursor do "Para você": 4·id + 3 para repost de renga, 4·id + 2
  para post (poema ou repost puro), 4·id + 1 para estrofe e 4·id para
  comentário (#171; os cursores de antes deixam de valer). O cursor também
  leva o que a sessão já viu, como no `GET /feed`.
- O bloco "Quem seguir" no meio do "Para você" é só do front (a cada 10 itens,
  3 perfis de `GET /sugestoes`): não é item do `FeedPage` e não mexe no cursor.
- Tabela `preferencias` (`user_id` PK, `escolas` JSON, `formas` JSON, `pais`,
  `uf`): `GET /preferencias` 🔒 e `PUT /preferencias` 🔒 (troca tudo; 422 para
  escola, forma, país ou UF fora das listas, ou UF sem `pais: "BR"`);
  `GET /preferencias/opcoes` 🔒 devolve o vocabulário: `escolas`
  (`[{codigo, rotulo}]`), `formas` (os códigos, na ordem de `FORMAS`),
  `formas_com_rotulo` (`[{codigo, rotulo}]`, na mesma ordem), `paises`, `ufs` e
  `limites` (`{username_min, username_max, senha_min, senha_max, nome_max,
  bio_max, avatar_url_max, poema_titulo_max, antologia_nome_max,
  antologia_descricao_max, renga_titulo_max, renga_limite_padrao,
  renga_limite_min, renga_limite_max, renga_convidados_max,
  oficina_max_caracteres, mensagem_max_caracteres}`, de `core/limites.py`). `ESCOLAS` (15 códigos) fica em `schemas/escola.py`;
  países (ISO 3166-1 alfa-2) e UFs em `schemas/regiao.py`.
- Os gostos são públicos (#181): `GET /usuarios/{username}/gostos` 🔒 devolve
  as preferências da pessoa no mesmo formato de `GET /preferencias` (só
  códigos; rótulos de `/preferencias/opcoes`), com o bloqueio dos poemas do
  perfil (404 para o bloqueado, vazio para quem bloqueou). O campo
  `mostrar_lugar` (padrão `true`) entra no `GET`/`PUT /preferencias` e fica na
  tabela nova `privacidade_dos_gostos` (`user_id` PK, `mostrar_lugar`; sem
  linha = `true`), sem coluna nova em `preferencias`. Com `false`, a rota dos
  gostos sai com `pais` e `uf` nulos para os outros; a própria pessoa vê tudo.
- Tabela `atributos_consagrado` (`user_id` PK, `escolas` JSON, `pais`): o
  importador grava os campos opcionais `escolas` e `pais` do JSON do consagrado
  (`docs/consagrados.md`).
- `GET /sugestoes?lingua=pt` 🔒 → página de `SugestaoOut` (o `PoetaDoAcervo` +
  `escolas`): contas com poema, menos a própria pessoa e quem ela segue, na
  ordem da nota de `core/pontuacao_sugestoes.py` (seguidores em log, escolas e
  formas em comum, mesma língua, mesmo país e mesmo estado, com pesos em
  constantes). `lingua` é a do navegador; sem ela, vale a dos poemas da pessoa.

### Rengas (dono: Neto)

Tabelas `rengas` (`criador_id`, `titulo`, `modo` `"aberta"` | `"convidados"`,
`limite`, `fechada_em`, `encerrada_em` (só no encerramento pelo criador),
`created_at`), `estrofes_renga` (`renga_id`,
`autor_id`, `posicao`, `texto`, unique (`renga_id`, `posicao`)) e
`convites_renga` (unique (`renga_id`, `user_id`)).

- `GET /rengas?situacao=aberta|fechada&minhas=true` 🔒 → `RengaPage` (`minhas`:
  só as que criei, em que escrevi ou para as quais fui convidado);
  `POST /rengas` 🔒
  (`titulo`, `primeira_estrofe`, `modo`, `limite` de 3 a 40, padrão 12,
  `convidados`) → 201 `RengaDetalhe`; `GET /rengas/{id}` 🔒.
- `POST /rengas/{id}/estrofes` 🔒: 403 para não convidado, 409 para renga
  fechada ou "não é a sua vez" (ninguém escreve duas seguidas).
- `POST /rengas/{id}/encerrar` 🔒 só o criador (idempotente) e
  `POST /rengas/{id}/convites` 🔒 só o criador, no modo convidados.
- `RengaDetalhe`: `RengaOut` (`autores` em ordem, `qtd_estrofes`, `fechada`)
  mais `estrofes`, `convidados`, `posso_escrever` e `motivo`.
- Qualquer pessoa logada lê qualquer renga; só os convidados escrevem nas de convidados.
- `RengaOut` ganhou `comentarios` (opcional, `0` por padrão): comentários e
  respostas da renga, marcadores incluídos, como o `comentarios` dos poemas.
- **Ações do poema na renga (#171), abertas ou fechadas:** `RengaOut` (e então
  `RengaDetalhe` e `RengaNoFeed.renga`) ganhou `curtidas`, `reposts` (reposts
  puros + poemas que citam a renga, como no `PostOut`), `curti` e `repostei`
  (opcionais, `0`/`false`). `POST`/`DELETE /rengas/{id}/curtir` 🔒 e
  `POST`/`DELETE /rengas/{id}/repostar` 🔒 → 204, idempotentes, nas tabelas
  novas `curtidas_renga` e `reposts_renga` (`user_id`, `renga_id`, `created_at`,
  unique no par). Bloqueio com o criador: 404 para quem ele bloqueou, 403 para
  quem o bloqueou (como no poema). Pode repostar a própria renga, como o poema.
  Citar, guardar e enviar: ver Post, Antologias e Mensagens.

#### Comentários e crítica ancorada nas rengas

Tabela **nova** `comentarios_renga` (nenhuma coluna em tabela existente: o
`create_all` do deploy a cria no próximo boot): `id`, `renga_id` (FK
`rengas.id`), `autor_id`, `texto`, `parent_id` (FK `comentarios_renga.id` \|
None), `verso_inicio` e `verso_fim` (os dois ou nenhum, só no 1º nível),
`removido`, `created_at`; índice (`renga_id`, `parent_id`, `created_at`, `id`).

- Os versos são as linhas do **texto da renga**: as estrofes em ordem, unidas
  por `"\n\n"` (uma linha em branco entre elas, que conta na linha da âncora mas
  não no número que o leitor vê), base 1 (`services/rengas.texto_de`,
  `textoDaRenga` no front), como nos poemas (ver Crítica ancorada). Estrofe só se
  acrescenta no fim e não se edita, apaga nem reordena: o número de um verso já
  escrito não muda quando a renga aberta cresce.
- `POST /rengas/{id}/comentarios` 🔒, body `ComentarioCreate` (`texto`,
  `parent_id`, `ancora`) → 201 `ComentarioRengaOut` (o `ComentarioOut` com
  `renga_id` no lugar de `post_id`). Mesmas regras dos poemas: âncora só no 1º
  nível, intervalo dentro do texto atual da renga, começando e terminando em
  linha com texto (senão 422); pai de outra renga, inexistente ou removido → 404. Vale para
  rengas abertas e fechadas, e qualquer pessoa logada que lê a renga comenta
  (também nas de convidados).
- `GET /rengas/{id}/comentarios?limit=&cursor=&verso=` 🔒 →
  `ComentarioRengaPage`; `GET /rengas/{id}/comentarios/versos` 🔒 →
  `VersosComentadosOut`; `GET /rengas/{id}/comentarios/{cid}/respostas` 🔒.
- `DELETE /rengas/{id}/comentarios/{cid}` 🔒 só o autor do comentário (nem o
  criador da renga apaga o dos outros) → `ComentarioApagadoOut`, com o marcador
  "comentário removido" quando há respostas.
- Bloqueio: vale o criador da renga, como na leitura dela (404 para quem ele
  bloqueou, 403 para comentar quem o bloqueou; os comentários de quem tem
  bloqueio com o criador ficam escondidos para todos, como nos poemas).
- A paginação em árvore, a prévia e o apagar são comuns aos dois alvos
  (`services/arvore_de_comentarios.py`); as rotas dos comentários de poema não
  mudaram.
- Front: `/rengas/{id}?versos=2-4` abre a renga com os versos selecionados e o
  campo de comentário focado, destino de "comentar estes versos" no `RengaCard`;
  "citar estes versos" abre `/escrever?citar_renga={id}&versos=` (#171).

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

**Linha e número do verso.** A API (âncora, `?verso=`, `comentarios/versos`)
conta linhas, como o banco. O número que o leitor vê conta **só os versos**,
em sequência (1 a 6 num poema de seis versos em duas estrofes): linha em branco,
vazia ou só com espaços, separa estrofes e não se numera. A tradução de uma
contagem na outra é `core/versos.py` no backend e `numerosDosVersos` em
`lib/api.ts`; vale na tela, no `?versos=` das URLs e no aviso de crítica
(`AvisoOut.verso_inicio`/`verso_fim` já vêm nos números exibidos). As âncoras
gravadas antes disso não mudam (não há migração).

- `ComentarioCreate` ganhou `ancora: {"verso_inicio", "verso_fim"} | null`
  (opcional). Só no 1º nível: com `parent_id` → 422. Início depois do fim, fora
  do poema, ou início ou fim numa linha em branco (vazia ou só com espaços) → 422. Num repost puro, vale o texto
  do original.
- `ComentarioOut` ganhou `ancora: {"verso_inicio", "verso_fim", "trecho"} | null`
  (opcional; `null` nos comentários sem âncora e nas respostas). O marcador
  "comentário removido" continua com a âncora.
- `GET /posts/{id}/comentarios?verso=N` 🔒 → só as raízes cuja âncora cobre o
  verso N, na mesma paginação por cursor.
- `GET /posts/{id}/comentarios/versos` 🔒 → `{"items": [{"verso", "comentarios"}]}`:
  quantos comentários cobrem cada verso (uma crítica de 5–8 conta nos quatro).
- Apagar o comentário (sem respostas) ou o poema apaga a âncora junto.
- Front: `/poema/{id}?versos=2-4` (ou `?versos=3`), nos números que o leitor
  vê, abre o poema com esses versos selecionados e o campo de comentário focado; é o destino de "comentar
  estes versos" na barra que aparece ao selecionar o corpo de um poema em
  qualquer card. Valor fora do poema, invertido ou malformado é ignorado.

### Curtidas e reposts (dono: Henrique)

`POST`/`DELETE /posts/{id}/curtir` 🔒 e `POST`/`DELETE /posts/{id}/repostar` 🔒
→ 204, idempotentes. As da renga (#171) estão em Rengas.

**Repercussão na página da publicação** (`services/repercussao.py`):
`GET /posts/{id}/curtidas` 🔒 e `GET /posts/{id}/reposts` 🔒 → página de
`UserOut` (quem curtiu; quem fez repost puro), e `GET /posts/{id}/citacoes` 🔒
→ `PostPage` das citações; as mesmas três em `/rengas/{id}` (as citações da
renga são os poemas de `citacoes_renga`). Tudo da ação mais recente para a mais
antiga, com `offset`/`limit`. Repost puro mostra a do original; 404 se o autor
(na renga, o criador) bloqueou quem vê; quem tem bloqueio com quem vê fica fora
das listas, como nos seguidores.

### Antologias (dono: Pedro)

Tabelas `antologias` (`dono_id`, `nome` (100), `descricao`, `publica`,
`created_at`) e `antologia_poemas` (`antologia_id`, `post_id`, `posicao`,
`created_at`, unique no par).

- `POST /antologias` 🔒 → 201 `AntologiaOut` (`id`, `dono_id`, `dono`, `nome`,
  `descricao`, `publica`, `created_at`, `qtd`).
- `GET /antologias` 🔒 → as minhas; com `?post_id=`, cada item traz
  `contem: bool` (o poema está nela?).
- `GET /antologias/publicas` 🔒 → as públicas de todo mundo com ao menos um
  poema, a mais nova primeiro, sem as de quem tem bloqueio com o usuário: a aba
  Antologias do Explorar.
- `GET /usuarios/{username}/antologias` 🔒 → as públicas da pessoa (as
  privadas só aparecem para o próprio dono).
- `GET /antologias/{id}` 🔒 → `AntologiaDetalhe` (`poemas: list[PostOut]` na
  ordem de inserção). `PATCH` e `DELETE /antologias/{id}` 🔒.
- `POST /antologias/{id}/poemas`, body `{"post_id"}`, e
  `DELETE /antologias/{id}/poemas/{post_id}` 🔒 → 204; adicionar de novo não
  duplica.
- **Rengas nas antologias (#171):** tabela nova `antologia_rengas`
  (`antologia_id`, `renga_id`, `posicao`, `created_at`, unique no par; a
  `posicao` continua a numeração dos poemas). `POST /antologias/{id}/rengas`,
  body `{"renga_id"}`, e `DELETE /antologias/{id}/rengas/{renga_id}` 🔒 → 204,
  idempotentes; `GET /antologias?renga_id=` marca `contem` (com `post_id` junto →
  422). `AntologiaDetalhe` ganhou `rengas: list[RengaDetalhe]` e `ordem:
  [{"tipo": "poema" | "renga", "id"}]`, os dois juntos na ordem em que foram
  guardados (a tela e o índice intercalam por ela); `qtd` conta poemas e rengas,
  e `GET /antologias/publicas` aceita a antologia só com rengas. No cartão
  (`GET /cartoes/antologia/{id}`), `qtd` conta os dois e `poemas` traz as rengas
  na mesma ordem, como `{"titulo": <título da renga>, "primeiro_verso": "",
  "autor": <criador>}`.
- Privada de outra pessoa → 404 (não revela que existe); escrita de quem não é
  o dono → 403.

### Tags, Explorar, Em alta e Poema do dia (dono: Neto)

- `GET /tags/{tag}/posts` 🔒 → página, mais novo primeiro. A tag é normalizada
  (casefold e sem acento: `#Solidão` = `#solidao`).
- `GET /tags/trending?limit=` 🔒 → `{"items": [{"tag", "contagem", "trecho"}]}`:
  top `limit` (1 a 10, padrão 5) das últimas 24 h (contagem de poemas, sem
  curtidas). `trecho` (opcional, pode ser `null`) é o primeiro verso com texto
  que não seja só `#tags` (olhando o texto sem as marcas de formatação; a linha
  volta com elas), sem `strip()`, de um poema diferente por tag: o mais
  novo da tag que ainda não apareceu numa tag acima (se todos já apareceram, o
  mais novo mesmo).
- `GET /tags/busca?q=` 🔒 → `{"items": [{"tag", "poemas"}]}`: até 5 tags que
  começam pelo termo normalizado (`#Saú` acha `saudade`), mais poemas primeiro;
  termo vazio → lista vazia. A busca de poetas do Explorar usa
  `GET /acervo?q=&sigo_primeiro=true`.
- `GET /explorar?tag=&forma=` 🔒 → página de poemas de todos, sem reposts
  puros; `tag` e `forma` juntos fazem interseção; forma fora de `FORMAS` → 422.
- `GET /poemas/do-dia` 🔒 → `PostOut`: um poema de consagrado, o mesmo para
  todos no mesmo dia UTC (sha256 da data módulo a quantidade, por id); sem
  consagrados → 404.

### Acervo (dono: Neto)

- `GET /acervo` 🔒, com `tipo` (`todos` \| `consagrados` \| `do_verso`), `q`
  (nome ou @username, sem diferença de acento), `lingua` (ISO 639-1), `epoca`
  (`antiguidade`, `idade_media`, `xvi` … `xx`, pelo ano de morte), `ordem`
  (`alfabetica` \| `seguidos` \| `poemas`), `sigo_primeiro` (opcional: quem eu
  sigo vem antes, na ordem escolhida), `offset` e `limit` (padrão 24) →
  `AcervoPage` de `PoetaDoAcervo` (`UserOut` + `seguidores`, `poemas`, `sigo`).
- `GET /acervo/filtros` 🔒, com `tipo`, `lingua` e `epoca` opcionais (os mesmos do
  `GET /acervo`) → `{"linguas": [{"codigo", "poetas"}],
  "epocas": [{"chave", "rotulo", "inicio", "fim", "poetas"}]}`. Busca facetada:
  cada opção conta os consagrados que passam pelos outros filtros, menos o dela
  (as línguas contam com o tipo e a época; as épocas, com o tipo e a língua), e
  `tipo=do_verso` zera tudo. A lista de línguas é sempre a mesma, na ordem do
  acervo inteiro, com 0 onde não há poeta. O `q` não entra na conta.
- A tela do Acervo é a aba "Poetas" do Explorar (`components/Acervo.tsx`),
  com os filtros na URL: `/explorar?aba=poetas&tipo=&q=&lingua=&epoca=&ordem=&pagina=`
  (`lerFiltrosDoAcervo` e `caminhoDoAcervo` em `lib/api.ts`). Nessa aba, o
  campo do topo do Explorar (`BuscaDosPoetas`) é a busca pelo nome, o `q`. A
  rota antiga `/acervo` e o `?aba=acervo` redirecionam para a aba levando os
  filtros e a página, e a tela Poetas de antes (`/usuarios`) também leva a
  ela (decisões 12 e 17). `GET /usuarios`
  (lista paginada, sem login) continua na API.

### Tradução (dono: Neto)

- O `texto` traduzido mantém as marcas de formatação nos mesmos versos; se
  elas vêm quebradas (um `**` que não fecha) ou aparecem num poema sem marcas,
  a tradução é gravada sem formatação (#137).
- `POST /posts/{id}/traduzir` 🔒, body `{"para": "<ISO 639-1>"}` →
  `TraducaoOut` (`titulo`, `texto`, `idioma_origem`, `idioma_destino`,
  `modelo`, `em_cache`).
- Cache na tabela `traducoes`, único por (`post_id`, `idioma_destino`): o mesmo
  pedido não chama a API de novo. Repost puro traduz o original.
- Tela (`PoemaCard`, lógica em `lib/traducao.ts`): a tradução toma o lugar do
  título e do corpo, com "Traduzido do {língua} por IA · ver original"; "ver
  tradução" reaproveita a que já veio. Na página do poema, sem seleção de
  versos nem marcas de crítica enquanto a tradução está na tela, e a seleção
  feita antes de traduzir é limpa.
- 30 traduções novas por usuário por hora, contadas na tabela `traducoes`; as do
  cache não contam. Passou → 429. Já está na língua → 422. Sem
  `ANTHROPIC_API_KEY` → 503.

### Oficina do compositor (dono: Neto)

- `POST /oficina/analise`, sem login e sem banco, body `{"texto", "forma"?}`
  (`texto` até 10.000 caracteres; `forma` uma de `FORMAS`) →
  `{"versos": [{"silabas", "rima", "tipo_rima"}], "esquema", "aviso"}`, um item
  por linha de `texto.split("\n")`, medido sem as marcas de formatação. `tipo_rima` é `consoante`, `toante` ou
  `null`; `esquema` sai como `"ABBA ABBA CDC DCD"`; `aviso` só para soneto
  (14 versos) e haicai (3 versos de 5-7-5 sílabas poéticas).
- Algoritmo em `core/metrica.py`. Só o compositor usa: o `Post` não muda.

### Rascunhos (dono: Neto, #73)

Tabela nova `rascunhos`: `autor_id`, `titulo`, `texto`, `forma`, `idioma`,
`repost_de_id` (FK `posts.id` \| None: rascunho de citação), `repost_removido`,
`created_at` e `updated_at`. Fica fora de `posts`, então rascunho não entra em
feed, perfil, Explorar, tags, índice, Em alta, antologias nem nas contagens.

- Só o autor vê: de outra pessoa, toda rota dá 404 (não revela que existe).
- `GET /rascunhos` 🔒 → página de `RascunhoOut`, o editado por último primeiro,
  sem limite de quantidade.
- `POST /rascunhos` 🔒 → 201, com as regras do `PostCreate` (texto em branco →
  422). Com `repost_de_id`, é rascunho de citação (repost puro aponta para o
  original; inexistente → 404).
- `GET`/`PATCH`/`DELETE /rascunhos/{id}` 🔒. O `PATCH` é parcial (`titulo`,
  `texto`, `forma`, `idioma`); o poema citado não muda.
- `POST /rascunhos/{id}/publicar` 🔒 → 201 `PostOut`: cria o poema (ou a
  citação) pelo mesmo `posts.criar`, com data de agora e tags indexadas, e
  apaga o rascunho na mesma transação.
- Original apagado com a citação ainda em rascunho: como na citação publicada,
  o rascunho fica com `repost_de_id: null` e `repost_removido: true`, e
  publicado mostra "poema removido pelo autor".

### Mensagens diretas (dono: Neto, #135)

Tabelas novas (nenhuma coluna em tabela existente): `conversas` (`menor_id`,
`maior_id`, unique no par: uma conversa por par), `participantes_conversa`
(PK `conversa_id` + `user_id`; `situacao` `"caixa"` | `"pedido"` | `"recusada"`,
`ultima_lida_id`, `ultima_mensagem_id`, `silenciada`; índice
`(user_id, situacao, ultima_mensagem_id)`), `mensagens` (`conversa_id`,
`autor_id`, `texto` como veio, `post_id` opcional, `post_removido`,
`created_at`; índices `(conversa_id, id)` e `(autor_id, created_at)`) e
`bloqueios` (unique `(bloqueador_id, bloqueado_id)`).

- `POST /mensagens/conversas` 🔒 `{"username"}` → `ConversaDetalhe`: abre ou
  acha a conversa. Para si mesmo ou para consagrado → 422; quem bloqueou você
  → 403; inexistente → 404. Para o outro, a conversa cai em `"caixa"` se ele
  segue quem abriu, senão em `"pedido"`. Abrir de novo uma recusada a traz de
  volta para quem recusou.
- `GET /mensagens/conversas?aba=conversas|pedidos&cursor=&limit=` 🔒 →
  `CaixaPage` `{"items", "limit", "proximo_cursor"}` de `ConversaOut` (`id`,
  `outro: UserOut`, `situacao`, `silenciada`, `ultima_mensagem: MensagemOut |
  null`, `nao_lidas`), pela última mensagem, a mais recente primeiro. Conversa
  sem mensagem não aparece; recusada não aparece em nenhuma aba.
- `GET /mensagens/resumo` 🔒 → `{"nao_lidas", "pedidos"}`: conversas da caixa
  com não lidas (sem as silenciadas) e pedidos com não lidas.
- `GET /mensagens/conversas/{id}` 🔒 → `ConversaDetalhe` (`id`, `outro`,
  `situacao`, `silenciada`, `bloqueei`, `pode_responder`, `motivo`,
  `ultima_lida_id`, `visto_ate`; `visto_ate` é `null` enquanto a conversa é um
  pedido para o outro).
- `GET /mensagens/conversas/{id}/mensagens?antes=|depois=&limit=` 🔒 →
  `MensagemPage` `{"items", "limit", "proximo_cursor"}`, sempre da mais antiga
  para a mais nova. Sem `depois`, a janela mais recente (ou antes de `antes`), e
  `proximo_cursor` é o próximo `antes`; com `depois`, as seguintes, e
  `proximo_cursor` é o próximo `depois`. Os dois juntos → 422.
- `POST /mensagens/conversas/{id}/mensagens` 🔒 `{"texto", "post_id"}` → 201
  `MensagemOut` (`id`, `conversa_id`, `autor_id`, `texto`, `post: PostOut |
  null`, `post_removido`, `created_at`). Texto em branco sem poema ou acima de
  `MENSAGEM_MAX_CARACTERES` (10.000, `core/limites.py`) → 422; mais de `MENSAGENS_POR_MINUTO` (30)
  da mesma pessoa no último minuto → 429; bloqueio em qualquer direção → 403.
  Repost puro compartilha o original. Mandar marca como lido até ali e aceita
  um pedido. Apagar o poema deixa a mensagem com `post_removido: true`.
- **Renga na mensagem (#171):** `MensagemCreate` aceita `renga_id` (com
  `post_id` junto → 422; só a renga, sem texto, vale), na tabela nova
  `mensagens_renga` (`mensagem_id` PK, `renga_id`). `MensagemOut` ganhou
  `renga: RengaDetalhe | None`. Bloqueio com o criador como em curtir.
- `POST /mensagens/conversas/{id}/lida` 🔒 `{"ate"}` (opcional) → 204; nunca
  volta para trás.
- `POST /mensagens/conversas/{id}/aceitar` e `/recusar` 🔒 → 204 (recusar uma
  conversa da caixa → 409); `POST`/`DELETE /mensagens/conversas/{id}/silenciar`
  🔒 → 204.
- **Bloqueio na rede inteira** (`services/bloqueios.py`):
  `POST`/`DELETE /usuarios/{username}/bloqueio` 🔒 → 204, idempotentes;
  `GET /usuarios/{username}/bloqueio` 🔒 → `{"bloqueei"}` (404 se a pessoa me
  bloqueou). Bloquear apaga os follows nos dois sentidos. Para quem foi
  bloqueado, o perfil (`GET /usuarios/{u}`, `/posts` e `/antologias`), os poemas
  (`GET /posts/{id}`) e as rengas (`GET /rengas/{id}`) de quem bloqueou dão 404.
  Curtir, comentar, repostar, citar, escrever estrofe, seguir e mandar o poema
  por mensagem entre os dois: 404 para o bloqueado, 403 para quem bloqueou.
  `GET /feed`, `/feed/para-voce`, `/tags/{tag}/posts`, `/explorar`, `/rengas`,
  `/antologias/publicas` e
  Para quem bloqueou, `GET /usuarios/{u}/posts` e `/antologias` do bloqueado
  vêm vazios (o cabeçalho `GET /usuarios/{u}` continua, para desbloquear).
  `/sugestoes`, `/acervo` e `/usuarios/{u}/seguidores` e `/seguindo` tiram,
  para os dois, o outro e os poemas, as rengas e as atividades (reposts,
  estrofes, comentários) dele; as listas de quem me bloqueou dão 404. Convidar
  para renga quem tem bloqueio com o criador → 422. Os comentários de quem tem
  bloqueio com o autor do poema ficam escondidos para todos na leitura
  (`GET /posts/{id}/comentarios`, `/comentarios/versos`,
  `/comentarios/{id}/respostas`): com respostas, saem como o marcador
  `removido` (sem âncora); sem, somem das páginas, dos totais e das marcas dos
  versos; para quem o autor bloqueou, essas rotas dão 404. `PostOut` ganhou
  `repost_indisponivel` (opcional, `false` por padrão): a citação de um poema
  de quem bloqueou quem vê vem com `repost_de: null` e `repost_indisponivel:
  true`. As assinaturas dos services de rengas (`listar`), follows (listas) e
  comentários (leitura) passaram a receber o usuário. Índices: o par único
  `(bloqueador_id, bloqueado_id)` e `(bloqueado_id, bloqueador_id)`.
- Quem não participa recebe 404 em toda rota da conversa.
- `GET /mensagens/stream` 🔒 → `text/event-stream`: `pronto` ao abrir; depois
  `mensagem` e `pedido` (`conversa_id`, `mensagem_id`), `lida` (`conversa_id`,
  `leitor_id`, `ultima_lida_id`), `conversa` (`conversa_id`: mudou a situação,
  o silêncio) e `ressincronizar`; um comentário `: batida` a cada 20 s. Sem
  gzip. O fan-out entre workers é por Postgres `LISTEN/NOTIFY`
  (`app/tempo_real.py`).
  O mesmo stream traz o evento `aviso` (sem dados), dos avisos abaixo.

### Avisos (dono: Neto, decisão 16)

Tabela nova (nenhuma coluna em tabela existente): `avisos` (`destinatario_id`,
`tipo`, `ator_id`, `post_id`, `renga_id`, `comentario_id`, `estrofe_id`,
`lido`, `created_at`; índices `(destinatario_id, created_at, id)` e
`(destinatario_id, lido)`). Uma linha por ação, gravada na mesma transação da
ação, para cada destinatário; nunca para quem agiu, para conta sem login
(consagrado) ou para quem tem bloqueio com quem agiu ou com o dono do alvo.

| `tipo` | Quem recebe | Alvo |
|---|---|---|
| `curtida`, `repost` | o autor do poema (repost puro: o do original); na renga (#171), todos os autores de estrofe | `post_id` do poema ou `renga_id` |
| `citacao` | o autor do citado; na renga (#171), todos os autores de estrofe | `post_id` da citação (e `renga_id` da renga citada) |
| `seguidor` | quem foi seguido | (o ator) |
| `comentario`, `critica` (com âncora) | o autor do poema; na renga, o criador e todos os autores de estrofe (`critica`: só os das estrofes que os versos tocam) | `post_id` ou `renga_id`, `comentario_id` |
| `resposta` | o autor do comentário respondido (e `comentario` ao autor do poema ou ao criador da renga) | idem |
| `estrofe` | o criador e quem já escreveu na renga | `renga_id`, `estrofe_id` |
| `convite` | os convidados (ao criar e em `POST /rengas/{id}/convites`) | `renga_id` |

Desfazer apaga o aviso: descurtir, desfazer o repost, deixar de seguir, apagar o
comentário (também quando vira o marcador) e apagar o poema (os avisos que
apontam para ele e para os reposts puros dele).

- `GET /avisos?cursor=&limit=` 🔒 → `AvisoPage` `{"items", "limit",
  "proximo_cursor"}` de `AvisoOut` (`id`, `tipo`, `created_at`, `lido`,
  `atores: UserOut[]` (os 2 mais recentes), `total_atores`, `post_id`,
  `renga_id`, `comentario_id`, `titulo`, `trecho`, `verso_inicio`,
  `verso_fim`). Curtidas do mesmo poema (ou da mesma renga) no mesmo dia (de
  Brasília) saem numa linha, e reposts também; a linha vale pelo aviso mais recente (`id`, `created_at`), e `lido` só é `true`
  se todos foram lidos. A mais recente primeiro. Os avisos de quem tem bloqueio
  com quem lê ficam fora (bloqueio feito depois). Cursor malformado → 422.
- `GET /avisos/resumo` 🔒 → `{"nao_lidos"}`: linhas da tela com aviso não lido
  (as curtidas de hoje num poema contam 1).
- `POST /avisos/lidos` 🔒 `{"ate"}` (opcional) → 204: marca como lidos os
  avisos até o id `ate` (sem ele, todos) e manda `aviso` às outras abas.

### Cartão de compartilhamento (dono: Neto, #160)

Leituras **sem login**, só com o mínimo do cartão do link (imagem Open Graph e
metadados, `frontend/lib/cartaoServidor.tsx`). As rotas de sempre continuam 🔒.
Todas com `Cache-Control: public, max-age=300` no 200; nada de curtidas,
comentários, seguidores nem dado de quem pede. `versos` são as 12 primeiras
linhas sem marcas de formatação, a partir do primeiro verso não vazio, e
`continua` diz se o texto segue. `autor` = `{"username", "name", "consagrado",
"nascimento", "morte"}`.

- `GET /cartoes/poema/{id}` → `{"id", "titulo", "versos", "continua", "idioma",
  "autor"}`. Repost puro → o original; poema apagado ou inexistente → 404
  (rascunho não é post: nunca aparece).
- `GET /cartoes/usuario/{username}` → `autor` + `{"bio", "avatar_url",
  "poemas"}`; usuário inexistente → 404.
- `GET /cartoes/renga/{id}` → `{"id", "titulo", "autores", "versos",
  "continua"}`, aberta ou de convidados (o modo diz quem escreve, não quem lê).
- `GET /cartoes/antologia/{id}` → `{"id", "nome", "descricao", "dono", "qtd",
  "poemas": [{"titulo", "primeiro_verso", "autor"}]}` (os 4 primeiros);
  privada → 404 para todo mundo.

### Dicas do livro (tour aos poucos)

Tabela `dicas_vistas` (`user_id`, `dica`, PK composta, `created_at`): as dicas
do primeiro uso que a pessoa já viu, na conta (valem em qualquer aparelho).
`DICAS` (`schemas/dica.py`): `virar_pagina`, `acoes`, `lombada`, `escrever`,
nessa ordem.

- `GET /dicas` 🔒 → `{"vistas": [...]}`, na ordem de `DICAS`.
- `PUT /dicas/{dica}` 🔒 → `{"vistas"}`: marca como vista, idempotente; dica
  fora de `DICAS` → 422.
- `DELETE /dicas` 🔒 → `{"vistas": []}`: o "rever as dicas" das Preferências.
- Quando cada uma aparece é só do front (`lib/dicas.ts`,
  `components/DicasDoLivro.tsx`).

### Auth e saúde

- `POST /auth/registro` → 201 `UserOut`; `POST /auth/login` → `{"token"}`
  (usuário inexistente, senha errada ou consagrado → o mesmo 401);
  `GET /auth/eu` 🔒; `POST /auth/logout` 🔒 → 204. Conta nova só nasce no
  registro: `POST /usuarios` e `GET /usuarios/stats` saíram (#64).
- `GET /saude` → `{"ok": true}`, sem login e sem tocar no banco (health check
  das réplicas no Compose e do Caddy; no Render, o `healthCheckPath`).

### Gancho do índice de tags (Neto ↔ Henrique)

O índice mora na tabela `post_tags (post_id, tag, criado_em)`, e
`backend/app/services/indice_tags.py` o lê e escreve (a lógica pura fica em
`core/indice_tags.py`: `extrair_tags`, `normalizar`, `top_k`, `representantes`):

```python
indice_tags.indexar(db, post: Post) -> None            # sem commit: na transação de quem publica
indice_tags.remover(db, post_ids: list[int]) -> None   # idem, ao apagar
indice_tags.posts_da_tag(db, tag, offset, limit) -> tuple[list[int], int]  # (página, total)
indice_tags.trending(db, desde: datetime, k: int = 5) -> list[tuple[str, int]]
indice_tags.representantes(db, tags: list[str]) -> dict[str, int | None]  # um poema por tag
indice_tags.buscar(db, prefixo: str, k: int = 5) -> list[tuple[str, int]]  # (tag, poemas)
indice_tags.popular(db) -> int                         # refaz tudo a partir de posts
```

O `services/posts.py` chama `indexar` ao criar (também ao publicar um
rascunho) e `remover` ao apagar, antes do mesmo commit; o importador de
consagrados e o seed também. Nada é reconstruído no startup.

### Componentes do front

- `components/Layout`, `Nav`, `MenuConta` e o tema (serifada para poemas):
  **Pedro**.
- `components/PoemaCard.tsx`, `Compositor.tsx` e `ArvoreComentarios.tsx`:
  **Henrique**. Os outros reusam o card, sem copiá-lo.
- `components/ColunaDireita.tsx` (Descobrir), `Acervo.tsx` (a aba Poetas do
  Explorar), `CartaoDoAcervo.tsx` e as páginas `explorar/` e `acervo/` (só o
  redirecionamento): **Neto**.
- `components/EnviarPorMensagem.tsx` (no `PoemaCard`), o item "Mensagens" do
  `Nav` e as páginas `mensagens/`: **Neto** (#135).
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
| N4 | Seed fake do nicho: mais de 20 poetas fictícios de vários lugares e idades (alguns universitários), mais de 50 poemas originais, follows (inclusive a consagrados), curtidas, comentários em árvore, reposts e citações; `seed_fake(db)` e `make seed` também importa os consagrados | todos os models (H1, H3, H4, H5, N1, P5) | N5 | concluída |
| N5 | Deploy: VM da Oracle (Caddy, réplicas da API **sem DEBUG**, Postgres 16 e backup) + Vercel (front), CORS com a URL pública. O plano era Render + Vercel + Supabase, que ficou como alternativa (`docs/deploy.md`) | N4 | bônus +10 | concluída (#19) |
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
  cada restart no Render; no fim, a API e o Postgres rodam numa VM Always Free
  da Oracle, que não hiberna, os dados persistem (com backup diário no Object
  Storage) e o seed só roda num banco sem usuários. O risco que fica é a VM
  inteira cair: o backup volta numa VM nova, com no máximo um dia de perda
  (decisão 15 do `DECISIONS.md`).
- **Direitos autorais.** Só autores mortos até 1955; o importador recusa
  `morte > 1955`.
- **Sem estado em memória.** O índice de tags (tabela `post_tags`) e o limite
  de tradução (contado em `traducoes`) moram no banco, para a API rodar com
  vários workers e instâncias (`core/README.md`). A `arvore_comentarios` é
  montada a cada request.
