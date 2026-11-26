# Decisões do time

**Time:** Neto (@fermneto), Henrique (@hguimaa), Pedro (@CorreiaPedro208)

> **O Verso é uma rede social para quem lê e escreve poesia.** Aqui o post é o
> poema inteiro, sem limite de caracteres e com as quebras de linha como foram
> escritas. A conversa é sobre o poema: citar um verso, criticar os versos 5 a 8,
> responder em árvore. E os 155 poetas clássicos em domínio público estão no
> mesmo feed que os poetas de hoje, no original e com tradução por IA.

As decisões abaixo foram tomadas pelo time. O registro de cada uma está nos
PRs, na seção "Decisões do Neto".

## Produto

- **Público:** pessoas que leem e escrevem poesia e querem publicar o poema
  inteiro e conversar sobre ele. Não é um grupo de idade nem de profissão: o
  que as une é o hábito de escrever poemas e de ler os dos outros.
  - **Quem são:** a estudante de Letras que escreve no caderno, a professora
    aposentada que relê Camões e escreve sonetos à mão, o motorista que faz
    cordel no ponto final, o engenheiro que escreve haicai no ônibus, a mãe que
    lê Florbela no recreio da escola onde ensina, o aluno do ensino médio que
    guarda poemas no bloco de notas do celular.
  - **O que fazem hoje:** escrevem no caderno ou no celular e mostram a um ou
    dois amigos. Quando publicam, partem o soneto num fio no X ou postam o
    poema como imagem no Instagram. Leem os clássicos num livro ou num PDF, e
    os versos que circulam nas redes vêm soltos, sem poema nem autor.
  - **O que falta:** um lugar onde o poema apareça inteiro, como foi escrito,
    onde a resposta seja sobre um verso, uma rima, uma imagem, e onde o poema
    de quem escreve hoje e o dos clássicos estejam no mesmo feed.
- **Problema:**
  - No X, o limite de caracteres obriga a partir um soneto em fio.
  - No Instagram, o poema vira imagem: não dá para copiar nem citar um verso, e
    o texto não aparece numa busca.
  - Feeds ranqueados por engajamento enterram texto longo, e quem escreve
    poemas e tem poucos seguidores nunca é visto.
  - Os clássicos ficam num lugar (o livro, o PDF) e o que se escreve fica em
    outro: quase ninguém lê os clássicos ao lado do que ele mesmo escreve.
- **Como a rede resolve** (cada item é uma decisão abaixo):
  - O post é o poema: corpo sem limite, quebras e recuos preservados, e uma
    forma (soneto, haicai, cordel...) (decisão 1).
  - Os consagrados são contas no mesmo feed, no original, com tradução por IA
    a um clique (decisão 2).
  - O feed é cronológico, em duas abas, e a descoberta é por forma e tema
    (decisão 3) e por afinidade de escola literária, forma e região
    (decisão 11).
  - Os gestos de quem lê poesia são de primeira classe: citar um verso,
    conversar em árvore (decisão 4) e criticar um trecho exato, como na margem
    de uma oficina (decisão 7).
  - Quem escreve tem uma oficina no compositor, com sílabas poéticas e rimas
    (decisão 8), rascunhos privados (decisão 9) e a renga, o poema escrito a
    várias mãos (decisão 10).
  - O Acervo reúne todos os poetas, com busca e filtros por língua e época
    (decisão 12).
  - As mensagens diretas servem ao que é pessoal: combinar uma renga, trocar
    poemas, conversar. A crítica do poema continua pública (decisão 13).
  - Os avisos contam a quem escreve que alguém curtiu, citou, criticou um
    verso, respondeu ou escreveu a estrofe seguinte da renga (decisão 16).
- **Como saberíamos que funcionou:** alguém cita um verso de um consagrado ou
  de outro poeta da rede e recebe respostas de outra pessoa. Isso dá para
  contar no banco: citações (`repost_de_id` com texto) com comentários de outra
  pessoa. Ainda não temos usuários reais, então não temos esse número: ele
  será medido no banco da URL pública antes da banca.

## Decisões de produto

### 1. O poema inteiro como unidade, não um post curto

- **Contexto:** quem escreve poesia escreve sonetos de 14 versos, poemas em
  verso livre de duas páginas e haicais de três linhas. A quebra de linha faz
  parte do poema, e o recuo também.
- **Opções:** um post curto com limite, como no template, ou um post que é um
  poema, com campos próprios.
- **Escolha:**
  - Título opcional, corpo **sem limite de caracteres** e uma **forma**
    opcional: soneto, haicai, trova, quadra, cordel, verso livre, prosa poética
    ou outro. A forma vira tag (`#soneto`), menos `outro`, que juntaria poemas
    sem nada em comum.
  - O texto é gravado como veio e exibido em Literata, uma serifada de leitura,
    com as quebras e os recuos. No compositor, o Tab insere um recuo.
  - No feed, um poema longo é cortado no fim da última estrofe que cabe em 20
    linhas, com "ler poema inteiro". Só a exibição é cortada.
- **O que cortamos e por quê:** o limite de caracteres e o "post rápido". Um
  feed de poemas inteiros rola mais devagar, e é isso que queremos: quem publica
  um poema quer ser lido até o fim.

### 2. Os consagrados no feed, no original e com tradução por IA

- **Contexto:** queríamos que Augusto dos Anjos aparecesse no feed ao lado do
  soneto que alguém publicou hoje, e não numa biblioteca à parte.
- **Opções:** uma biblioteca separada de clássicos; trechos soltos sem autor;
  ou os poetas como contas de verdade.
- **Escolha:**
  - **Contas normais, sem login.** Os consagrados podem ser seguidos,
    curtidos, comentados, repostados e citados, mas não entram com senha.
    Seguir um consagrado traz os poemas dele para o "Seguindo".
  - **Selo próprio:** um lacre de cera com uma pena, com "domínio público" e os
    anos de vida no tooltip. No perfil: "Poeta consagrado · 1884–1914 · obra em
    domínio público".
  - **Só domínio público:** autores **mortos até 1955** (domínio público no
    Brasil em 2026, 70 anos após a morte). O importador recusa quem morreu
    depois, e cada poema guarda a `fonte` (Wikisource ou Wikiquote).
  - **No original:** 155 poetas e 11.236 poemas em 20 línguas. Bilac e Florbela
    em português, Baudelaire em francês, Li Bai em chinês, Hafez em persa, Bashō
    em japonês. Os textos não foram editados: saíram só os poemas com defeito,
    e a limpeza foi mecânica (caracteres invisíveis e TAB no início dos versos,
    #49).
  - **Escola e país:** cada consagrado tem 1 ou 2 escolas literárias, de um
    vocabulário de 15 (da antiguidade clássica ao modernismo, mais poesia
    popular e cordel, clássica oriental e clássica árabe e persa), e o país de
    nascimento, vazio quando é desconhecido ou disputado, como o de Homero. É o
    que liga o poeta às sugestões por afinidade (decisão 11).
  - **Acervo:** os perfis de todos os poetas numa tela, com filtros
    (decisão 12).
  - **Tradução sob demanda por IA.** O botão "Traduzir" aparece quando a língua
    do poema é diferente da do navegador. A tradução (Claude Haiku 5.5)
    preserva o número de versos, as estrofes, os recuos e a formatação. A
    tradução toma o lugar do original no card (título e corpo), com
    "Traduzido do {língua} por IA · ver original" logo abaixo, e "ver
    original" volta ao texto do poeta; "ver tradução" a mostra de novo sem
    chamar a IA. Na página do poema, a seleção de versos e as marcas de
    crítica são do original: com a tradução na tela, as marcas somem e
    voltam com "ver original", e a seleção feita antes de traduzir é
    desfeita. Cada tradução fica em cache por poema e língua, e cada usuário
    pede até 30 traduções novas por hora (as do cache não contam).
- **O que cortamos e por quê:**
  - **Os modernos que o público mais conhece** (Drummond, Bandeira, Cecília,
    Vinicius): as obras ainda têm direitos autorais. Preferimos um acervo legal
    a um acervo famoso e irregular.
  - **Traduções humanas publicadas:** têm direito de tradutor. O acervo fica no
    original, e a tradução gerada na hora, marcada como IA, ajuda a ler sem
    substituir o poema.
  - **Original e tradução lado a lado:** num poema longo, os dois textos
    empilhados dobram a rolagem, e no celular não cabem em colunas. A tradução
    substitui o original na tela, com "ver original" sempre à mão.
  - **A tradução ilimitada:** a URL é pública e cada tradução nova custa uma
    chamada paga. O cache e o limite por usuário seguram o custo.

### 3. Feed cronológico em duas abas; descoberta por formas e temas

- **Contexto:** feeds ranqueados por engajamento premiam o que é curto e
  chamativo, e quem escreve poemas e tem poucos seguidores nunca chega ao topo.
  Já um feed só de quem você segue começa vazio: o poeta abre a rede e não tem
  nada para ler.
- **Opções:** um feed ranqueado por curtidas; um feed cronológico só dos
  seguidos; ou cronológico em duas abas, como no X.
- **Escolha:**
  - **"Para você"** (a aba em que a home abre): a rede inteira, inclusive quem
    você não segue. Entram os poemas recentes dos poetas da rede, as rengas
    abertas, os reposts ("repostado por") e os poemas que acabaram de receber
    comentário ou crítica ("fulano comentou", "fulano criticou os versos").
    Os consagrados entram rareados, **um a cada 3 horas**, para os milhares de
    poemas do acervo não afogarem os poetas da rede. Em cada janela entra o
    mais recente na língua de quem vê (a do navegador ou, sem ela, a dos poemas
    da pessoa); se a janela não tiver nenhum nessa língua, entra o mais recente
    de qualquer língua.
  - **"Seguindo":** os poemas de quem você segue e os seus. Um poema repostado
    por vários seguidos aparece uma vez, na posição do repost mais recente, com
    todos os nomes.
  - **A ordem é cronológica pela atividade, nas duas abas.** O poema sobe
    porque alguém acabou de escrever, comentar ou repostar, e não porque tem
    mais curtidas. O soneto de quem tem dois seguidores entra no topo do mesmo
    jeito que o de quem tem duzentos, e a conversa sobre um poema antigo o traz
    de volta. Cada poema aparece uma vez, com o rótulo da atividade mais
    recente.
  - **Descoberta por forma e tema.** As `#tags` do corpo e a forma viram tags
    clicáveis, e `#Solidão` acha `#solidao`. O **Explorar** filtra por tag e
    por forma (inclusive "outras formas").
  - **"Em alta"** mostra as tags com mais poemas nas últimas 24 horas: sobre o
    que a rede está escrevendo, não quem tem mais curtidas.
  - **Poema do dia:** um poema de consagrado, o mesmo para todos no mesmo dia.
- **O que cortamos e por quê:** qualquer ranking por engajamento ("mais
  curtidos da semana"), também no "Para você". Quem procura algo novo procura
  "um haicai sobre chuva", não o post mais curtido, e ordenar por curtidas
  traria de volta o problema que o Verso quer resolver.

### 4. Citar um verso e conversar sobre o poema

- **Contexto:** comentar um poema nas redes atuais é deixar um "lindo!" numa
  lista solta, e citar um verso é tirar print.
- **Opções:** só curtidas e comentários planos, ou investir nos gestos de quem
  lê poesia: repostar, citar e discutir.
- **Escolha:**
  - **Repost** e **citação**: a citação é um poema novo que aponta para o
    original, por exemplo um verso destacado com a resposta do leitor. Se o
    original for apagado, a citação fica, com "poema removido pelo autor".
  - **Comentários em árvore, como no X:** dá para responder em qualquer nível;
    cada comentário mostra as 3 primeiras respostas e "ver mais respostas (N)".
  - **Apagar sem quebrar a conversa:** um comentário com respostas vira
    "comentário removido", e as respostas ficam. Sem respostas, ele some.
- **O que cortamos e por quê:** a edição de comentários, porque mudar uma
  crítica depois de respondida tira o sentido da conversa. E os comentários
  planos, porque a crítica sobre o verso 3 merece a resposta embaixo dela, não
  no fim da lista.

### 5. Antologias como curadoria

- **Contexto:** quem lê poesia guarda poemas por afinidade ("poemas de chuva",
  "sonetos de amor"), como numa antologia de verdade, e não por data.
- **Opções:** um "salvar" privado e plano, ou coleções com nome e descrição.
- **Escolha:**
  - Antologias com nome, descrição e o switch **pública/privada** (pública é o
    padrão). Aceitam qualquer poema: da rede, de consagrado ou citação.
  - O card tem "adicionar à antologia", que já mostra em quais o poema está.
  - As públicas aparecem numa aba do perfil. A privada de outra pessoa dá 404,
    para não revelar que existe. No próprio perfil, a mesma aba traz também as
    privadas: é ali que ficam "as minhas antologias".
  - **Descobrir no Explorar, criar no "Escrever"** (decisão 17): a aba
    Antologias do Explorar lista as públicas de todo mundo com ao menos um
    poema, inclusive as minhas, a mais nova primeiro, com quem reuniu (decisão
    do Neto); a nova se cria no "Escrever", trocando o formato para Antologia
    (`/antologias/nova`).
- **O que cortamos e por quê:** reordenar os poemas. A ordem é a de inserção:
  a antologia já mostra o que o leitor lê, sem uma tela a mais para arrastar
  poemas.

### 6. Visual de leitura

- **Contexto:** o poema precisa ser lido, não passado. Um feed de poemas
  inteiros pede uma coluna de texto confortável e pouca coisa disputando o
  olhar.
- **Opções:** o visual do template, ou um layout de leitura com tipografia
  própria.
- **Escolha:**
  - **Três colunas, como num microblog:** navegação à esquerda, uma coluna de
    leitura de 600 px no centro e, à direita, a coluna Descobrir: busca por
    tag, Poema do dia, Em alta e consagrados para seguir.
  - **Duas fontes:** Schibsted Grotesk na interface e Literata só no corpo dos
    poemas. Os ícones são SVG próprios.
  - **Ícone e cartão de compartilhamento:** o ícone é o "V" do logo, em
    Literata semibold itálica, tinta sobre papel (e papel sobre tinta no tema
    escuro do navegador), engrossado nos 16 e 32 px da aba para o traço fino
    não sumir. O link compartilhado no WhatsApp, no X ou no Telegram abre um
    cartão de papel e tinta: o do poema traz o título, os primeiros versos com
    as quebras e os recuos, o autor e o selo do consagrado; o do perfil, da
    renga e da antologia trazem nome, autores e começo. Poema em árabe, persa
    ou hebraico mostra só o título legível, a língua e o autor, porque o
    gerador de imagem não junta as letras dessas escritas. A renga de
    convidados tem cartão como as outras, porque o modo restringe quem
    escreve, não quem lê; a antologia privada fica com o cartão padrão, sem
    revelar que existe.
  - **Uma rota pública só para o cartão** (decisão do Neto): as páginas do
    poema, do perfil, da renga e da antologia continuam pedindo login, e o
    cartão lê `GET /cartoes/...`, sem login, que devolve só o que ele mostra
    (título, autor, os primeiros versos sem marcas, a bio e o número de
    poemas), com cache público de 5 minutos. Nada de curtidas, comentários,
    seguidores ou rascunhos; antologia privada e poema apagado dão 404.
- **O que cortamos e por quê:** cartões, gradientes e imagens no feed. O poema
  fica sobre o papel, separado por filetes, e a cor de destaque aparece só nas
  ações.

Onde a rede roda, e por que os dados não somem nem o site cai, está na
decisão 15.

### 7. A crítica ancorada no verso

- **Contexto:** numa oficina de poesia, a crítica raramente é sobre o poema
  todo. É "o verso 6 quebra o ritmo" ou "a imagem dos versos 9 a 11 é a mais
  forte". Num comentário comum, o leitor precisa copiar o verso para dizer de
  qual fala.
- **Opções:** comentários só sobre o poema inteiro; citar o verso à mão no
  texto; ou ancorar o comentário num trecho do poema.
- **Escolha:**
  - O leitor **seleciona os versos com o mouse**, como seleciona texto comum,
    e aparece a barra "comentar estes versos / citar estes versos". Os números
    dos versos ficam visíveis, em cinza claro, e são botões: é o caminho de
    quem usa só o teclado. As linhas em branco entre estrofes contam na
    numeração.
  - O comentário mostra o trecho acima do texto, com a referência ("versos
    5–8"). Cada verso comentado ganha uma marca com quantas críticas o cobrem,
    e clicar nela filtra a conversa por aquele verso. Com o filtro de um verso
    ativo, a lista mostra só as críticas daquele verso, inclusive as que você
    acabou de publicar; para ver todas, "ver todos os comentários".
  - Só o 1º nível da árvore é ancorado; as respostas herdam o trecho do pai.
  - "Citar estes versos" abre a citação (decisão 4) com os versos preenchidos
    e uma linha em branco para o leitor escrever.
  - **A crítica nasce em qualquer card e termina na página do poema.** No
    feed, no perfil, nas antologias e no poema enviado por mensagem, selecionar
    o texto do corpo do poema mostra a mesma barra, pequena, com "comentar
    estes versos / citar estes versos / limpar" (some também com Esc ou um
    toque fora dela).
    "Comentar" abre a página do poema já com esses versos selecionados e o
    campo de comentário focado, com o trecho citado acima
    (`/poema/7?versos=2-4`); é lá que a crítica é escrita, ao lado das outras.
    A numeração é a do poema inteiro, mesmo no card cortado ("ler poema
    inteiro" só esconde o fim). Com a tradução na tela, a barra não aparece (a
    seleção é de versos do original); no repost puro, ela leva ao original. Na
    prévia do compositor de citação ela também não aparece, para o link não
    tirar o leitor do que está escrevendo. Antes, selecionar versos fora da
    página do poema não fazia nada, e parecia quebrado.
  - **A renga também recebe crítica por verso**, aberta ou encerrada
    (decisão do Neto; ver a decisão 10). Os versos contam as estrofes juntas,
    em ordem, com a linha em branco entre elas contando, como no poema. No
    card da renga a barra traz só "comentar estes versos / limpar": "citar"
    fica de fora porque a citação cita poemas, e a renga não é um poema
    publicado.
- **O que cortamos e por quê:** guardar uma cópia do trecho em cada
  comentário. Como o poema publicado não muda (decisão 9), o trecho sai do
  próprio poema e nunca fica desatualizado.

### 8. A oficina no compositor: sílabas e rimas, desligáveis

- **Contexto:** quem tenta um soneto nem sempre sabe se o verso tem 10 sílabas
  poéticas nem qual é o esquema de rimas, e quem sabe contar quer conferir sem
  contar nos dedos. Mas muitos escrevem em verso livre, e marcar sílabas em
  todo poema seria tratar a métrica como regra.
- **Opções:** nenhuma ajuda; um validador que bloqueia o poema fora da forma;
  ou marcas ao lado dos versos que o poeta liga e desliga.
- **Escolha:**
  - Ao lado de cada verso, no compositor, aparecem as **sílabas poéticas**
    (contadas até a última tônica, com sinalefa) e a **letra da rima**. Abaixo
    vem o esquema, por exemplo `ABBA ABBA CDC DCD` em "Amor é fogo que arde sem
    se ver".
  - **Dois toggles independentes**, sílabas e rimas, que começam ligados e
    ficam salvos no navegador. Quem não usa metro nem rima desliga os dois, e a
    oficina some.
  - **Aviso de forma, sem bloquear:** soneto sem 14 versos e haicai fora de
    5-7-5 sílabas poéticas.
  - **Só no compositor**, inclusive no da citação. O leitor nunca vê as marcas,
    e o poema publicado não guarda nada da análise.
  - A contagem é uma heurística e erra alguns versos clássicos. Os testes
    registram dois casos como falha esperada (Camões em "ain-da", Augusto dos
    Anjos em "in-fluên-cia").
- **O que cortamos e por quê:** a oficina na leitura, porque o leitor lê o
  poema, não a métrica dele. E o bloqueio de forma: um soneto de 13 versos é
  decisão do poeta.

### 9. Rascunhos privados e o poema publicado imutável

- **Contexto:** quem escreve reescreve o poema muitas vezes antes de mostrar a
  alguém. E a crítica ancorada (decisão 7) e as citações apontam para versos
  exatos: se o poema mudasse depois, a crítica do verso 6 passaria a falar de
  outro verso.
- **Opções:** editar o poema publicado com histórico de versões; marcar
  "editado"; ou separar o rascunho do poema publicado.
- **Escolha:**
  - **Rascunhos privados**, inclusive de citação: só o autor vê, edita e apaga.
    Eles nunca aparecem no feed, no perfil nem nas tags, e para os outros dão
    404. Sem limite de quantidade. Ficam numa aba "Rascunhos" do próprio perfil,
    ao lado de Poemas e Antologias, que só o dono vê (decisão 17; antes eram um
    item da navegação). `/rascunhos` continua, e leva à aba.
  - **Publicar um rascunho** cria o poema com a data de agora, sem marca de
    editado.
  - **O poema publicado não se edita** (a rota responde 405, e o teste do
    núcleo `test_posts_crud` confere). Para corrigir, o autor apaga e publica
    de novo.
- **O que cortamos e por quê:** a edição do publicado, o histórico de versões
  e a marca "editado", mesmo custando as curtidas e os comentários de quem
  apaga para corrigir. A conversa sobre um verso só vale se o verso continua
  lá.

### 10. A renga: o poema escrito a várias mãos

- **Contexto:** a renga japonesa é um poema em cadeia, cada poeta respondendo
  à estrofe anterior. É um exercício clássico de oficina: faz escrever quem
  anda sem tempo ou sem assunto, e cada um escreve para alguém, não para a
  gaveta.
- **Opções:** só comentários; um "poema colaborativo" sem regra; ou uma renga
  com regras simples.
- **Escolha:**
  - Quem cria abre com a **1ª estrofe**, um título, o **modo** (aberta a
    qualquer pessoa logada ou só para convidados) e o **limite de estrofes**
    (12 por padrão, de 3 a 40). Consagrados não podem ser convidados, porque
    não têm login.
  - **Ninguém escreve duas estrofes seguidas.** A renga fecha ao atingir o
    limite ou quando o criador encerra, e vira um poema com todos os autores,
    cada estrofe com o seu.
  - Qualquer pessoa logada lê qualquer renga. Só quem pode escrever vê o campo
    da próxima estrofe, e quem não pode vê o motivo.
  - **No feed, como um repost:** a renga aparece uma vez, para quem segue o
    criador ou um dos autores, na atividade mais recente ("fulano abriu uma
    renga", "fulano escreveu uma estrofe", "fulano encerrou a renga"), com as 4
    primeiras estrofes. No perfil, conta como um poema de cada participante.
  - Duas pessoas escrevendo ao mesmo tempo não quebram as regras: quem perde a
    corrida recebe "outra pessoa acrescentou uma estrofe agora".
  - **Descobrir no Explorar, abrir no "Escrever"** (decisão 17): a aba Rengas do
    Explorar lista as de todo mundo, com os filtros abertas (para participar),
    fechadas e "Minhas" (as que criei, em que escrevi ou para as quais fui
    convidado); a nova se abre no "Escrever", trocando o formato para Renga.
    `/rengas` leva à aba, e
    `/rengas/{id}` continua sendo a página da renga, aonde levam os avisos.
  - **Rengas, abertas ou encerradas, recebem comentários e crítica por verso**
    (decisão do Neto), com a mesma árvore, as mesmas marcas nos versos e o
    mesmo `?versos=` da página do poema (decisão 7). Comentar não é escrever:
    qualquer pessoa logada que lê a renga comenta, também nas de convidados.
    Como as estrofes só se acrescentam no fim e não se editam, a crítica do
    verso 6 continua no verso 6 quando a renga aberta cresce.
- **O que cortamos e por quê:** a ordem fixa de turnos entre convidados,
  porque esperar a vez de quem sumiu trava a renga inteira. Também não dá para
  mudar o modo nem o limite, nem convidar alguém, depois de abrir: as regras
  são um contrato. Quem entra numa renga aceitou aquelas regras, e mudá-las no
  meio muda o poema que os outros já ajudaram a escrever.

### 11. Boas-vindas e sugestões por afinidade

- **Contexto:** quem acabou de criar a conta não segue ninguém, e não sabe
  quem seguir entre 155 consagrados e os poetas da rede. Quem gosta de
  parnasianos e de sonetos chega mais rápido a quem lê se a rede souber disso.
- **Opções:** nenhuma ajuda depois do cadastro; uma lista fixa de perfis
  populares; recomendação pelo que a pessoa lê e curte; ou perguntar do que ela
  gosta e sugerir por afinidade.
- **Escolha:**
  - **Boas-vindas em três passos, todos com "pular":** "Que poesia você
    gosta?" (as 15 escolas da decisão 2 e as formas), "De onde você é?" (país
    e, no Brasil, estado, ou "prefiro não dizer") e a grade "Quem seguir". As
    preferências se reajustam depois pelo menu da conta.
  - **A ordem das sugestões é uma nota com pesos fixos:** seguidores em escala
    log (peso 1,0), cada escola ou forma em comum (2,0), a mesma língua (1,5),
    o mesmo país (1,0) e o mesmo estado (mais 1,0). Com o log, a fama pesa sem
    dominar: 1.000 seguidores valem uns 4,5 pontos a mais que 10, e uma escola
    em comum vale 2. Ficam fora a própria pessoa, quem ela já segue e as contas
    sem poema.
  - **No "Para você", um bloco "Quem seguir"** com 3 perfis aparece a cada 10
    itens, com "ver mais". A tela "Quem seguir" tem no topo uma busca por nome
    ou @, a mesma do Acervo (decisão 12).
- **O que cortamos e por quê:**
  - **A recomendação pelo histórico de leitura e de curtidas:** seria um
    ranking por engajamento com outro nome, e pediria guardar o que cada pessoa
    lê. A afinidade vem do que a pessoa diz que gosta, e ela muda quando
    quiser.
  - **O passo obrigatório:** quem chega para ler um poema não precisa passar
    por um formulário, e o "Para você" já abre cheio sem seguir ninguém.
  - **A intercalação fixa de poetas da rede e consagrados** (um de cada, #87),
    trocada pela nota (#91).

### 12. O Acervo: todos os poetas numa tela, com filtros

- **Contexto:** a tela Poetas do template era uma lista única de perfis. Com
  os 155 consagrados, de 20 línguas e da antiguidade a 1955, e os poetas da
  rede, achar quem ler pedia outra tela.
- **Opções:** manter a lista única da tela Poetas, ou um acervo com busca,
  filtros, ordem e páginas (#65).
- **Escolha:**
  - **Todos os perfis**, com o chip de tipo: "todos", "consagrados" ou
    "poetas do Verso" (#88).
  - **Busca pelo nome ou pelo @**, sem diferença de acento nem de maiúscula:
    "CAMÕES" acha @camoes.
  - **Filtros de língua e de época**, só para consagrados. A língua é a mais
    frequente nos poemas do poeta. A época é a faixa do ano de morte:
    Antiguidade, Idade Média e os séculos XVI a XX (este até 1955).
  - **Três ordens:** alfabética (a padrão), mais seguidos e mais poemas.
  - **Páginas numeradas**, de 24 poetas, com os filtros na URL: o link abre a
    mesma vista, e o voltar do navegador volta de página.
  - **O cartão é o perfil:** avatar, nome com selo, @, os anos de vida (no
    consagrado) ou a bio (no poeta da rede), poemas, seguidores e o botão
    seguir. O cartão inteiro leva ao perfil.
  - **O Acervo mora no Explorar**, como a aba "Poetas" (decisão 17, a pedido
    do Neto): com os mesmos filtros, a mesma paginação e os mesmos cartões, e
    os filtros na URL (`/explorar?aba=poetas&tipo=consagrados&lingua=pt`).
    "Acervo" continua o nome da coleção; a aba diz o que se acha nela.
  - **Um campo de busca só** (decisão do Neto): na aba Poetas, o campo do topo
    do Explorar vira a busca pelo nome ou @ ("Buscar poeta por nome ou @") e
    filtra a lista enquanto se digita, sem a lista de sugestões; o campo
    próprio do Acervo saiu. Nas outras abas, o campo continua buscando #tag ou
    poeta. Dois campos empilhados, um em cima do outro, buscavam poetas de dois
    jeitos diferentes.
  - **Links antigos:** `/acervo` e `?aba=acervo` redirecionam para a aba
    Poetas, levando os filtros e a página.
- **O que cortamos e por quê:** os filtros por escola literária, forma e
  país, e o trecho de poema no cartão. A afinidade por escola e forma já
  orienta as sugestões de quem seguir (decisão 11), e a forma tem o Explorar
  (decisão 3): o Acervo é para achar um poeta pelo nome, pela língua e pela
  época. O cartão é o perfil, e o poema se lê no perfil.

### 13. Mensagens diretas para o pessoal, crítica continua pública

- **Contexto:** quem escreve junto precisa combinar as coisas: quem abre a
  renga, quem convida quem, a leitura do sábado. Hoje isso sai do Verso para o
  WhatsApp, e o poema vai junto, como print. Mas a crítica de um poema serve
  também a quem a lê depois: o comentário sobre o verso 6 ensina a todos que
  passam pelo poema.
- **Opções:** nenhuma mensagem privada, com tudo na árvore de comentários (o
  corte da primeira versão); mensagens diretas que levassem também a crítica
  (citar e criticar versos numa DM); ou mensagens diretas só para o que é
  pessoal, com a crítica ficando na árvore pública.
- **Escolha:**
  - **Conversas 1-para-1, como no X.** A mensagem de quem você segue cai
    direto em "Conversas"; a de quem você não segue cai em **"Pedidos"**, e você
    aceita (vai para a caixa) ou recusa (some da sua lista e não volta, e quem
    mandou não é avisado). Responder um pedido também o aceita.
  - **O texto é gravado como veio**, com as quebras de linha e os recuos, e
    aparece em Literata: um verso mandado numa mensagem continua verso. Enter
    quebra a linha; Ctrl+Enter envia.
  - **Compartilhar um poema:** o botão "enviar por mensagem" do card manda o
    poema para uma conversa, e ele aparece como na citação. Apagado pelo autor,
    fica "poema removido pelo autor".
  - **Bloquear vale para a rede inteira, como no X.** Quem foi bloqueado não vê
    os poemas, as rengas nem o perfil de quem o bloqueou (como se não
    existissem), e nenhum dos dois segue, curte, comenta, reposta, cita, escreve
    na renga ou manda mensagem ao outro. Bloquear desfaz os follows nos dois
    sentidos, e um some do outro nos feeds, nas tags, no Explorar, nas rengas,
    no Acervo, nas listas de seguidores e nas sugestões; nenhum convida o outro
    para uma renga. Numa citação feita por outra pessoa, o poema de quem
    bloqueou aparece para o bloqueado como "poema indisponível". Os comentários
    de um nos poemas do outro somem para todos, como os apagados: com
    respostas, viram "comentário removido" e as respostas ficam; sem respostas,
    somem, também das marcas dos versos. Isso é um filtro na leitura, e não uma
    remoção: desbloquear traz os comentários de volta. Quem bloqueou ainda abre
    o perfil do bloqueado, mas só o cabeçalho, com o aviso de que bloqueou e o
    "Desbloquear": nada do que ele publicou, repostou ou juntou em antologias
    aparece. Também dá para desbloquear pela conversa. A
    conversa de mensagens fica, com o histórico, e desbloquear não refaz os
    follows. A renga de outra pessoa com estrofes dos dois aparece inteira.
  - **Silenciar** uma conversa a tira do contador.
  - **Contador e visto.** "Mensagens" na navegação mostra as conversas com
    mensagem não lida e os pedidos novos, e a conversa mostra "Visto" embaixo
    da sua última mensagem quando o outro leu. Ler um pedido não dá "visto" a
    quem mandou: só depois de aceitar.
  - **Em tempo real:** a mensagem aparece na outra tela sem recarregar
    (escolha técnica, abaixo).
  - **Consagrados não mandam nem recebem:** são contas sem login.
- **O que cortamos e por quê:**
  - **A crítica na mensagem:** a DM não tem crítica ancorada no verso nem
    citação de verso. A crítica de um poema serve também a quem a lê; numa DM,
    ela sai do lugar onde os outros leitores aprendem com ela.
  - **Grupos:** a conversa a várias mãos do Verso é a renga, que é pública.
  - **Áudio e imagem:** o Verso é texto, para o poema poder ser citado,
    copiado e traduzido; uma foto do caderno traria de volta o "poema em
    print".
  - **Apagar para todos:** como no comentário, mudar o que o outro já leu tira
    o sentido da conversa.
  - **Notificações push:** pediriam permissão do navegador e um serviço de
    entrega, e a conversa já chega em tempo real com a aba aberta.
  - **DM com consagrado:** não há quem responda.

### 14. Negrito, itálico, sublinhado e tachado no poema

- **Contexto:** quem escreve poesia usa o itálico para a voz de outra pessoa, o
  estrangeirismo ou a ênfase, e às vezes o negrito, o sublinhado ou o risco
  como recurso do poema. O texto do Verso era puro, e o poeta não tinha como
  marcar a palavra.
- **Opções:** continuar sem formatação; aceitar Markdown visível (o poeta
  digita `**` e vê os asteriscos enquanto escreve); ou um editor rico, como no
  Google Docs.
- **Escolha:**
  - **Um editor rico pequeno, configurado para poesia** (ProseMirror): o poeta
    seleciona e aperta Ctrl+B, Ctrl+I, Ctrl+U ou Ctrl+Shift+X, ou os botões
    B, I, U e S, e o trecho já aparece formatado. Enter é quebra de verso, Tab
    insere recuo, as linhas em branco e os espaços ficam, e o que se cola de
    fora entra como texto puro.
  - **O poema continua texto:** a formatação é gravada no próprio texto, num
    pedaço de Markdown (`**negrito**`, `*itálico*`, `++sublinhado++`,
    `~~tachado~~`). Uma marca nunca passa de um verso para o outro, então a
    numeração dos versos, a crítica ancorada (decisão 7) e a oficina
    (decisão 8) contam as mesmas linhas. Os poemas antigos e os dos consagrados
    não mudam: um `*` solto, como a nota de rodapé de Thomas Moore, continua
    um asterisco.
  - **Onde vale:** no poema, na citação, no rascunho e nas estrofes da renga.
    A tela formata o poema no feed, na página dele, no Em alta, nos versos
    citados e na tradução, sem interpretar HTML; copiar o poema dá o texto
    limpo.
- **O que cortamos e por quê:**
  - **Outras formatações** (títulos, listas, links, cores, tamanhos): o poema
    é verso, e cada uma dessas pediria regras de exibição no feed.
  - **Formatação nos comentários e nas mensagens diretas:** a conversa é sobre
    o poema, e o comentário continua texto puro.
  - **HTML livre:** abriria a porta para script e estilo de fora no feed. O
    formato tem só quatro marcas, e a tela as monta como elementos, nunca como
    HTML.

### 15. A infra: no ar sem cair e pronta para crescer

- **Contexto:** a banca e a turma vão criar contas e usar a URL pública ao
  mesmo tempo. A meta é 100 pessoas navegando sem cair, com p95 abaixo de 1 s,
  e sem custo. O que se publica lá não pode sumir.
- **Opções:**
  - **Render free com o SQLite do template:** o serviço dorme depois de uns
    15 minutos sem tráfego, tem 0,1 CPU e 1 worker, e o SQLite zera a cada
    restart.
  - **Um processo só numa VM:** a API era um serviço só, com 2 workers. Aguenta
    a carga, mas um processo que trava ou uma atualização tira o site do ar.
  - **Banco gerenciado no Supabase:** dá painel e backup, mas o banco fica
    fora da VM e o plano free aceita 15 conexões no total.
  - **Uma VM com várias réplicas da API atrás de um balanceador**, com o banco
    na mesma máquina. Foi a escolhida.
- **Escolha, em camadas:**

  | Camada | Tecnologia | Por quê |
  |---|---|---|
  | Front | **Vercel** (Next.js) | Servido pela CDN; cada push na `main` vira um deploy novo. |
  | Domínio | **`verso.net.br`** (Registro.br), DNS na Vercel | `verso.net.br` e `www` vão para o front; o registro A `api.verso.net.br` vai para o IP da VM. |
  | Máquina | **VM Oracle Always Free**, Ampere A1 (ARM), São Paulo | Não dorme. Hoje 2 OCPU e 12 GB; o gratuito vai até 4 OCPU e 24 GB. |
  | Serviços | **Docker Compose** | Um arquivo sobe o banco, o seed, as réplicas, o Caddy e o backup, numa rede interna. |
  | Entrada e balanceador | **Caddy 2.10** | Único serviço com porta aberta (80 e 443). HTTPS automático (Let's Encrypt, ZeroSSL de reserva) e balanceamento entre as réplicas. |
  | API | **FastAPI no uvicorn**, réplicas `api_1` a `api_4`, 1 worker cada | 2 réplicas na VM de 2 OCPU (o padrão), 4 na de 4 OCPU, escolhidas por `COMPOSE_PROFILES` e `REPLICAS_DA_API` no `.env`. |
  | Banco | **Postgres 16** na mesma VM | Sem porta pública. Ida e volta de 0,06 ms; teto de `max_connections` 60. |
  | Backup | **`pg_dump` diário** e cópia no **Object Storage da Oracle** | Às 03:30, com 7 diários e 4 semanais; `restaurar.sh` testa e restaura. |
  | Monitoramento | **UptimeRobot** no `/saude` a cada 5 min; Sentry opcional | Avisa por e-mail se a API cair. |

  ```text
  navegador ──> verso.net.br ──────> Vercel (CDN, o front)
      │
      └── HTTPS ──> api.verso.net.br ──> VM Oracle A1 (Docker Compose)
                      caddy ──┬──> api_1 ──┐
                              └──> api_2 ──┴──> db (Postgres 16)
                      (api_3 e api_4 só na VM de 4 OCPU)      │
                      backup: pg_dump diário <────────────────┘
                              └──> Object Storage da Oracle
  ```

  - **O balanceador** (`deploy/oracle/caddy/Caddyfile`):
    - **Health check ativo:** `GET /saude` em cada réplica a cada 2 s. Duas
      falhas seguidas tiram a réplica da roda; uma resposta boa a devolve.
    - **Health check passivo:** uma requisição que não conecta tira a réplica
      por 10 s, sem esperar o próximo `/saude`. Um 500 da API não conta.
    - **Nova tentativa noutra réplica:** até 2 vezes, por até 5 s. Se a
      conexão falhou, a requisição não chegou à API e qualquer método é
      repetido. Se ela chegou e a resposta falhou no meio, só `GET` e `HEAD`
      são repetidos: um `POST` (publicar, curtir, mandar mensagem) nunca vai
      duas vezes.
    - **Política:** `round_robin` nas rotas comuns e `least_conn` no stream das
      mensagens (`/mensagens/stream`), que espalha os streams entre as
      réplicas.
  - **A API não guarda estado em memória**, e é isso que deixa balancear: o
    índice de tags está na tabela `post_tags`, o limite de traduções é contado
    na tabela `traducoes`, as mensagens diretas chegam em tempo real pelo
    LISTEN/NOTIFY do Postgres, inclusive as que saem de outra réplica, e no
    SIGTERM a réplica fecha na hora os streams, que reconectam noutra (ver "Uma
    escolha técnica").
  - **O banco não estoura.** Cada worker tem um pool de 4 conexões mais 2 de
    folga (`backend/app/db.py`) e deixa no máximo 6 requisições usando o banco
    ao mesmo tempo; as outras esperam numa fila, sem segurar thread nem conexão
    (`backend/app/limite_do_banco.py`). A conta fecha no `max_connections` de
    60: 2 réplicas × (4 + 2 + 1 do LISTEN) = 14, e 4 réplicas, 28, mais 8 de
    folga para o backup, a restauração, o seed e a manutenção.
  - **Os dados ficam.** O seed roda só num banco vazio (#55), então o que se
    publica na URL pública continua lá. Cada dump leva no nome a data e a hora
    (UTC) e o hostname da VM, então nenhum backup sobrescreve outro.
- **Como evita quedas:**
  - Uma réplica que trava, morre ou está sendo atualizada sai da roda em
    segundos, e as outras atendem.
  - O `atualizar.sh` troca a versão uma réplica de cada vez: espera a nova
    responder ao `/saude` antes de parar a próxima. Um `Caddyfile` novo entra
    com `caddy reload`, sem fechar conexão.
  - Medido com 100 usuários e os 100 streams das mensagens abertos: derrubar
    uma réplica no meio da carga deu 0 erro nas leituras e nos envios; o
    `atualizar.sh` levou 28 s com 2 réplicas e 52 s com 4, com 0 erro nas
    leituras (com 4 réplicas, 2 envios de mensagem deram 502 e a pessoa
    reenvia). Os streams voltaram noutra réplica em 1,0 a 1,4 s (mediana). O
    `Caddyfile` novo durante a carga: 0 falha em 300 `curl`.
  - **1 worker por réplica**, e não 2: com 2, o processo pai do uvicorn segura
    a porta aberta enquanto os workers desligam, e derrubar uma réplica deu 39
    erros nas leituras e 4 nos envios. Com 1, a porta fecha na hora e o Caddy
    tenta outra.
  - O que isto não cobre: a VM inteira cair, porque todas as réplicas estão
    nela. Aí o backup do Object Storage volta numa VM nova, e perde-se no
    máximo um dia.
- **Como escala, em degraus:**
  1. **Hoje:** VM de 2 OCPU e 12 GB (a de 4 OCPU não saiu: faltou capacidade
     na Oracle) com 2 réplicas.
  2. **VM de 4 OCPU e 24 GB, ainda de graça:** 4 réplicas, trocando duas
     linhas do `.env` (`COMPOSE_PROFILES=4-ocpu` e `REPLICAS_DA_API`) e
     rodando `./atualizar.sh --sem-pull`. Sem pausa, a vazão sobe de 104–106
     para 153–154 req/s.
  3. **O próximo degrau** seria sair de uma VM só. Ainda não está feito nem
     medido.

  **Medido no compose local**, com o seed completo (184 usuários, 11.336
  poemas) e o `db`, as réplicas e o `caddy` presos a 4 ou a 2 núcleos, 100
  usuários, 1 worker por réplica (req/s sem pausa e p95 com pausa de 3 s):

  | Réplicas | 4 núcleos | 2 núcleos |
  |---|---|---|
  | 2 | 104–106 req/s, p95 73–80 ms | **92 req/s, p95 67 ms** |
  | 3 | 127–132 req/s, p95 67–72 ms | 87–90 req/s, p95 65–69 ms |
  | 4 | **153–154 req/s, p95 62–63 ms** | 82–86 req/s, p95 67–68 ms |

  Em 4 núcleos, cada réplica a mais rende; em 2, além de duas elas só
  disputam a CPU com o Postgres. Por isso 2 réplicas na VM de 2 OCPU (o
  padrão) e 4 na de 4. Antes das réplicas, com um processo só, 2 workers ×
  (4 + 2) deram nos 4 núcleos p95 de 47 a 48 ms com pausa de 3 s e de 0,8 a
  0,92 s sem pausa, 0 erro; 4 workers empataram com pausa e oscilaram sem
  pausa (0,84 a 2,2 s). Com 2 núcleos, o p95 sem pausa passava de 1,1 s.

  **Em produção (2026-11-25)**, na VM de 2 OCPU com 2 réplicas, o mesmo
  `carga.py` (só as 14 rotas de leitura, sem streams nem mensagens, um
  login só, da `marina_letras`) rodado da rede doméstica do Neto até São
  Paulo, com a internet no meio: o `/saude` sozinho, com a conexão aberta,
  leva de 84 a 197 ms (mediana), e é essa a base de cada número abaixo.
  0 erro em todas as etapas:

  | Usuários, pausa média | Duração | req/s | p50 | p95 | p99 |
  |---|---|---|---|---|---|
  | 10, 3 s | 20 s | 2 | 178 ms | 402 ms | 957 ms |
  | 50, 3 s | 30 s | 13 | 103 ms | 209 ms | 382 ms |
  | 100, 3 s | 30 s | 28 | 108 ms | 249 ms | 348 ms |
  | 100, sem pausa | 30 s | 61 | 1.438 ms | 2.617 ms | 6.839 ms |

  Com 100 pessoas navegando, a vazão é a mesma do local (28 contra 26 a 28
  req/s) e o p95 de 249 ms é quase todo internet: tirada a base, sobra
  perto dos 67 ms do compose local. Sem pausa, a VM real rende 61
  req/s, dois terços dos 92 do compose local preso a 2 núcleos, com p95
  de 2,6 s; esse é o teto das 2 OCPU, longe do uso de uma turma.
- **O que cortamos e por quê:**
  - **Kubernetes ou outro orquestrador:** é peça demais para uma VM só. O
    Docker Compose sobe tudo com um arquivo, e o `atualizar.sh` faz a troca
    sem queda.
  - **`deploy.replicas` do Compose:** recriaria todas as réplicas juntas. Com
    réplicas com nome (`api_1`, `api_2`...), o Caddy alcança cada uma e o
    `atualizar.sh` reinicia uma de cada vez.
  - **O banco gerenciado (Supabase):** cada request faz várias consultas, e
    cada uma pagaria a rede até fora da VM; o plano free aceita 15 conexões
    para a API, o seed, o backup e o SQL Editor juntos. Ele fica documentado
    como alternativa (`deploy/oracle/compose.supabase.yaml`,
    `docs/deploy-oracle.md`).
  - **O Render free:** dorme depois de uns 15 minutos sem tráfego, e a
    primeira visita leva cerca de 1 minuto. Fica como plano B, com o Supabase (`docs/deploy.md`).

### 16. Avisos: a conversa chega a quem escreve

- **Contexto:** na primeira versão, cortamos as notificações para não trazer de
  volta a lógica do engajamento (ver "O que ficou de fora"). Na prática, quem
  publica um soneto não sabe que alguém criticou o verso 6 nem que a estrofe
  seguinte da renga chegou, e a conversa morre sem resposta. A crítica e a renga
  só funcionam se a pessoa volta para responder.
- **Opções:** nenhum aviso (o corte anterior); avisos só da conversa
  (comentário, crítica, resposta, estrofe); ou avisos gerais, como no X, com
  curtidas, seguidores, reposts e citações também (decisão do Neto).
- **Escolha:**
  - **Avisos gerais**, numa página "Avisos" com um contador no menu, como o de
    Mensagens: curtida, novo seguidor, repost, citação (também a de versos),
    comentário, crítica ("criticou os versos 5–8 do seu poema"), resposta ao seu
    comentário, nova estrofe na renga que você criou ou em que escreveu, e
    convite para renga.
  - **Na renga, o poema é de todos:** o comentário geral avisa o criador e todos
    os autores de estrofe; a crítica avisa o criador e só os autores das estrofes
    que os versos tocam; a resposta avisa quem foi respondido e o criador
    (decisão do Neto).
  - **A resposta no poema avisa duas pessoas:** quem foi respondido ("respondeu
    ao seu comentário") e o autor do poema ("comentou seu poema"), porque a
    conversa é no poema dele (decisão do Neto).
  - **Quem não recebe:** quem fez a ação, os consagrados (não têm login) e quem
    tem bloqueio, em qualquer sentido, com quem agiu ou com o dono do poema ou da
    renga. Um bloqueio feito depois esconde os avisos antigos da outra pessoa.
  - **Desfazer apaga o aviso:** descurtir, desfazer o repost, deixar de seguir,
    apagar o comentário ou o poema. O aviso não fica dizendo que alguém curtiu o
    que já não curte.
  - **Curtidas e reposts de um poema numa linha por dia:** "Ana e mais 3
    curtiram seu poema" hoje, outra linha ontem (decisão do Neto). O dia é o de
    Brasília. Sem o dia, a curtida de hoje entraria na linha das do mês passado. O
    comentário e a crítica nunca se agrupam: cada um tem o seu texto, e a linha
    mostra o começo dele.
  - **O contador conta linhas da tela, não ações** (decisão do Neto): as 20
    curtidas de hoje num poema contam 1, como a linha que a pessoa vai ler.
  - **Cada linha leva ao lugar certo:** o poema; a crítica abre o poema com os
    versos selecionados (`/poema/7?versos=5-8`); a renga; o perfil de quem seguiu.
  - **Em tempo real, pelo stream das mensagens:** o contador sobe sem recarregar
    e zera ao abrir a página, também nas outras abas.
  - **Bloqueio feito depois esconde, não apaga** (decisão do Neto): os avisos
    antigos de quem foi bloqueado somem da lista e do contador; desbloquear os
    traz de volta, como os comentários (decisão 13).
  - **No celular, a barra de baixo ficou com seis botões** (decisão do Neto):
    Início, Explorar, Escrever, Avisos e Mensagens, os dois com contador, e o
    avatar, que leva ao perfil. Com os Avisos, seriam dez ícones de 36 px em
    360 px; o resto achou lugar na decisão 17.
  - **A ordem é cronológica**, como o feed (decisão 3): o aviso mais recente
    primeiro, nunca "os mais curtidos".
- **O que cortamos e por quê:**
  - **Push e e-mail:** pediriam permissão do navegador, um serviço de entrega e
    um opt-out por tipo; com a aba aberta, o aviso já chega em tempo real.
  - **Mensagem direta nos avisos:** já tem o contador próprio em Mensagens
    (decisão 13), e contar duas vezes a mesma conversa confunde.
  - **Escolher que avisos receber:** um painel de preferências por tipo é mais
    uma tela para manter; ficou para depois, se alguém pedir.
  - **"Renga encerrada" e "atingiu o limite":** quem escreveu vê a renga fechada
    no feed (decisão 10). Também não há aviso de desbloqueio.

### 17. Navegação enxuta: cinco destinos e um botão de escrever

- **Contexto:** a cada feature a navegação ganhou um item: Antologias,
  Rascunhos e Rengas se somaram a Início, Explorar, Escrever, Acervo, Avisos,
  Mensagens e Perfil, e o "Escrever" aparecia duas vezes (o item e o botão
  grande "Escrever poema"). Dez entradas na barra lateral para quem quer ler um
  poema ou escrever um. Antes o Neto quis os Rascunhos na navegação (decisão
  9); agora pediu a limpeza (decisão do Neto).
- **Opções:** manter tudo na barra; esconder o resto num "Mais" também no
  computador; ou levar cada coisa para onde ela é usada: o que é meu para o
  perfil, o que é de todos para o Explorar, o que se cria para o "Escrever".
- **Escolha:**
  - **A barra lateral tem cinco destinos e um botão:** Início, Explorar,
    Avisos, Mensagens e Perfil, e o "Escrever", o único botão de criar. O
    Acervo saiu dela num segundo passo (decisão do Neto): achar um poeta é
    explorar, e ele virou uma aba do Explorar, como as rengas e as antologias.
  - **"Escrever" leva direto ao compositor, no poema** (decisão do Neto): o
    poema nunca custa um clique a mais. No topo do compositor, um seletor
    "Poema · Renga · Antologia" troca de formato e leva aos fluxos de criação
    (`/rengas/nova` e `/antologias/nova`, esta nova, com o mesmo formulário),
    que mostram o mesmo seletor. São três links, com `aria-current` no formato
    atual, e não abas nem um modal, porque trocar de formato é trocar de
    página; o "voltar" volta para onde a pessoa estava antes do "Escrever".
    O seletor some na citação e no rascunho aberto, que já têm formato. Uma
    primeira versão punha o seletor num menu do próprio botão, e o poema
    custava dois cliques.
  - **O poema começado não se perde na troca** (decisão do Neto). Para a
    renga, o corpo vira a 1ª estrofe e o título vira o da renga, os dois
    editáveis; passam pelo `sessionStorage` da aba, lidos uma vez e apagados,
    nunca pela URL, para o texto não ficar no histórico nem num link. Para a
    antologia, que não tem onde pôr o poema, a pergunta aparece ali mesmo, no
    padrão da confirmação inline: "Descartar o poema?", com "salvar como
    rascunho" (salva e segue), "descartar" e "continuar escrevendo", que já
    vem com o foco (Esc e clique fora também continuam). Sem poema, troca
    direto.
  - **Rascunhos no perfil:** a aba "Rascunhos" do próprio perfil (decisão 9).
    Visitantes não veem a aba, e `?aba=rascunhos` no perfil alheio abre Poemas.
    As antologias próprias, privadas inclusive, já eram a aba Antologias.
  - **Acervo, rengas e antologias no Explorar:** abaixo da busca, as abas
    Poemas, Poetas (o Acervo), Rengas e Antologias, com a aba na URL
    (`?aba=rengas&situacao=aberta`, `?aba=poetas&tipo=consagrados`). Poetas
    vem logo depois de Poemas: são os dois jeitos de achar o que ler, pelo
    poema ou pelo poeta, e as rengas e as antologias, que são poemas
    reunidos, ficam juntas no fim. Os filtros, a paginação e os cartões do
    Acervo são os mesmos da tela antiga (decisão 12), num componente só, e a
    busca pelo nome é o próprio campo do topo do Explorar. Trocar de aba
    começa a outra sem filtro. O "ver todos os poetas" da busca do topo abre
    a aba Poetas com o nome buscado. As rengas filtram Todas, Abertas,
    Fechadas e Minhas (as que criei, em que escrevi ou para as quais fui
    convidado; `GET /rengas?minhas=true`). Com uma tag escolhida, a tela é o
    resultado dela e as abas somem, como na busca do X.
  - **No celular**, a barra é Início, Explorar, Escrever, Avisos, Mensagens e o
    meu avatar, que leva ao perfil (decisão do Neto; antes era um "Mais"). O
    Acervo é a aba Poetas do Explorar, como no computador (o atalho que havia
    no topo do Explorar saiu); sem login, a barra é Início, Explorar,
    Escrever e "Entrar"; Preferências e "Sair" ficam no botão de ajustes do meu
    perfil, ao lado de "Editar perfil" (no computador, também no menu da conta).
  - **Nenhum link quebra:** `/rascunhos` e `/antologias` levam às abas do
    perfil, `/rengas` e `/acervo` (e o `?aba=acervo`) às abas do Explorar,
    com os filtros e a página (`/usuarios`, a tela Poetas de antes, também
    vai à aba Poetas), e
    `/rengas/{id}` e `/antologias/{id}` continuam onde estavam, inclusive para
    os avisos.
  - **O nome no perfil, no celular, fica embaixo do avatar e dos botões**, na
    largura toda, como no X, e quebra só entre palavras; com mais de 20
    caracteres, a fonte desce um passo. Espremido entre o avatar e os botões,
    "Albuquerque" partia no meio.
    No cabeçalho fixo do topo, o nome longo fica numa linha e termina em
    reticências.
- **O que cortamos e por quê:** os itens Antologias, Rascunhos, Rengas e
  Acervo da navegação, o atalho do Acervo no topo do Explorar no celular, o
  item "Escrever" repetido ao lado do botão, o "Mais" do celular, o campo de
  busca próprio do Acervo e as páginas próprias "Minhas antologias",
  "Rengas" e "Acervo" (viraram abas). A rota da lista de rengas, a das
  minhas antologias e a do Acervo só redirecionam, para os favoritos e links
  antigos.

### 18. Dicas do livro: um tour aos poucos, não de uma vez

- **Contexto:** quem chega não sabe que o Verso se folheia, que a conversa
  fica na página ao lado nem o que são os ícones sem texto da lombada
  (decisão 17).
- **Opções:** nenhuma ajuda; um tour de várias telas logo depois do
  onboarding; ou dicas curtas no contexto de cada coisa, ao longo do uso.
- **Escolha (decisão do Neto):**
  - **Quatro dicas, uma de cada vez, no contexto delas:** virar a página (ao
    chegar no Início, depois das boas-vindas), as ações e os comentários, a
    lombada e escrever (poema e renga). Depois da primeira, cada uma espera a
    pessoa folhear 2 páginas, e a de escrever também aparece ao abrir o
    compositor. Cada nota aponta o que explica, sai com "entendi", o X, Esc
    ou virando a página, e tem "dispensar todas".
  - **O que foi visto fica na conta** (`GET`/`PUT`/`DELETE /dicas`), e não no
    navegador: a dica vista no computador não volta no celular. As contas que
    já existiam também veem as dicas; quem não tem conta não vê.
  - **"Rever as dicas", nas Preferências,** zera a lista, e elas voltam aos
    poucos.
- **O que cortamos e por quê:** o tour de uma vez só (ninguém lembra de dez
  telas antes de ler o primeiro poema), a numeração "dica 1 de 4" (o tour não
  é uma tarefa a cumprir) e uma biblioteca de tour (as notas são um componente
  só, sem dependência).

### O que ficou de fora e por quê

Cada corte foi pensado para quem lê e escreve poesia, em 12 dias de prazo
(16/11 a 27/11), com o código a partir de 23/11. Os cortes que mais dizem
sobre o produto:

- **Ranking por engajamento** (decisão 3). Ordenar por curtidas enterra o poema
  longo e o poeta com poucos seguidores, que é o problema que o Verso existe
  para resolver. Os dois feeds e o "Em alta" são cronológicos ou por tema.
- **Recomendação pelo histórico** (decisão 11). Seria o mesmo ranking com outro
  nome e pediria vigiar o que cada um lê. A sugestão vem do que a pessoa diz
  que gosta.
- **Editar o poema publicado** (decisão 9). A crítica do verso 6 e a citação de
  um verso só fazem sentido se o verso continua lá. O poema amadurece no
  rascunho.
- **Editar comentários** (decisão 4). Mudar uma crítica depois de respondida
  tira o sentido da conversa.
- **A crítica em mensagem direta** (decisão 13). As mensagens diretas existem
  para o que é pessoal; a crítica de um poema serve também a quem a lê, e fica
  na árvore pública. Também ficaram de fora os grupos, o áudio e a imagem, o
  apagar para todos e as notificações push.
- **Stories.** Somem em 24 horas, e um poema é feito para ficar. Seria também
  o formato da imagem, que é o problema do Instagram.
- **Upload de imagem.** O poema é texto para poder ser citado, copiado e
  traduzido; uma imagem no post traria de volta o "poema em print". O avatar é
  só uma URL.
- **Push e e-mail dos avisos** (decisão 16). Os avisos ficam na página
  Avisos, em tempo real com a aba aberta; o celular não vibra a cada curtida.
- **Busca por palavra.** Quem procura poesia costuma procurar por tema
  ("#chuva") ou por forma ("haicai"), e é isso que o Explorar faz, com o índice
  invertido. Texto livre em poemas sem limite pediria um índice de texto
  completo.
- **Enquetes.** Não ajudam ninguém a escrever nem a ser lido.
- **Os modernos famosos e as traduções humanas** (decisão 2). Têm direitos
  autorais; preferimos um acervo legal, no original, com tradução por IA
  marcada como tal.
- **Bloqueio de forma e oficina na leitura** (decisão 8). O soneto de 13
  versos é decisão do poeta, e o leitor lê o poema, não a métrica.
- **Turnos fixos na renga** (decisão 10). Esperar a vez de quem sumiu trava o
  poema de todos. E as regras da renga não mudam depois de aberta: quem entrou
  aceitou aquelas regras.

## Features

O dono é a pessoa responsável pela issue da feature, inclusive quando a
implementação foi feita por um subagent a pedido do Neto (ver "Uso de IA").

| Feature | Dono | Por quê (1 frase) |
|---|---|---|
| Auth (núcleo) | Pedro | Consagrados existem como contas sem login; o resto entra com senha. |
| Cadastro e login (telas) | Pedro | O fluxo do vídeo começa aqui, com erros em português no campo certo. |
| Posts/poemas (núcleo) | Henrique | Título, corpo sem limite e forma: o poema como unidade, não como tweet. |
| Feed (núcleo) | Henrique | Cronológico e com reposts como no X: você vê o que quem você segue escreveu hoje. |
| Feed Para você | Neto | A rede inteira em ordem cronológica, para o feed não começar vazio para quem acabou de chegar. |
| Boas-vindas e sugestões por afinidade | Neto | Quem chega diz que poesia gosta e de onde é, e recebe poetas para seguir por escola, forma e região. |
| Curtidas (núcleo) | Henrique | Um retorno mínimo para quem publica, sem virar ranking. |
| Comentários em árvore | Henrique | A crítica de poema vira conversa, não uma lista solta. |
| Repost + citação | Henrique | Citar um verso é o gesto central de quem lê poesia. |
| PoemaCard, compositor e página do poema | Henrique | Quebras e recuos preservados na tela, e o poema longo cortado no fim da estrofe. |
| Perfil (núcleo) e selo de consagrado | Pedro | Mostra o selo e os anos de vida dos consagrados. |
| Layout em 3 colunas e tipografia | Pedro | Uma coluna de leitura em Literata e a coluna Descobrir ao lado. |
| Antologias | Pedro | O leitor monta coleções ("Poemas de chuva"), como uma antologia de verdade. |
| Follow (núcleo) | Neto | Seguir um consagrado traz os clássicos para o feed. |
| Seed fake (núcleo) | Neto | A demo abre com 29 poetas fictícios de vários lugares e idades (alguns universitários) e 78 poemas em todas as formas. |
| Consagrados (importador e dados) | Neto | 155 poetas de domínio público, no original, convivem com os poetas da rede. |
| Acervo | Neto | Todos os poetas, consagrados e da rede, para achar quem ler por língua e época. |
| Formas/temas, Em alta e Explorar | Neto | Descobrir sonetos, haicais e temas, e ver sobre o que a rede escreve. |
| Tradução por IA | Neto | Lê-se Li Bai e Baudelaire no original, com a tradução a um clique. |
| Crítica ancorada no verso | Neto | A crítica de oficina aponta o verso, como na margem do caderno. |
| Oficina: sílabas e rimas no compositor | Neto | Quem escreve vê o metro e as rimas enquanto escreve, e desliga se não usa. |
| Rascunhos e poema publicado imutável | Neto | O poema amadurece em privado, e a conversa sobre um verso não perde o verso. |
| Rengas | Neto | Várias pessoas escrevem um poema junto, estrofe por estrofe. |
| Avisos | Neto | Quem escreve fica sabendo da crítica, da resposta e da estrofe nova, e volta para continuar a conversa. |
| Mensagens diretas | Neto | Combinar uma renga ou mandar um poema a alguém sem sair do Verso, com a crítica continuando pública. |
| Negrito, itálico, sublinhado e tachado no compositor | Neto | O poeta marca a palavra como no Google Docs, e o poema continua texto, com os mesmos versos. |
| Ícone e cartão de compartilhamento | Neto | O link do poema no WhatsApp ou no X já mostra o título, os primeiros versos e o autor. |
| Deploy (Vercel + VM da Oracle com API e Postgres) | Neto | A banca usa a rede na URL pública, e os dados não somem: backup diário no Object Storage. |

## Uma escolha técnica

### Índice invertido de tags: da memória para o banco

A descoberta por forma e tema (decisão 3) depende de responder rápido a três
perguntas: "quais poemas têm `#saudade`?", "sobre o que a rede está escrevendo
nas últimas 24 h?" e "que tags começam por `sa`?". Procurar a tag no texto de
todos os poemas a cada request custaria O(n·L), com L o tamanho do poema, e
poemas não têm limite. A resposta é um **índice invertido**: tag → poemas.

**Primeira versão: em memória.** O `IndiceTags` guardava `dict tag →
{post_id: criado_em}` e o inverso `post_id → tags` num singleton do processo,
reconstruído do banco no startup em O(n·t). Funcionava, mas com estado no
processo: com dois workers (ou duas instâncias), cada um teria o seu índice, e
o poema publicado num não apareceria no "Em alta" do outro. O limite de 30
traduções por hora tinha o mesmo problema (uma janela deslizante por processo
deixaria pedir 30 em cada um). Para aguentar 100 pessoas ao mesmo tempo com
vários workers, a API precisava ficar **sem estado em memória**.

**Agora: no banco.** O índice é a tabela `post_tags (post_id, tag, criado_em)`
(`models/post_tag.py`), gravada por `services/indice_tags.py` **na mesma
transação** que publica ou apaga o poema (e no importador de consagrados e no
seed). Chave primária `(post_id, tag)`, índices em `(tag, criado_em, post_id)`
e em `(criado_em)`. O `core/indice_tags.py` ficou com o que é lógica, em Python
puro: `normalizar` e `extrair_tags` (casefold e sem acento: `#Solidão` e
`#solidao` são a mesma tag; a forma e as `tags_extras` dos consagrados também
entram), `top_k` (heap de tamanho k sobre as contagens) e `representantes` (um
poema diferente por tag no "Em alta"). O limite de tradução conta as linhas da
própria pessoa em `traducoes` na última hora, pelo índice
`(pedida_por_id, created_at)`. O boot não reconstrói nada (o lifespan com o
seed caiu de 774 ms para 5 ms).

**Com vários workers, medido** (`backend/scripts/carga.py`, 100 usuários, mix
de 14 rotas, API, Postgres e Caddy nos 4 núcleos da VM, 2 workers × pool 4 +
2): 27 req/s, p95 de 47 a 48 ms e 0 erro com pausa média de 3 s; 146 a 156
req/s, p95 de 0,8 a 0,92 s e 0 erro sem pausa, com 100 requisições sempre em
voo.

**Big O** (R = linhas de `post_tags`, t = tags do poema, p = poemas da tag,
w = linhas na janela de 24 h, m = tags distintas na janela, k ≤ 10):

| Operação | Custo | Quando roda |
|---|---|---|
| `indexar` / `remover` | O(t log R), inserir e apagar nas B-trees | publicar e apagar poema |
| `posts_da_tag` | O(log R + offset + limit) a página, O(log R + p) o total | `/tags/{tag}/posts`, Explorar |
| filtro tag + forma | JOIN `posts` × `post_tags` pela tag | `/explorar?tag=&forma=` |
| `trending` | O(log R + w) no banco + O(m log k) no heap | `/tags/trending` |
| `representantes` | só os k mais novos de cada tag (ROW_NUMBER): O(k²) linhas, O(k²) no core | o verso de cada tag no "Em alta" |
| `buscar` | O(R) no pior caso (o `LIKE 'sa%'` nem sempre usa índice) + O(T' log k) | `/tags/busca` |
| limite de tradução | O(log n + 30) | cada tradução nova |
| `popular` | O(n·t), uma vez | banco antigo (`scripts/popular_post_tags.py`) |

O `representantes` só precisa dos k mais novos de cada tag: a i-ésima tag do
"Em alta" encontra no máximo i poemas já usados pelas de cima, então o mais
novo livre dela está entre os i + 1 mais novos.

**Medição.** O `make bench` roda `backend/scripts/bench_indice_tags.py`: a
mesma massa sintética (posts com 1 a 4 tags de um vocabulário de 67,
espalhados por 14 dias, semente fixa) vai para dois SQLite locais com a tabela
`post_tags`, um com os índices e outro sem (varredura linear das R linhas). Os
dois rodam as mesmas funções de `services/indice_tags.py` que a API usa; o
script confere que devolvem o mesmo resultado e mede a mediana de 7 rodadas:

```
   posts |  linhas | consulta     |  índice (ms) | varredura (ms) |   ganho
---------------------------------------------------------------------------
    1000 |    2537 | posts_da_tag |        0.226 |          0.366 |    1.6x
    1000 |    2537 | trending     |        0.194 |          0.294 |    1.5x
    1000 |    2537 | busca        |        0.192 |          0.253 |    1.3x
   10000 |   25051 | posts_da_tag |        0.243 |          1.608 |    6.6x
   10000 |   25051 | trending     |        0.274 |          1.550 |    5.7x
   10000 |   25051 | busca        |        0.943 |          1.670 |    1.8x
  100000 |  250573 | posts_da_tag |        0.365 |         17.321 |   47.5x
  100000 |  250573 | trending     |        0.992 |         16.328 |   16.5x
  100000 |  250573 | busca        |       10.141 |         17.029 |    1.7x
```

Os números seguem a tabela de Big O. Com índice, `posts_da_tag` quase não
cresce com a rede (0,2 ms → 0,4 ms de 1k para 100k posts), enquanto a varredura
cresce junto com R: o ganho vai de 1,6x a 47x. O `trending` lê só a janela de
24 h e ganha 16x em 100k (na versão em memória ele empatava com a varredura,
porque percorria todos os posts). A `busca` por prefixo quase não ganha (1,3x a
1,8x): o `LIKE` conta as linhas das tags que casam, e é o próximo passo se a
rede crescer.

**Se a rede crescesse 100 vezes:**

- A busca por prefixo ganharia uma tabela `tags (tag, poemas)` com o contador
  mantido na escrita: o prefixo viraria um intervalo no índice da tag, O(log T
  + k), sem contar linhas.
- O trending guardaria contagens por hora (`tag, hora, n`), somando as 24
  horas da janela: O(24·m) em vez de O(w).
- O `total` de `posts_da_tag` (O(p)) viraria esse mesmo contador por tag.

### Também em `core/`, mais curtas

- **Árvore de comentários (`core/arvore_comentarios.py`).** `montar` recebe
  tuplas `(id, parent_id, created_at, payload)` e aninha os filhos. A árvore é
  montada só sobre o que a página carregou: k = as respostas da página mais as
  prévias, e não todos os comentários do poema. Agrupar por pai (um dict
  `parent_id → filhos`) e montar recursivamente são O(k). A ordenação é
  O(k log k) no pior caso, e o Timsort aproveita os trechos que já vêm
  ordenados do banco. **Não é um singleton:** o texto e o autor de cada
  comentário vêm do banco de qualquer jeito, então uma árvore em memória não
  pouparia a ida ao banco, custaria O(total de comentários da rede) no
  startup e seria uma por worker.
- **Limite de tradução numa janela deslizante.** 30 traduções novas por
  pessoa nos últimos 60 minutos, contadas direto em `traducoes` com o índice
  `(pedida_por_id, created_at)`: O(log n + 30), igual em todo worker. Uma
  janela fixa ("30 por hora cheia") deixaria pedir 60 em dois minutos, na
  virada da hora. Antes era um `dict usuário → deque` em memória
  (`core/janela_deslizante.py`), reconstruído no startup; saiu pelo mesmo
  motivo do índice de tags.
- **Métrica e rima (`core/metrica.py`).** São funções puras, sem estado, por
  isso sem singleton. `silabas_poeticas` divide o verso em núcleos vocálicos e
  aplica sinalefa na fronteira das palavras e sinérese depois da tônica.
  `terminacao_rimica` normaliza a terminação pelo som (ç, ss e c antes de e/i
  viram "s"), e `esquema_de_rimas` agrupa os versos da estrofe por terminação
  num dict: a rima é consoante quando as terminações são iguais a partir da
  vogal tônica, e toante (mesmas vogais) só para o verso sem par consoante.
  Tudo é O(L) no tamanho do texto. A rota `POST /oficina/analise` não usa o
  banco e aceita até 10.000 caracteres; o poema em si continua sem limite.
- **Marcas de formatação (`core/marcas.py`).** Lê o negrito, o itálico, o
  sublinhado e o tachado de cada verso numa passada da esquerda para a
  direita, com uma pilha de marcas abertas: O(L) no tamanho do verso; um
  delimitador que abre e não fecha vira literal e a passada recomeça, O(d·L) no
  pior caso, com d delimitadores no verso. Sem estado. `texto_sem_marcas` é o
  que a oficina mede e de onde saem as `#tags`; o front tem a mesma regra em
  `lib/marcas.ts`, e os dois lados rodam os mesmos casos de teste.
- **Mistura do "Para você" (`core/mistura.py`).** Recebe as atividades da
  rede (poemas, reposts puros, estrofes de rengas abertas, comentários),
  carregadas só com ids e datas. `rarear_consagrados` guarda um poema de
  consagrado por janela de 3 horas num dict janela → poema, em O(n): o mais
  recente na língua de quem vê (a do navegador ou, sem ela, a dos poemas da
  pessoa) e, se a janela não tiver nenhum nessa língua, o mais recente. A
  janela é fixa no relógio, então a escolha não depende da página pedida.
  `misturar` ordena da atividade mais recente para a mais antiga, O(n log n),
  e deixa um item por poema ou renga, com quem está no rótulo, em O(n).
  Memória O(n). **O cursor fica estável com tipos misturados:** poema,
  estrofe e comentário vêm de tabelas diferentes e podem ter o mesmo id e a
  mesma data, então a posição é (data, chave), com chave 3·id + 2 para post,
  3·id + 1 para estrofe e 3·id para comentário, única entre as três e
  crescente com o id. Não é singleton: é montada por request, como a árvore
  de comentários.
- **Nota das sugestões (`core/pontuacao_sugestoes.py`).** Uma função pura,
  `nota(conta, quem_ve)`, com os pesos em constantes no topo do arquivo, e
  `ordenar`, que desempata pelo poema mais recente e depois pelo id, para a
  ordem ser estável. Com c contas candidatas: a nota é O(e + f) por conta (e
  e f = escolas e formas, com interseção de conjuntos), e ordenar é
  O(c log c). Memória O(c). Os testes trocam uma constante e conferem que a
  ordem se inverte.

### Mensagens diretas: a caixa pelos ponteiros e o tempo real por LISTEN/NOTIFY

As mensagens diretas (decisão 13) pedem duas coisas: abrir a caixa rápido (as
conversas pela última atividade, com quantas faltam ler, e o contador da
navegação, que é buscado a cada evento) e entregar a mensagem na outra tela sem
recarregar, com a API rodando em vários workers e sem estado em memória.

**A caixa pelos ponteiros.** Tabelas novas: `conversas` (uma por par),
`participantes_conversa` (o lado de cada pessoa), `mensagens` e `bloqueios`.
Montar a caixa varrendo as mensagens (agrupar por conversa, achar a última,
contar as que vêm depois da última lida) custaria O(m) nas mensagens da pessoa
a cada abertura e a cada evento. Em vez disso, cada linha de
`participantes_conversa` guarda dois ponteiros: `ultima_mensagem_id` (copiado
nas duas linhas a cada envio, na mesma transação) e `ultima_lida_id`. A caixa é
uma faixa do índice `(user_id, situacao, ultima_mensagem_id)`; "tem não lidas"
é `ultima_mensagem_id > ultima_lida_id`; o "visto" é o `ultima_lida_id` do
outro lado. As regras (onde a conversa cai, a leitura que nunca anda para trás)
ficam em `core/caixa_de_entrada.py`.

**O tempo real.** `GET /mensagens/stream` é um stream SSE por aba. Ele não pode
ocupar o que as outras rotas usam: é `async` (não prende thread), não passa
pela fila do banco (`limite_do_banco.py`, que reserva uma conexão do pool por
requisição em voo) e só usa uma conexão na consulta curta que confere o token;
depois espera eventos no event loop. Num processo, os streams abertos ficam num
dict pessoa → filas (`core/assinaturas.py`), cada fila com limite (o cliente
lento recebe "ressincronizar" em vez de fazer a memória crescer). Entre os
workers, o evento passa pelo Postgres: o service faz `pg_notify` na transação
de quem envia (o Postgres só entrega no commit e descarta no rollback), e cada
worker mantém uma conexão em `LISTEN`, fora do pool, que reconecta com espera
crescente se cair e, ao voltar, pede aos seus streams para ressincronizar. O
evento leva só o tipo e os ids; o cliente busca o conteúdo pelas rotas normais
(`?depois=` a última que tem), que conferem quem pode ler, e é assim também que
recupera o que perdeu se o stream caiu. No SQLite (dev e testes) não há
LISTEN/NOTIFY: um canal em memória, atrás da mesma interface, entrega no commit
aos streams do próprio processo. O `EventSource` do navegador não manda o
header `Authorization`, e o token não vai na URL (ficaria em logs): o front lê o
stream com `fetch` e `ReadableStream`, com reconexão de 1 s a 30 s. No Caddy, a
rota do stream não comprime e faz flush a cada evento, e o limite de escrita
saiu (derrubava o stream aos 60 s); uma batida a cada 20 s mantém a conexão.

**Big O** (n = linhas da tabela, k = página, u = não lidas da página, d =
streams dos destinatários, S = streams abertos no processo):

| Operação | Custo | Quando roda |
|---|---|---|
| caixa (Conversas ou Pedidos) | O(log n + k) no índice da caixa + O(k log n + u) para as últimas mensagens e as não lidas | `/mensagens/conversas` |
| contador da navegação | O(log n + c), c = conversas da pessoa, sem ler mensagens | `/mensagens/resumo`, a cada evento |
| mensagens da conversa | O(log n + k) no índice `(conversa_id, id)` | abrir, `antes=`, `depois=` |
| enviar | O(log n): a mensagem, os dois ponteiros, o limite por minuto `(autor_id, created_at)` e o NOTIFY | `POST .../mensagens` |
| entregar um evento | O(destinatários + d) no dict; uma lista custaria O(S) | cada NOTIFY, em cada worker |

**Medição.** O `make bench` roda também `backend/scripts/bench_mensagens.py`.
A caixa usa as mesmas funções da API (`services/mensagens.caixa` e `resumo`)
contra a varredura de todas as mensagens montando o dict conversa → (última,
não lidas) em Python, e o script confere que dão o mesmo resultado. Mediana de
7 rodadas, 500 pessoas, ~25 mensagens por conversa, a pessoa com mais conversas:

```
mensagens | conversas da pessoa | ponteiros (ms) | varredura (ms) |   ganho
---------------------------------------------------------------------------
     1000 |                   2 |          0.987 |          0.513 |    0.5x
    10000 |                   7 |          1.088 |          4.317 |    4.0x
   100000 |                  31 |          1.324 |         43.528 |   32.9x
  1000000 |                 191 |          1.559 |        503.269 |  322.8x

 streams |  dict (ms) | lista (ms) |    ganho
---------------------------------------------
     100 |     0.0005 |     0.0016 |       3x
    1000 |     0.0005 |     0.0146 |      30x
   10000 |     0.0006 |     0.2046 |     360x
  100000 |     0.0006 |     2.3170 |    4184x
```

Com 1.000 mensagens a varredura ganha (são quatro consultas contra uma), mas
os ponteiros quase não crescem com a rede (1 ms → 1,6 ms de mil para um milhão
de mensagens), enquanto a varredura cresce junto com ela e passa de meio
segundo. O fan-out pelo dict fica constante; a lista cresce com os streams.

**Com carga, medido** (`backend/scripts/carga.py` contra o compose local, API
com 2 workers × (4 + 2), Postgres e Caddy com HTTPS, 100 usuários, 30 s; com as
mensagens, os 100 mantêm o stream aberto e 10 deles mandam mensagens em vez de
navegar): 0 erro e 0 stream caído em todas as rodadas. Pausa média de 3 s: p95
das rotas de leitura de 68 e 88 ms sem as mensagens, de 75 e 104 ms com elas;
o evento chega ao outro stream 20 a 27 ms depois do envio. Sem pausa (100
requisições sempre em voo): p95 de 817 e 1.404 ms sem as mensagens e de 845 e
904 ms com elas (a variação é da máquina do teste, dividida com outros
serviços). As mensagens não pioram as outras rotas de forma relevante: o stream
parado não usa thread nem conexão.
Com o bloqueio na rede inteira, cada feed faz mais uma consulta (os bloqueios da
pessoa, pelos dois índices de `bloqueios`) e, só para quem tem bloqueio, tira os
poemas e as rengas do outro. Medido de novo, com 13 bloqueios entre as contas
da carga: p95 de 63 ms com pausa de 3 s (57 a 94 ms sem bloqueios na mesma
rodada) e de 1.080 ms sem pausa (876 a 1.083 ms sem bloqueios), 0 erro de
servidor; os 404 são os perfis e poemas que o bloqueio esconde.
Com os comentários escondidos, o Acervo e as listas filtrados (mais uma
consulta curta por página de comentários), de novo com os 13 bloqueios: p95 de
74 e 101 ms com pausa de 3 s e de 936 ms sem pausa, 0 erro de servidor.

### Avisos: uma linha por ação, agrupadas na leitura

Os avisos (decisão 16) moram na tabela nova `avisos`, uma linha por ação e por
destinatário, gravada pelo service da ação **na mesma transação** (o
`services/avisos.avisar` roda antes do commit da curtida ou do comentário; se a
ação volta num rollback, o aviso volta junto). O evento `aviso` sai pelo mesmo
`tempo_real.avisar` das mensagens: o NOTIFY só é entregue no commit, chega ao
stream aberto em qualquer réplica, e o cliente busca o contador pela rota. Não
há segundo stream nem estado na API.

Uma linha por ação, e não uma por grupo, porque desfazer precisa apagar só a
curtida de quem descurtiu. O agrupamento ("Ana e mais 3 curtiram") é um
`GROUP BY (tipo, post_id, dia de Brasília, id se o tipo não agrupa)` nos avisos
da pessoa (no Postgres, `timezone('America/Sao_Paulo', ...)`; no SQLite de dev,
o deslocamento fixo de -3 h, já que o Brasil não tem horário de verão desde 2019),
ordenado pelo aviso mais recente de cada grupo, com o cursor `(data, id)` desse
aviso no `HAVING`. O contador agrupa do mesmo jeito, só os não lidos. Os dois
atores mais recentes de cada grupo saem de um `ROW_NUMBER` por grupo, e os alvos da página (poemas, rengas, comentários,
estrofes, âncoras) de uma consulta por tabela, sem N+1. As regras puras
(quem recebe, sem repetir e sem o ator; que estrofes uma crítica de renga toca;
o trecho da linha) ficam em `core/avisos.py`.

| Operação | Custo | Quando roda |
|---|---|---|
| gravar | O(c log n), c = candidatos | cada curtida, follow, comentário, estrofe |
| listar | O(a) no índice `(destinatario_id, created_at, id)` para agrupar + O(k log n) | `GET /avisos` |
| contador | O(u) no índice `(destinatario_id, lido)`, u = não lidos | `GET /avisos/resumo`, a cada evento |
| marcar lidos | O(u) | abrir a página |

O agrupamento custa O(a), com a = avisos da pessoa: para os poetas da demo,
centenas. Se uma conta chegar a dezenas de milhares, o próximo passo é ler só
uma janela recente (por exemplo, os últimos 30 dias) ou guardar o grupo numa
tabela; não foi preciso. Os testes de avisos rodam também contra o Postgres 16
(`TEST_POSTGRES_URL`), com o dia de Brasília e o NOTIFY.

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
  #38, #43, #49, #51, #54, #56, #75 a #78, #87, #89 e #91), e as perguntas que
  ficaram para ele, em "Decisões em aberto".
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
  #78), o feed "Para você" (#87), as boas-vindas e as sugestões (#91) e a
  escola e o país dos consagrados (#89) e as mensagens diretas (#135) também
  foram implementadas por subagents a pedido do Neto. Cada lacuna que eles encontraram (o equilíbrio dos
  consagrados, os reposts no "Para você", os pesos da nota, o vocabulário de
  escolas, os casos duvidosos de classificação) foi listada no PR e decidida
  pelo Neto antes do merge.
- **Revisão: humana.** O Neto revisou cada PR e decidiu cada merge, com o
  apoio de um agente de revisão (Claude Code) que rodava os testes e conferia
  os contratos. Os comentários de revisão estão nos PRs, publicados pela conta
  do Neto. A única aprovação formal no GitHub é a do #24, registrada na conta
  do Neto com apoio do agente de revisão. O Henrique e o Pedro registram a
  validação deles nas issues #57 a #62 e na revisão deste arquivo (#63).
- **Conteúdo:**
  - Os poemas do seed foram escritos com IA (Claude): os 29 poetas, os 78
    poemas, as citações, as conversas de oficina e as rengas
    (`backend/scripts/seed_conteudo.py`). Os perfis são de gente de vários
    lugares e idades que lê e escreve poesia: alguns universitários, uma
    professora aposentada, um motorista que escreve cordel, uma mãe que lê
    Florbela, estudantes do ensino médio. São fictícios, sem copiar autor
    real nem imitar poeta vivo.
  - Os poemas dos consagrados vieram de um scraper do Neto (Wikisource e
    Wikiquote). Foram validados e não foram alterados: saíram os poemas com
    defeito, e a única limpeza foi mecânica, nos caracteres invisíveis e no TAB
    do início dos versos (#45 e #49). O campo `obra` foi limpo para guardar só
    o livro ("Les Fleurs du mal", sem o ano) (#89).
  - A expansão do acervo (#79), de 95 para 155 poetas e de 725 para 11.236
    poemas, foi preparada pelo agente scraper do Neto, bloco por bloco (língua
    portuguesa, latinas, inglês, germânicas, antiguidade, árabe e persa, Ásia,
    Américas). De cada poeta entrou a coleção transcrita no Wikisource; das
    epopeias, só a abertura. Os textos são os da página, e o que já existia não
    mudou de título nem de obra. As traduções em inglês usadas no lugar do
    original (a Ilíada de Pope e o Rubaiyat de FitzGerald) também são de
    domínio público. O relatório está em
    `backend/data/consagrados/_relatorio_expansao.md`. O scraper continua fora
    do repositório.
- **Henrique:** _(completar com a ferramenta e o uso próprio)_
- **Pedro:** _(completar com a ferramenta e o uso próprio)_
