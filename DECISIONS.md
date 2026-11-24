# Decisões do time

**Time:** Neto (@fermneto), Henrique (@hguimaa), Pedro (@CorreiaPedro208)

Este arquivo acompanha o projeto. Comecem com o que já sabem e atualizem quando
as decisões mudarem.

## Produto

Respondam antes de escolher features. O pitch sai daqui.

- **Público:** poetas iniciantes universitários (UFPB e outras) que escrevem,
  mas não têm onde publicar e ser lidos.
- **Problema:** no X o limite de caracteres quebra o poema; no Instagram o poema
  vira imagem e não dá para citar um verso; os feeds algorítmicos enterram texto
  longo. E o iniciante lê pouco os clássicos.
- **Como a rede resolve:** o poema é um post de verdade (título, corpo sem
  limite e com as quebras preservadas, forma), com conversa em árvore,
  repost/citação de versos e os poetas consagrados (domínio público) no mesmo feed.
- **Como saberíamos que funcionou:** o iniciante cita um verso de um consagrado
  ou de um colega e recebe respostas na árvore de comentários.

## Decisões de produto

Registrem de 3 a 5 escolhas que mudaram o que a rede é. Boas candidatas: por
que essas features e não outras, o que ficou de fora, como o seed e a interface
refletem o nicho. Uma delas vai para o vídeo.

### 1. O poema inteiro como unidade, não um post curto

- **Contexto:** o poeta iniciante escreve sonetos de 14 versos, poemas em
  verso livre de duas páginas e haicais de três linhas. No X o limite de
  caracteres obriga a cortar o poema em fio; no Instagram ele vira imagem e
  ninguém consegue copiar ou citar um verso. Em ambos, a quebra de linha, que
  faz parte do poema, se perde ou vira decoração.
- **Opções:** um post curto estilo tweet (texto livre com limite, como no
  template) ou um post que é um poema de verdade, com campos próprios.
- **Escolha:** o post é o poema: título opcional, corpo **sem limite de
  caracteres** com as quebras de linha e as estrofes preservadas (o backend
  nunca faz `strip()` linha a linha e o front renderiza com `whitespace-pre-wrap`
  em fonte serifada) e uma **forma** (soneto, haicai, trova, quadra, cordel,
  verso livre, prosa poética, outro). A forma também vira tag, então dá para
  achar todos os sonetos da rede.
- **O que cortamos e por quê:** o limite de caracteres e a ideia de "post
  rápido". Um feed de poemas inteiros rola mais devagar, e é isso que queremos:
  quem publica um poema quer ser lido até o fim, não passado em um segundo.

### 2. Consagrados só de domínio público, sem login, no mesmo feed

- **Contexto:** o iniciante lê pouco os clássicos e, quando lê, é numa
  antologia escolar, longe do que ele mesmo escreve. Queríamos que Augusto dos
  Anjos aparecesse no feed ao lado do poema do colega de Letras.
- **Opções:** uma biblioteca separada de clássicos; trechos citados sem autor
  "real" na rede; ou os poetas como contas de verdade.
- **Escolha:** os **consagrados** são usuários normais (podem ser seguidos,
  curtidos, comentados, repostados e citados), mas **sem login**
  (`password_hash = None`, login devolve 401) e com selo e anos de vida no
  perfil. Só entram autores **mortos até 1955**, que estão em domínio público
  no Brasil em 2026 (70 anos após a morte): Augusto dos Anjos, Olavo Bilac,
  Cruz e Sousa, Fernando Pessoa, Florbela Espanca e outros. O importador recusa
  `morte > 1955` e cada poema guarda a `fonte` (URL do Wikisource ou do
  Domínio Público). Seguir um consagrado é o jeito de trazer os clássicos para
  o próprio feed.
- **O que cortamos e por quê:** os modernos que o público mais conhece
  (Drummond, Manuel Bandeira, Cecília Meireles, Vinicius de Moraes). As obras
  deles ainda têm direitos autorais, e publicar os poemas inteiros seria
  infração, mesmo num projeto de curso. Preferimos um acervo menor e legal a um
  acervo famoso e irregular.

### 3. Feed cronológico dos seguidos; descoberta por formas e temas

- **Contexto:** feeds ranqueados por engajamento premiam o que é curto e
  chamativo e enterram texto longo, justamente o que um poema é. E o iniciante,
  com poucos seguidores, nunca chegaria ao topo de um "Em alta".
- **Opções:** feed ranqueado por curtidas ("Em alta"), feed cronológico, ou
  cronológico mais uma forma de descobrir poemas fora da bolha.
- **Escolha:** o `/feed` é **cronológico**, com os poemas (e reposts) de quem
  você segue e os seus. A descoberta é por **forma e tema**: `#tags` no corpo
  do poema (`#saudade`, `#chuva`) mais a forma viram tags clicáveis; a tela
  **Explorar** filtra por tag e por forma; e o **trending** mostra as tags mais
  usadas nas últimas 24 horas, ou seja, sobre o que a turma está escrevendo,
  não quem tem mais curtidas.
- **O que cortamos e por quê:** o "Em alta" e qualquer ranking por
  engajamento. Quem abre a rede quer ler o que os colegas escreveram hoje, e
  quem procura algo novo procura "um haicai sobre chuva", não "o post mais
  curtido da semana".

### 4. Citar um verso e conversar sobre o poema

- **Contexto:** o sinal de que a rede funciona é o iniciante citar um verso de
  um consagrado ou de um colega e receber respostas. Nas redes atuais, comentar
  um poema é deixar um "lindo!" numa lista solta, e citar um verso é tirar
  print.
- **Opções:** só curtidas e comentários planos (o mínimo do template); ou
  investir nos gestos de quem lê poesia: repostar, citar e discutir.
- **Escolha:** **repost** (puro, idempotente) e **citação** (um poema novo com
  `repost_de_id` e um texto, por exemplo um verso destacado com a resposta do
  leitor) são o gesto central. Os **comentários são em árvore**: dá para
  responder a uma crítica específica ("esse enjambement no verso 3 funciona?")
  e a crítica vira conversa, como numa oficina de poesia.
- **O que cortamos e por quê:** DMs, stories e enquetes. DM tira a crítica do
  lugar onde os outros aprendem com ela; stories somem em 24 horas, e poema é
  para ficar; enquete não serve a quem escreve. Cada uma custaria dias de um
  prazo de uma semana e não ajudaria nenhum poeta a escrever ou a ser lido.

## Features

Listem as features que o time vai construir, quem é o dono de cada uma e por
que ela entra no produto. A lista muda junto com o projeto: acrescentem e
tirem linhas quando mudarem de ideia.

| Feature | Dono | Por quê (1 frase) |
|---|---|---|
| Auth (núcleo) | Pedro | Consagrados existem como contas sem login; o resto entra com senha. |
| Posts/poemas (núcleo) | Henrique | Título, corpo sem limite e forma: o poema como unidade, não como tweet. |
| Feed (núcleo) | Henrique | Cronológico: o iniciante quer ver o que os colegas escreveram hoje. |
| Perfil (núcleo) | Pedro | Mostra o selo e os anos de vida dos consagrados. |
| Follow (núcleo) | Neto | Seguir um consagrado traz os clássicos para o feed. |
| Curtidas (núcleo) | Henrique | Feedback mínimo para quem está começando. |
| Comentários em árvore | Henrique | A crítica de poema vira conversa, não uma lista solta. |
| Seed fake (núcleo) | Neto | A demo abre com poetas universitários e poemas de verdade. |
| Consagrados (importador) | Neto | Os clássicos de domínio público convivem com os iniciantes. |
| Repost + citação | Henrique | Citar um verso é o gesto central de quem lê poesia. |
| Formas/temas (hashtags) | Neto | Descobrir sonetos, haicais e temas; trending do que se escreve. |
| Antologias | Pedro | O leitor monta coleções ("poemas de chuva"), como uma antologia de verdade. |
| Deploy | Neto | A banca usa a rede na URL pública. |

## Uma escolha técnica

### Índice invertido de tags em `core/indice_tags.py`

A descoberta por forma e tema (decisão 3) depende de responder rápido "quais
poemas têm `#saudade`?" e "sobre o que a turma está escrevendo?". Varrer todos
os poemas e procurar a tag no texto a cada request seria O(n·L), com L o
tamanho do poema, e poemas não têm limite. Por isso o `IndiceTags` guarda
duas estruturas em memória:

- `_por_tag: dict[str, dict[int, datetime]]`: tag → {post_id: criado_em}. É o
  índice invertido: a partir da tag, chega direto aos poemas.
- `_por_post: dict[int, tuple[frozenset[str], datetime]]`: post_id → (tags,
  criado_em). É o inverso, e existe por dois motivos: **editar** um poema
  precisa saber quais tags ele tinha para tirá-las antes de pôr as novas
  (`indexar` chama `remover` primeiro, e a tag antiga some), e **remover** um
  poema apagado precisa visitar só as tags dele, sem varrer todas as tags da
  rede. Com o inverso, as duas operações são O(t).

**Normalização.** Tags passam por `normalizar`: `casefold` e remoção de
acentos (NFKD sem os caracteres combinantes). Assim `#Solidão`, `#solidão` e
`#solidao` são a mesma tag, e a busca por "SOLIDÃO" acha todas. A forma do
poema (soneto, haicai...) entra como tag também.

**Big O** (como nas docstrings; t = tags do post, p = posts da tag, n = posts
indexados, m = tags distintas na janela):

| Operação | Custo | Quando roda |
|---|---|---|
| `indexar` / `remover` | O(t), lookups em hash | criar, editar, apagar poema |
| `posts_da_tag` | O(p log p), ordena na leitura (mais novo primeiro, empate pelo maior id) | `/tags/{tag}/posts`, Explorar |
| `trending` | O(n·t + m log k), heap de tamanho k via `heapq.nsmallest` | `/tags/trending` (janela de 24 h) |
| `reconstruir` | O(n·t) | só no startup (lifespan), porque a memória zera a cada restart |

O service (`services/tags.py`) recebe do índice só os ids na ordem certa,
recorta a página e só então vai ao banco buscar a fatia.

**Se a rede crescesse 100 vezes:**

- `posts_da_tag` deixaria de ordenar na leitura: cada tag guardaria a lista já
  ordenada por data (inserção ordenada na escrita), e a leitura de uma página
  ficaria O(limit) em vez de O(p log p).
- O índice sairia da memória do processo e iria para o banco: uma tabela
  `post_tags (tag, post_id, criado_em)` com índice em `(tag, criado_em)`. Isso
  resolve o restart sem reconstrução, funciona com vários workers e deixa o
  filtro tag + forma do Explorar virar um JOIN, em vez de um `IN` com todos os
  ids da tag.
- O trending deixaria de varrer todos os posts: uma janela deslizante (contagem
  por tag que soma quando um poema entra e subtrai quando ele sai da janela de
  24 h) deixaria a consulta em O(m log k), sem o termo n·t.

Ainda não medimos. O `make bench` (índice invertido contra varredura) é
opcional e não foi rodado; se rodarmos até a entrega, colamos a saída aqui.

## Uso de IA

- **Claude (Claude Code)** para planejar o projeto (o `PLANO.md`, os contratos
  de dados compartilhados e a divisão de tasks entre os três), revisar PRs e
  implementar partes das tasks de Dados do Neto: o índice de tags
  (`core/indice_tags.py`), o follow, as rotas de tags e do Explorar e a
  leitura dos JSONs dos consagrados. Todo código gerado passou por revisão
  humana no PR antes do merge.
- **Henrique e Pedro:** _(completar com a ferramenta e o uso de cada um)_
