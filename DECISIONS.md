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
    preserva o número de versos, as estrofes e os recuos. A tela mostra
    "Traduzido do {língua} por IA · ver original", e o original fica sempre
    visível. Cada tradução fica em cache por poema e língua, e cada usuário
    pede até 30 traduções novas por hora (as do cache não contam).
- **O que cortamos e por quê:**
  - **Os modernos que o público mais conhece** (Drummond, Bandeira, Cecília,
    Vinicius): as obras ainda têm direitos autorais. Preferimos um acervo legal
    a um acervo famoso e irregular.
  - **Traduções humanas publicadas:** têm direito de tradutor. O acervo fica no
    original, e a tradução gerada na hora, marcada como IA, ajuda a ler sem
    substituir o poema.
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
    para não revelar que existe.
- **O que cortamos e por quê:** reordenar os poemas. A ordem é a de inserção:
  a antologia já mostra o que o leitor lê, sem uma tela a mais para arrastar
  poemas.

### 6. Visual de leitura e dados que não somem

- **Contexto:** o poema precisa ser lido, não passado. E a banca e os colegas
  vão criar contas na URL pública.
- **Opções:** o visual do template e o SQLite do Render, que zera a cada
  restart, ou um layout de leitura e um banco persistente.
- **Escolha:**
  - **Três colunas, como num microblog:** navegação à esquerda, uma coluna de
    leitura de 600 px no centro e, à direita, a coluna Descobrir: busca por
    tag, Poema do dia, Em alta e consagrados para seguir.
  - **Duas fontes:** Schibsted Grotesk na interface e Literata só no corpo dos
    poemas. Os ícones são SVG próprios.
  - **Postgres na mesma VM da API** em vez do SQLite que zera (#55). O seed
    roda só num banco vazio, então o que se publica na URL pública continua lá.
    O banco fica no Docker Compose da VM da Oracle, sem porta pública, com
    `pg_dump` diário (7 diários e 4 semanais) copiado para o Object Storage da
    Oracle. Na mesma máquina, a ida e volta até o banco é de 0,06 ms (mediana
    de um `select 1` da API), e cada request faz várias consultas. O teto passa
    a ser o `max_connections` do próprio Postgres (60), e não as 15 conexões do
    Supabase free; sobra para o backup e para crescer com a VM. A VM usa todo
    o gratuito A1 (4 OCPU, 24 GB). Medido nos 4 núcleos, 100 usuários: 2
    workers × (4 + 2) deram p95 de 47 a 48 ms com pausa de 3 s e de 0,8 a
    0,92 s sem pausa, 0 erro; 4 workers empataram com pausa e oscilaram sem
    pausa (0,84 a 2,2 s). Com 2 núcleos, o p95 sem pausa passava de 1,1 s.
    Na mesma VM, a API roda em **duas réplicas com o Caddy balanceando**
    (`/saude` a cada 2 s e nova tentativa na outra réplica): um processo que
    cai não derruba o site, e o `atualizar.sh` troca a versão uma réplica de
    cada vez, sem queda. Com 100 usuários, derrubar uma réplica no meio da
    carga e rodar o `atualizar.sh` deram 0 erro (p95 de 93 e 86 ms), e os
    streams das mensagens voltaram na outra réplica em 1,3 a 1,4 s (mediana).
    Cada dump leva no nome a data e a hora (UTC) e o hostname da VM, então
    nenhum backup sobrescreve outro.
- **O que cortamos e por quê:** cartões, gradientes e imagens no feed. O poema
  fica sobre o papel, separado por filetes, e a cor de destaque aparece só nas
  ações. E o banco gerenciado: o Supabase dá painel e backup, mas paga a rede a
  cada consulta e limita as conexões. Ele fica documentado como alternativa
  (`docs/deploy-oracle.md`).

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
    404. "Rascunhos" é um item da navegação, sem limite de quantidade.
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
- **O que cortamos e por quê:** os filtros por escola literária, forma e
  país, e o trecho de poema no cartão. A afinidade por escola e forma já
  orienta as sugestões de quem seguir (decisão 11), e a forma tem o Explorar
  (decisão 3): o Acervo é para achar um poeta pelo nome, pela língua e pela
  época. O cartão é o perfil, e o poema se lê no perfil.

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
- **Mensagens diretas.** A crítica de um poema serve também a quem a lê. Numa
  DM, ela sai do lugar onde os outros leitores aprendem com ela; a conversa
  fica na árvore de comentários, que é pública.
- **Stories.** Somem em 24 horas, e um poema é feito para ficar. Seria também
  o formato da imagem, que é o problema do Instagram.
- **Upload de imagem.** O poema é texto para poder ser citado, copiado e
  traduzido; uma imagem no post traria de volta o "poema em print". O avatar é
  só uma URL.
- **Notificações.** Custariam dias (eventos, não lidas, tela) e trariam de
  volta a lógica do engajamento. Quem escreve volta para ler o feed, e as
  respostas estão na página do poema.
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
  escola e o país dos consagrados (#89) também foram implementadas por
  subagents a pedido do Neto. Cada lacuna que eles encontraram (o equilíbrio dos
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
