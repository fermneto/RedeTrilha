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
  - A crítica aponta o verso: o leitor seleciona os versos 5 a 8 e comenta
    só aquele trecho, como na margem de uma oficina.
  - Quem escreve tem uma oficina no compositor (sílabas poéticas e esquema
    de rimas, desligáveis) e rascunhos privados. O poema só vai a público
    quando está pronto, e publicado não muda mais.
  - A renga, o poema colaborativo, faz a turma escrever junto, estrofe por
    estrofe.
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

### 7. A crítica ancorada no verso

- **Contexto:** numa oficina de poesia, a crítica raramente é sobre o poema
  todo. É "o verso 6 quebra o ritmo" ou "a imagem dos versos 9 a 11 é a mais
  forte". Num comentário comum, o leitor precisa copiar o verso para dizer de
  qual está falando.
- **Opções:** comentários só sobre o poema inteiro; citar o verso à mão no
  texto do comentário; ou ancorar o comentário num trecho do poema.
- **Escolha:**
  - O leitor **seleciona os versos com o mouse**, como seleciona texto comum,
    e aparece a barra "comentar estes versos / citar estes versos". A seleção
    vira os versos inteiros que ela toca, e um clique fora a desfaz. Os números dos versos ficam sempre
    visíveis, em cinza claro, e são botões: é o caminho de quem usa só o
    teclado.
  - O comentário mostra o trecho em Literata, acima do texto, com a referência
    ("versos 5–8"). Cada verso comentado ganha uma marca com quantas críticas o
    cobrem, e clicar nela filtra a conversa por aquele verso.
  - A numeração conta as linhas em branco entre estrofes, como a posição da
    linha no texto.
  - Só o 1º nível da árvore é ancorado. As respostas herdam o trecho do
    comentário pai.
  - "Citar estes versos" abre a citação que já existia com os versos
    preenchidos, e uma linha em branco para o leitor escrever.
  - Um comentário ancorado removido com respostas continua mostrando o trecho,
    como o resto da conversa.
- **O que cortamos e por quê:** guardar uma cópia do trecho em cada
  comentário. Como o poema publicado não muda (decisão 9), o trecho sai do
  próprio poema e nunca fica desatualizado.

### 8. A oficina no compositor: sílabas e rimas, desligáveis

- **Contexto:** o iniciante que tenta um soneto não sabe se o verso tem 10
  sílabas poéticas nem qual é o esquema de rimas. Mas muitos escrevem em verso
  livre, e marcar sílabas em todo poema seria tratar a métrica como regra.
- **Opções:** nenhuma ajuda; um validador que bloqueia o poema fora da forma;
  ou marcas ao lado dos versos que o poeta liga e desliga.
- **Escolha:**
  - Ao lado de cada verso, no compositor, aparecem as **sílabas poéticas**
    (contadas até a última tônica, com sinalefa, ditongos e hiatos) e a
    **letra da rima**. Abaixo aparece o esquema da estrofe, por exemplo
    `ABBA ABBA CDC DCD` em "Amor é fogo que arde sem se ver".
  - **Dois toggles independentes**, um para sílabas e outro para rimas.
    Começam ligados, e o estado fica salvo no navegador. Quem não usa metro
    nem rima desliga os dois, e a oficina some.
  - **Só no compositor**, inclusive no da citação. O leitor nunca vê as
    marcas, e o poema publicado não guarda nada da análise.
  - **Rima:** é consoante quando as terminações são iguais a partir da vogal
    tônica. É toante (mesmas vogais) só para o verso que não tem par
    consoante, em itálico. O verso sem rima ganha uma letra própria.
  - **Aviso de forma, sem bloquear:** soneto com outro número de versos que
    não 14, e haicai fora de 5-7-5 sílabas poéticas. O aviso só aparece com
    pelo menos um toggle ligado.
  - A contagem é uma heurística e erra alguns versos clássicos. Os testes
    registram dois desses casos como falha esperada (Camões em "ain-da",
    Augusto dos Anjos em "in-fluên-cia").
- **O que cortamos e por quê:** a oficina na leitura, porque o leitor lê o
  poema e não a métrica dele. Também não há bloqueio de forma: um soneto de 13
  versos é decisão do poeta.

### 9. Rascunhos privados e o poema publicado imutável

- **Contexto:** o iniciante reescreve o poema muitas vezes antes de mostrar a
  alguém. E a crítica ancorada (decisão 7) e as citações apontam para versos
  exatos: se o poema mudasse depois, a crítica do verso 6 passaria a falar de
  outro verso.
- **Opções:** editar o poema publicado com um histórico de versões; marcar
  "editado"; ou separar o rascunho do poema publicado.
- **Escolha:**
  - **Rascunhos privados.** Só o autor vê, edita e apaga. Para qualquer outra
    pessoa, um rascunho dá 404, e ele nunca aparece no feed, no perfil, nas
    tags ou no Explorar. "Rascunhos" é um item da navegação. Não há limite de
    rascunhos, e a lista mostra primeiro o editado por último.
  - **Publicar um rascunho** cria o poema com a data de agora e **sem marca de
    editado**, por mais que o rascunho tenha mudado antes.
  - **Também há rascunho de citação**, que ao publicar vira citação.
  - **O poema publicado não se edita.** O `PATCH /posts` foi removido (responde
    405), e o teste do núcleo `test_posts_crud` passou a conferir isso. Para
    corrigir um poema publicado, o autor apaga e publica de novo.
- **O que cortamos e por quê:**
  - **O histórico de versões e a marca "editado"**, que perderam o sentido
    sem edição.
  - **A edição do publicado**, mesmo custando as curtidas e os comentários de
    quem apaga para corrigir. A conversa sobre um verso só vale se o verso
    continua lá.

### 10. A renga: o poema escrito pela turma

- **Contexto:** a renga japonesa é um poema escrito em cadeia, cada poeta
  respondendo à estrofe anterior. É o exercício de oficina que mais faz um
  iniciante escrever, e ele escreve para alguém, não para a gaveta.
- **Opções:** só comentários; um "poema colaborativo" sem regra; ou uma renga
  com regras simples.
- **Escolha:**
  - Quem cria abre com a **1ª estrofe**, um título e as configurações: o
    **modo** (aberta a qualquer pessoa logada ou só para convidados) e o
    **limite de estrofes** (12 por padrão, de 3 a 40, contando a 1ª).
    Consagrados não podem ser convidados, porque não têm login.
  - **Ninguém escreve duas estrofes seguidas.** A renga fecha ao atingir o
    limite ou quando o criador encerra. Fechada, vira um poema com todos os
    autores, cada estrofe com o seu.
  - Qualquer pessoa logada lê qualquer renga, inclusive as de convidados. Só
    quem pode escrever vê o campo da próxima estrofe, e quem não pode vê o
    motivo.
  - **No feed, como um repost no X.** A renga aparece para quem segue o
    criador ou alguém que escreveu uma estrofe. Ela aparece uma vez só, na
    posição da atividade mais recente de um seguido, com o rótulo "fulano
    abriu uma renga", "fulano escreveu uma estrofe" ou "fulano encerrou a
    renga" (este só para quem segue o criador). O criador aparece sempre como
    quem abriu. Fechada, continua no
    feed, como poema completo. O card mostra as 4 primeiras estrofes.
  - **No perfil**, a renga aparece como um post de cada participante e soma 1
    no contador de poemas dele.
  - Duas pessoas escrevendo ao mesmo tempo não estouram o limite nem quebram a
    regra de vez: o service trava a renga no banco, e quem perde a corrida
    recebe "outra pessoa acrescentou uma estrofe agora".
- **O que cortamos e por quê:** a ordem fixa de turnos entre convidados,
  porque esperar a vez de uma pessoa que sumiu trava a renga inteira. Também
  não dá para mudar o modo nem o limite depois de criar, nem convidar alguém
  depois de abrir.

### O que ficou de fora e por quê

Cada corte foi pensado para o poeta iniciante, em 12 dias de prazo (16/11 a 27/11), com o código a partir de 23/11.

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
| Crítica ancorada no verso | Neto | A crítica de oficina aponta o verso, como na margem do caderno. |
| Oficina: sílabas e rimas no compositor | Neto | O iniciante vê o metro e as rimas enquanto escreve, e desliga se não usa. |
| Rascunhos e poema publicado imutável | Neto | O poema amadurece em privado, e a conversa sobre um verso não perde o verso. |
| Rengas | Neto | A turma escreve um poema junto, estrofe por estrofe. |
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

**Medição.** O `make bench` roda `backend/scripts/bench_indice_tags.py`: a
mesma massa sintética (posts com 1 a 4 tags de um vocabulário de 67, espalhados
por 14 dias, semente fixa) vai para o índice e para uma lista simples, e o
`timeit` mede as duas consultas contra uma varredura linear da lista (mediana
de 7 rodadas; antes, o script confere que os dois lados devolvem o mesmo
resultado):

```
   posts | consulta     | resultado |  índice (ms) | varredura (ms) |   ganho
-----------------------------------------------------------------------------
    1000 | posts_da_tag |    25 ids |        0.004 |          0.018 |    4.8x
    1000 | trending     |     top 5 |        0.045 |          0.044 |    1.0x
   10000 | posts_da_tag |   343 ids |        0.067 |          0.228 |    3.4x
   10000 | trending     |     top 5 |        0.372 |          0.389 |    1.0x
  100000 | posts_da_tag |  3722 ids |        1.165 |          4.624 |    4.0x
  100000 | trending     |     top 5 |        4.627 |          4.169 |    0.9x
```

Os números confirmam a tabela de Big O. Em `posts_da_tag`, o índice vai direto
aos p poemas da tag e fica de 3 a 5 vezes mais rápido que olhar os n posts. O
`trending` empata com a varredura (0,9x a 1,0x), porque hoje ele também percorre
todos os posts. É por isso que a contagem incremental por janela está na lista
acima: é ela que tiraria o termo n·t.

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

- **Métrica e rima (`core/metrica.py`).** São funções puras, sem estado, por
  isso sem singleton. `silabas_poeticas` divide o verso em núcleos vocálicos e
  aplica sinalefa na fronteira das palavras e sinérese depois da tônica.
  `terminacao_rimica` normaliza a terminação pelo som (ç, ss e c antes de e/i
  viram "s"), e `esquema_de_rimas` agrupa os versos da estrofe por terminação
  num dict. Tudo é O(L) no tamanho do texto. A rota `POST /oficina/analise` não
  usa o banco e aceita até 10.000 caracteres; o poema em si continua sem
  limite.

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
  #38, #43, #49, #51, #54, #56 e #75 a #78), e as perguntas que ficaram para ele, em
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
  As decisões 7 a 10 (crítica ancorada, oficina, rascunhos e rengas, #75 a
  #78) também foram implementadas por subagents a pedido do Neto. Cada
  lacuna que eles encontraram voltou para ele decidir antes do merge.
- **Revisão: humana.** O Neto revisou cada PR e decidiu cada merge, com o
  apoio de um agente de revisão (Claude Code) que rodava os testes e conferia
  os contratos. Os comentários de revisão estão nos PRs, publicados pela conta
  do Neto. A única aprovação formal no GitHub é a do #24, registrada na conta
  do Neto com apoio do agente de revisão. O Henrique e o Pedro registram a validação deles nas issues #57 a #62 e na
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
