# Decisões do time

**Time:** Neto (@fermneto), Henrique (@hguimaa), Pedro (@CorreiaPedro208)

O Verso é uma rede social de poemas. As decisões abaixo foram tomadas pelo
time, e o registro de cada uma está nos PRs, na seção "Decisões do Neto".

## Produto

- **Público:** poetas iniciantes universitários, principalmente da UFPB. São
  estudantes de Letras, mas também de Engenharia, Medicina, Computação e Direito,
  que escrevem no caderno ou no bloco de notas do celular e não têm onde
  publicar o poema inteiro e ser lidos por quem também escreve.
- **Problema:**
  - No X, o limite de caracteres obriga a partir um soneto em fio.
  - No Instagram, o poema vira imagem: não dá para copiar nem citar um verso, e
    o texto não aparece numa busca.
  - Feeds ranqueados por engajamento enterram texto longo, e um iniciante com
    poucos seguidores nunca é visto.
  - Além disso, o iniciante lê pouco os clássicos e quase nunca os lê ao lado
    do que ele mesmo escreve.
- **Como a rede resolve:**
  - O post é o poema: título opcional, corpo sem limite, com as quebras, as
    estrofes e os recuos preservados, e uma forma (soneto, haicai, cordel...).
  - O feed é cronológico, e a descoberta é por forma e por tema.
  - Os gestos de quem lê poesia são de primeira classe: citar um verso,
    repostar e conversar numa árvore de comentários, como numa oficina.
  - 95 poetas consagrados em domínio público (725 poemas, no original, em 15
    línguas) estão no mesmo feed, como contas que se seguem. A tradução por IA
    sai com um clique.
- **Como saberíamos que funcionou:** um iniciante cita um verso de um
  consagrado ou de um colega e recebe respostas na árvore de comentários. Isso
  dá para contar no banco: citações (`repost_de_id` com texto) que têm
  comentários de outra pessoa. Ainda não temos usuários reais, então não temos
  esse número.

## Decisões de produto

### 1. O poema inteiro como unidade, não um post curto

- **Contexto:** o iniciante escreve sonetos de 14 versos, poemas em verso
  livre de duas páginas e haicais de três linhas. A quebra de linha faz parte
  do poema, e o recuo também.
- **Opções:** um post curto com limite, como no template, ou um post que é um
  poema, com campos próprios.
- **Escolha:**
  - Título opcional, corpo **sem limite de caracteres** e uma **forma**
    opcional: soneto, haicai, trova, quadra, cordel, verso livre, prosa poética
    ou outro.
  - O texto é gravado como veio: o backend não faz `strip()` nas linhas, e o
    card renderiza com `white-space: pre-wrap` em Literata. No compositor, o Tab
    insere um recuo.
  - A forma vira tag (`#soneto`), menos `outro`, que juntaria poemas sem nada
    em comum.
  - No feed, um poema longo é cortado no fim da última estrofe que cabe em 20
    linhas, com "ler poema inteiro". Só a exibição é cortada.
- **O que cortamos e por quê:** o limite de caracteres e o "post rápido". Um
  feed de poemas inteiros rola mais devagar, e é isso que queremos: quem publica
  um poema quer ser lido até o fim.

### 2. Os consagrados no feed, no original e com tradução por IA

- **Contexto:** queríamos que Augusto dos Anjos aparecesse no feed ao lado do
  poema do colega de Letras, e não numa biblioteca à parte.
- **Opções:** uma biblioteca separada de clássicos; trechos soltos sem autor;
  ou os poetas como contas de verdade.
- **Escolha:**
  - **Contas normais, sem login.** Os consagrados podem ser seguidos,
    curtidos, comentados, repostados e citados, mas têm `password_hash = None`,
    e o login deles dá 401. Seguir um consagrado é o jeito de trazer os
    clássicos para o próprio feed.
  - **Selo próprio.** Um lacre de cera com uma pena (SVG desenhado para o
    Verso), com tooltip "Poeta consagrado · domínio público" e os anos de vida.
    No perfil, aparece a linha "Poeta consagrado · 1884–1914 · obra em domínio
    público".
  - **Só domínio público.** Só entram autores **mortos até 1955**, que estão em
    domínio público no Brasil em 2026 (70 anos após a morte). O importador
    recusa `morte > 1955`, e cada poema guarda a `fonte` (Wikisource ou
    Wikiquote).
  - **No original, em todas as línguas.** São 95 poetas em 15 línguas: Bilac e
    Florbela em português, Baudelaire em francês, Li Bai em chinês, Hafez em
    persa, Bashō em japonês. Os textos não foram editados: saíram só os poemas
    com defeito do scraper, e a única limpeza foi remover caracteres invisíveis
    e o TAB do início dos versos (#49).
  - **Tradução sob demanda por IA.** O botão "Traduzir" aparece quando a língua
    do poema é diferente da do navegador. Ele usa o Claude Haiku 5.5 e preserva
    o número de versos, de estrofes e os recuos. Cada tradução fica em cache
    por (poema, língua), e o mesmo pedido não chama a API de novo. Cada usuário
    pode pedir 30 traduções novas por hora (as do cache não contam). A tela
    mostra "Traduzido do {língua} por IA · ver original", e o original fica
    sempre visível.
- **O que cortamos e por quê:**
  - **Os modernos que o público mais conhece** (Drummond, Bandeira, Cecília,
    Vinicius). As obras deles ainda têm direitos autorais. Preferimos um acervo
    legal a um acervo famoso e irregular.
  - **Traduções humanas publicadas.** Elas têm direito de tradutor, e por isso
    o acervo fica no original. Uma tradução gerada na hora, marcada como IA,
    ajuda a ler o poema sem substituí-lo.
  - **A tradução ilimitada.** A URL pública é aberta, e cada tradução nova
    custa uma chamada paga. O cache e o limite por usuário seguram o custo.

### 3. Feed cronológico; descoberta por formas e temas

- **Contexto:** feeds ranqueados por engajamento premiam o que é curto e
  chamativo. O iniciante, com poucos seguidores, nunca chegaria ao topo.
- **Opções:** um feed ranqueado por curtidas, um feed cronológico, ou
  cronológico mais um jeito de descobrir poemas fora da bolha.
- **Escolha:**
  - **O feed é cronológico**, com os poemas de quem você segue e os seus.
  - **Reposts como no X.** Cada poema aparece uma vez, na posição do repost
    mais recente, com "repostado por" listando todos os seguidos que
    repostaram. A paginação é por cursor, então poemas novos não deslocam a
    rolagem.
  - **Descoberta por forma e tema.** As `#tags` do corpo e a forma viram tags
    clicáveis. O **Explorar** filtra por tag e por chips de forma (inclusive
    "outras formas"). A tag é normalizada, então `#Solidão` acha `#solidao`.
  - **"Em alta"** mostra as tags com mais poemas nas últimas 24 horas, ou seja,
    sobre o que a turma está escrevendo, e não quem tem mais curtidas.
  - **Poema do dia:** um poema de consagrado, o mesmo para todos no mesmo dia
    (o hash da data escolhe o poema).
- **O que cortamos e por quê:** qualquer ranking por engajamento ("mais
  curtidos da semana"). Quem abre a rede quer ler o que os colegas escreveram
  hoje, e quem procura algo novo procura "um haicai sobre chuva", não o post
  mais curtido.

### 4. Citar um verso e conversar sobre o poema

- **Contexto:** comentar um poema nas redes atuais é deixar um "lindo!" numa
  lista solta, e citar um verso é tirar print.
- **Opções:** só curtidas e comentários planos, ou investir nos gestos de quem
  lê poesia: repostar, citar e discutir.
- **Escolha:**
  - **Repost** (puro e idempotente) e **citação** (um poema novo que aponta
    para o original, por exemplo um verso destacado com a resposta do leitor).
    Se o original for apagado, a citação fica, com "poema removido pelo autor".
  - **Comentários em árvore, carregados como no X.** As respostas ao poema vêm
    20 por vez, e cada comentário traz as 3 primeiras respostas e "ver mais
    respostas (N)". Dá para responder em qualquer nível. Do 5º nível em diante,
    aparece "↳ respondendo a @fulano".
  - **Apagar sem quebrar a conversa.** Um comentário com respostas vira
    "comentário removido", e as respostas ficam. Sem respostas, ele some.
    Comentários não se editam.
- **O que cortamos e por quê:** a edição de comentários, porque mudar uma
  crítica depois de respondida tira o sentido da conversa. Comentários planos,
  porque uma crítica sobre o verso 3 merece uma resposta embaixo dela e não no
  fim da lista.

### 5. Antologias como curadoria

- **Contexto:** quem lê poesia guarda poemas por afinidade ("poemas de chuva",
  "sonetos de amor"), como uma antologia de verdade, e não por data.
- **Opções:** um "salvar" privado e plano, ou coleções com nome e descrição.
- **Escolha:**
  - Antologias com nome, descrição e o switch **pública/privada** (pública é o
    padrão).
  - Elas aceitam qualquer poema: de colega, de consagrado ou citação.
  - O card tem a ação "adicionar à antologia", que já mostra em quais
    antologias o poema está.
  - As públicas aparecem numa aba do perfil. Uma privada de outra pessoa dá
    404, para não revelar que existe.
- **O que cortamos e por quê:** reordenar os poemas. A ordem é a de inserção,
  e uma antologia já ajuda o iniciante a mostrar o que lê sem uma tela a mais
  para arrastar poemas.

### 6. Visual de leitura e dados que não somem

- **Contexto:** o poema precisa ser lido, não passado. E a banca (e os
  colegas) vão criar contas na URL pública.
- **Opções:** o visual do template e o SQLite efêmero do Render, que zera a
  cada restart, ou um layout de leitura e um banco persistente.
- **Escolha:**
  - **Três colunas, como num microblog:** navegação à esquerda, coluna de
    leitura de 600 px no centro e, à direita, a coluna Descobrir: busca por
    tag, Poema do dia, Em alta e Consagrados para seguir.
  - **Duas fontes:** Schibsted Grotesk na interface e Literata (serifada para
    leitura longa em tela) só no corpo dos poemas. Os ícones são SVG próprios.
  - **Postgres no Supabase** em vez do SQLite que zera (#55). O seed roda só
    num banco vazio, então os poemas criados na URL pública continuam lá depois
    de um restart.
- **O que cortamos e por quê:** cartões, gradientes e imagens no feed. O poema
  fica sobre o papel, separado por filetes, e a cor de destaque aparece só nas
  ações.

### O que ficou de fora e por quê

Cada corte foi pensado para o poeta iniciante, num prazo de 12 dias (16/11 a 27/11).

- **Mensagens diretas.** A crítica de um poema serve a quem a lê também. Numa
  DM, ela sai do lugar onde os outros iniciantes aprendem com ela. A conversa
  fica na árvore de comentários, que é pública.
- **Stories.** Somem em 24 horas, e um poema é feito para ficar. Seria também
  o formato da imagem, que é exatamente o problema do Instagram.
- **Enquetes.** Não ajudam ninguém a escrever nem a ser lido.
- **Notificações.** Custariam dias (eventos, contagem de não lidas, tela) e
  trariam de volta a lógica do engajamento. O iniciante volta para ler o feed,
  e as respostas estão na página do poema.
- **Busca por palavra.** A busca é por tag e por forma, pelo índice invertido.
  Busca de texto livre em poemas sem limite pediria um índice de texto
  completo. E quem procura poesia costuma procurar por tema ("#chuva") ou por
  forma ("haicai").
- **Upload de imagem.** O poema é texto para poder ser citado, copiado e
  traduzido. Uma imagem no post traria de volta o "poema em print". O avatar é
  só uma URL.

## Features

O dono é a pessoa responsável pela issue da feature, inclusive quando a
implementação foi feita por um subagent a pedido do Neto (ver "Uso de IA").

| Feature | Dono | Por quê (1 frase) |
|---|---|---|
| Auth (núcleo) | Pedro | Consagrados existem como contas sem login; o resto entra com senha. |
| Cadastro e login (telas) | Pedro | O fluxo do vídeo começa aqui, com erros em português no campo certo. |
| Posts/poemas (núcleo) | Henrique | Título, corpo sem limite e forma: o poema como unidade, não como tweet. |
| Feed (núcleo) | Henrique | Cronológico e com reposts como no X: o iniciante vê o que os colegas escreveram hoje. |
| Curtidas (núcleo) | Henrique | Feedback mínimo para quem está começando. |
| Comentários em árvore | Henrique | A crítica de poema vira conversa, não uma lista solta. |
| Repost + citação | Henrique | Citar um verso é o gesto central de quem lê poesia. |
| PoemaCard, compositor e página do poema | Henrique | Quebras e recuos preservados na tela, e o poema longo cortado no fim da estrofe. |
| Perfil (núcleo) e selo de consagrado | Pedro | Mostra o selo e os anos de vida dos consagrados. |
| Layout em 3 colunas e tipografia | Pedro | Uma coluna de leitura em Literata e a coluna Descobrir ao lado. |
| Antologias | Pedro | O leitor monta coleções ("Poemas de chuva"), como uma antologia de verdade. |
| Follow (núcleo) | Neto | Seguir um consagrado traz os clássicos para o feed. |
| Seed fake (núcleo) | Neto | A demo abre com 24 poetas universitários fictícios e 68 poemas em todas as formas. |
| Consagrados (importador e dados) | Neto | 95 poetas de domínio público, no original, convivem com os iniciantes. |
| Formas/temas, Em alta e Explorar | Neto | Descobrir sonetos, haicais e temas, e ver sobre o que a turma escreve. |
| Tradução por IA | Neto | Lê-se Li Bai e Baudelaire no original, com a tradução a um clique. |
| Deploy (Render + Vercel + Supabase) | Neto | A banca usa a rede na URL pública, e os dados não somem. |

## Uma escolha técnica

### Índice invertido de tags em `core/indice_tags.py`

A descoberta por forma e tema (decisão 3) depende de responder rápido a duas
perguntas: "quais poemas têm `#saudade`?" e "sobre o que a turma está
escrevendo?". Varrer todos os poemas e procurar a tag no texto a cada request
custaria O(n·L), com L o tamanho do poema, e poemas não têm limite. Por isso o
`IndiceTags` guarda duas estruturas em memória:

- `_por_tag: dict[str, dict[int, datetime]]`: tag → {post_id: criado_em}. É o
  índice invertido: a partir da tag, chega direto aos poemas.
- `_por_post: dict[int, tuple[frozenset[str], datetime]]`: post_id → (tags,
  criado_em). É o inverso, e existe por dois motivos:
  - **editar** um poema precisa saber quais tags ele tinha, para tirá-las antes
    de pôr as novas (`indexar` chama `remover` primeiro);
  - **apagar** um poema precisa visitar só as tags dele, sem varrer todas as
    tags da rede.

  Com o inverso, as duas operações são O(t).

**Normalização.** As tags passam por `normalizar`: `casefold` e remoção de
acentos (NFKD sem os caracteres combinantes). Assim `#Solidão`, `#solidão` e
`#solidao` são a mesma tag. O front usa a mesma regra no `normalizarTag`. A
forma do poema entra como tag, e as tags dos consagrados (`tags_extras`)
também.

**Big O** (t = tags do post, p = posts da tag, n = posts indexados, m = tags
distintas na janela):

| Operação | Custo | Quando roda |
|---|---|---|
| `indexar` / `remover` | O(t), lookups em hash | criar, editar, apagar poema |
| `posts_da_tag` | O(p log p), ordena na leitura (mais novo primeiro, empate pelo maior id) | `/tags/{tag}/posts`, Explorar |
| `trending` | O(n·t + m log k), heap de tamanho k via `heapq.nsmallest` | `/tags/trending` (janela de 24 h) |
| `reconstruir` | O(n·t) | só no startup (lifespan) |

O índice vive na memória do processo e é reconstruído do banco no startup. O
service (`services/tags.py`) recebe do índice só os ids na ordem certa, recorta
a página e só então vai ao banco buscar a fatia.

**Se a rede crescesse 100 vezes:**

- `posts_da_tag` deixaria de ordenar na leitura. Cada tag guardaria a lista já
  ordenada por data (inserção ordenada na escrita), e uma página custaria
  O(limit), não O(p log p).
- O índice iria para o banco, numa tabela `post_tags (tag, post_id,
  criado_em)` com índice em `(tag, criado_em)`. Isso dispensa a reconstrução
  no startup, funciona com vários workers e transforma o filtro tag + forma do
  Explorar num JOIN, no lugar de um `IN` com todos os ids da tag.
- O trending deixaria de varrer todos os posts. Uma contagem por tag que soma
  quando um poema entra na janela de 24 h e subtrai quando ele sai deixaria a
  consulta em O(m log k), sem o termo n·t.

**Medição.** O benchmark do índice invertido contra a varredura
(`backend/scripts/bench_*.py`) está sendo adicionado num PR de limpeza. Hoje o
`make bench` só avisa que não há script.

_(resultado do make bench)_

### Também em `core/`, mais curtas

- **Árvore de comentários (`core/arvore_comentarios.py`).** `montar` recebe
  tuplas `(id, parent_id, created_at, payload)` e aninha os filhos. A árvore é
  montada só sobre o que a página carregou: k = as respostas da página mais as
  prévias, e não todos os comentários do poema. Agrupar por pai (um dict
  `parent_id → filhos`) e montar recursivamente são O(k). A ordenação é
  O(k log k) no pior caso, e o Timsort aproveita os trechos que já vêm
  ordenados do banco. **Não é um singleton**, ao contrário do índice de tags:
  o texto e o autor de cada comentário vêm do banco de qualquer jeito, então
  uma árvore em memória não pouparia a ida ao banco. Um singleton custaria
  O(total de comentários da rede) no startup e uma atualização a cada write,
  e poderia sair de sincronia com o banco.
- **Janela deslizante do limite de tradução (`core/janela_deslizante.py`).**
  Um `dict usuário → deque` com os instantes das traduções novas da última
  hora. Ao consultar, os instantes velhos saem pela esquerda. `permitido` e
  `registrar` são O(1) amortizados (cada instante entra e sai uma vez), e a
  memória é de até 30 instantes por usuário ativo. Uma janela fixa ("30 por
  hora cheia") deixaria pedir 60 em dois minutos, na virada da hora. No
  startup, a janela é reconstruída da tabela `traducoes`, para o limite não
  zerar a cada restart.

## Uso de IA

- **Ferramenta:** Claude Code (Claude), da Anthropic, no desenvolvimento.
  A tradução de poemas do produto usa a API da Anthropic (Claude Haiku 5.5) em
  tempo de execução. Isso é uma feature da rede, não uma ferramenta de
  desenvolvimento.
- **Decisões: do time humano.** Todas as decisões de produto, de arquitetura e
  de contratos foram tomadas por pessoas, em especial pelo Neto, que definiu o
  nicho, as regras (domínio público até 1955, o feed como no X, o limite de
  tradução), os contratos de dados do `PLANO.md`, o visual e os cortes. A IA
  propunha opções e listava as lacunas, e o Neto escolhia. As escolhas estão
  registradas nos PRs, nas seções "Decisões do Neto" (por exemplo #31, #37,
  #38, #43, #49, #51, #54 e #56), e as perguntas que ficaram para ele, em
  "Decisões em aberto".
- **Código: gerado com apoio de IA, sob direção humana.** Boa parte do código
  foi escrita por subagents do Claude Code a partir das tasks e dos contratos
  do `PLANO.md`. Isso inclui partes atribuídas ao Henrique e ao Pedro, que
  foram implementadas a pedido do Neto para destravar o time. Esses PRs dizem,
  na primeira linha, "Implementado por um subagent (Claude Code) a pedido do
  Neto, no lugar do @hguimaa / @CorreiaPedro208" (#30, #31, #33, #36 a #42,
  #44, #53 e #56). Por isso, a maior parte dos commits está na conta do Neto.
  O Henrique e o Pedro validam essas partes nas issues #57 a #62. O model
  `Post` e o CRUD de `/posts` (#24) foram feitos pelo Henrique.
- **Revisão: humana.** O Neto revisou cada PR e decidiu cada merge, com o
  apoio de um agente de revisão (Claude Code) que rodava os testes e conferia
  os contratos. Os comentários de revisão estão nos PRs, publicados pela conta
  do Neto. As reviews formais de outros colegas no GitHub se limitam ao #24. O
  Henrique e o Pedro registram a validação deles nas issues #57 a #62 e na
  revisão deste arquivo (#63).
- **Conteúdo:**
  - Os poemas do seed foram escritos com IA (Claude): os 24 poetas iniciantes,
    os 68 poemas, as citações e as conversas de oficina
    (`backend/scripts/seed_conteudo.py`). São fictícios, sem copiar autor real
    nem imitar poeta vivo.
  - Os poemas dos consagrados vieram de um scraper do Neto (Wikisource e
    Wikiquote). Foram validados e não foram alterados: saíram os poemas com
    defeito, e a única limpeza foi mecânica, nos caracteres invisíveis e no TAB
    do início dos versos (#45 e #49).
- **Henrique:** _(completar com a ferramenta e o uso próprio)_
- **Pedro:** _(completar com a ferramenta e o uso próprio)_
