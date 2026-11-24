"""Conteúdo do seed fake: poetas fictícios, poemas, conversas, antologias e rengas.

Os poetas são gente que lê e escreve poesia, de vários lugares e idades: alguns
universitários, uma professora aposentada, um motorista que escreve cordel, uma
mãe que lê Florbela, estudantes do ensino médio.

Só dados (tuplas e strings): os objetos do banco são criados em `seed.py`, dentro
das funções, para o seed poder rodar mais de uma vez no mesmo processo.

Todos os poetas e poemas são fictícios e originais, escritos para o seed. Os
textos estão como devem aparecer: as quebras de linha, as estrofes e os recuos
fazem parte do poema. A última estrofe, só de #tags, não é verso: é como o
poeta marca o tema na rede.
"""

from typing import NamedTuple


class Poeta(NamedTuple):
    username: str
    name: str
    bio: str


class Poema(NamedTuple):
    chave: str
    autor: str
    forma: str
    texto: str
    titulo: str | None = None


class Citacao(NamedTuple):
    autor: str
    original: str
    texto: str


class Conversa(NamedTuple):
    """Um comentário e as respostas a ele. `apagar`: o autor apaga depois das respostas."""

    autor: str
    texto: str
    respostas: tuple["Conversa", ...] = ()
    apagar: bool = False


class Antologia(NamedTuple):
    dono: str
    nome: str
    descricao: str
    publica: bool
    poemas: tuple[str, ...]


# Conta de demonstração (README, "Como começar"): tem poemas, seguidores, uma
# antologia, conversas no próprio poema e segue mais consagrados que os outros.
CONTA_DEMO = "marina_letras"

POETAS = (
    Poeta(
        "marina_letras",
        "Marina Albuquerque",
        "Letras na UFPB, 5º período. Escrevo no 1500 e reviso na Biblioteca Central.",
    ),
    Poeta(
        "caio_eng",
        "Caio Nóbrega",
        "Engenheiro civil, 34 anos. De Patos, moro em João Pessoa. Haicai no ônibus, a caminho da obra.",
    ),
    Poeta(
        "bia_med",
        "Beatriz Farias",
        "Médica residente em João Pessoa, 27 anos. Poema é o que sobra entre um plantão e outro.",
    ),
    Poeta(
        "joao_direito",
        "João Pedro Medeiros",
        "Advogado trabalhista em Natal, 41 anos. Escrevo soneto com a paciência de quem lê o Código Civil.",
    ),
    Poeta(
        "luiza_psi",
        "Luiza Cavalcanti",
        "Psicóloga do CAPS de Caruaru há vinte anos. Escuto mais do que escrevo.",
    ),
    Poeta(
        "rafa_cc",
        "Rafael Toscano",
        "Ciência da Computação, UFPB. Haicais entre um commit e outro.",
    ),
    Poeta(
        "helena_musica",
        "Helena Brito",
        "Professora de flauta aposentada, 68 anos, Olinda. Toco na orquestra do bairro e ainda erro o fá.",
    ),
    Poeta(
        "davi_arq",
        "Davi Lucena",
        "Arquiteto, 38 anos. Voltei a João Pessoa depois de dez anos em São Paulo. Escrevo o que não cabe na planta.",
    ),
    Poeta(
        "ana_clara_bio",
        "Ana Clara Moura",
        "Ciências Biológicas, UFPB. Microscópio, alga verde e poesia.",
    ),
    Poeta(
        "thiago_hist",
        "Thiago Araújo",
        "Professor de História da rede estadual em João Pessoa. Cordelista de fim de semana, neto de repentista.",
    ),
    Poeta(
        "isabela_jor",
        "Isabela Rangel",
        "Repórter de cidades em Fortaleza, 29 anos. O que não sai no jornal eu escrevo aqui.",
    ),
    Poeta(
        "pedro_fisio",
        "Pedro Henrique Lins",
        "Fisioterapeuta em Teresina, 52 anos. Aprendo com os pacientes a andar devagar.",
    ),
    Poeta(
        "camila_filo",
        "Camila Diniz",
        "Filosofia, UFPB. Prosa poética e perguntas sem resposta.",
    ),
    Poeta(
        "gabriel_mat",
        "Gabriel Sousa",
        "Matemática, UFPB. Acredito em infinitos de tamanhos diferentes.",
    ),
    Poeta(
        "yasmin_enf",
        "Yasmin Freitas",
        "Enfermeira do HU há doze anos. Caderno no bolso do jaleco.",
    ),
    Poeta(
        "lucas_agro",
        "Lucas Ventura",
        "Agricultor e técnico agrícola no Cariri paraibano, 58 anos. Repente na feira de domingo.",
    ),
    Poeta(
        "sofia_cinema",
        "Sofia Martins",
        "Cinema e Audiovisual, UFPB. Fico sempre até o fim dos créditos.",
    ),
    Poeta(
        "matheus_quimica",
        "Matheus Gadelha",
        "17 anos, 3º ano do ensino médio em Mossoró. Quero fazer Química. Misturo coisas que não deviam reagir.",
    ),
    Poeta(
        "larissa_ped",
        "Larissa Queiroga",
        "Professora do fundamental numa escola municipal do Valentina, mãe de dois. Leio Florbela no recreio.",
    ),
    Poeta(
        "vitor_ufcg",
        "Vitor Montenegro",
        "Engenharia Elétrica, UFCG. Vivo na BR-230 entre Campina e João Pessoa.",
    ),
    Poeta(
        "nina_ufpe",
        "Nina Barbosa",
        "Letras, UFPE. Recifense, apaixonada por sonetos e pontes.",
    ),
    Poeta(
        "enzo_eco",
        "Enzo Pacheco",
        "Bancário em Salvador, 47 anos. Economista de formação: planilha de dia, poesia de noite.",
    ),
    Poeta(
        "clara_teatro",
        "Clara Wanderley",
        "Atriz de um grupo de teatro de rua de Sapé. Escrevo monólogos que ninguém encena.",
    ),
    Poeta(
        "iago_ifpb",
        "Iago Ramalho",
        "16 anos, ensino médio integrado em Informática no IFPB. Cordel, acróstico e Wi-Fi que não pega.",
    ),
    Poeta(
        "damiao_cordel",
        "Damião Ferreira",
        "Motorista de ônibus em Caruaru há 22 anos. Escrevo cordel no ponto final, entre uma viagem e outra.",
    ),
    Poeta(
        "lourdes_paiva",
        "Maria de Lourdes Paiva",
        "Professora de Português aposentada, 72 anos, Teresina. Releio Camões e escrevo sonetos à mão.",
    ),
    Poeta(
        "tomas_guaiba",
        "Tomás Brandão",
        "Bibliotecário em Porto Alegre, 55 anos. Verso livre na beira do Guaíba.",
    ),
    Poeta(
        "aline_libras",
        "Aline Sampaio",
        "Intérprete de Libras em Manaus, 33 anos. Escrevo o que as mãos dizem.",
    ),
    Poeta(
        "cida_costura",
        "Aparecida Gomes",
        "Costureira em Juiz de Fora, 61 anos, avó de três. Aprendi trova com a minha mãe.",
    ),
)

POEMAS = (
    # ---------------------------------------------------------------- sonetos
    Poema(
        "soneto_biblioteca",
        "marina_letras",
        "soneto",
        """\
Entre as estantes, onde o pó descansa,
procuro um verso que ninguém citou;
o ventilador gira, a tarde avançou,
e a bibliotecária já não me alcança.

Folheio um livro velho de esperança:
alguém, antes de mim, sublinhou
a frase exata que me acompanhou
desde o tempo em que eu era só criança.

Fecham às dez. Recolho a papelada,
o lápis gasto, a fome, a teimosia,
e saio pela rampa iluminada.

Na parada do ônibus, a noite fria
me encontra com a frase sublinhada
ainda acesa dentro, como um dia.

#biblioteca #ufpb #madrugada""",
        "Soneto da Biblioteca Central",
    ),
    Poema(
        "soneto_reu",
        "joao_direito",
        "soneto",
        """\
Confesso, Meritíssimo: roubei
um verso de uma moça no corredor;
não sei se é crime, furto ou só amor,
mas desde aquela tarde eu não sosseguei.

Juntei as provas todas que guardei:
o bilhete, o café, o tom menor
do riso na audiência das três, a cor
da chuva em seu cabelo. E nada sei.

Peço clemência, peço ao tribunal
que leia nos autos a atenuante:
eu nunca soube ler o Código Penal

quando ela entrava, assim, desconcertante;
e a pena que eu mereço, afinal,
é escrever sonetos dela, doravante.

#amor #direito #tribunal""",
        "Soneto do réu confesso",
    ),
    Poema(
        "soneto_plantao",
        "bia_med",
        "soneto",
        """\
São três da madrugada no plantão,
o café frio, a luz que não se apaga;
alguém geme baixinho, e a dor é vaga
como um nome que escapa pela mão.

Aprendi cada osso, cada articulação,
a anatomia exata de uma chaga,
mas ninguém me ensinou como se afaga
o medo que se esconde num irmão.

Seu Antônio pergunta se amanhece.
Eu digo que sim, que já vem vindo,
e arrumo o travesseiro como prece.

Lá fora o céu de Tambiá vai se abrindo,
a enfermaria, devagar, se aquece,
e eu fico ali, cansada, e vou sorrindo.

#plantao #medicina #madrugada""",
        "Plantão",
    ),
    Poema(
        "soneto_viga",
        "caio_eng",
        "soneto",
        """\
Calculei toda a carga sobre a viga,
o momento fletor, a compressão,
e o mestre de obras disse: "Atenção,
há forças que nenhuma conta abriga."

Eu ri, achando que era uma cantiga
de quem já perdeu a vocação;
mas foi chegar em casa e, no portão,
a saudade pesar mais que a fadiga.

Não há coeficiente de segurança
para quem mora longe de onde nasceu
e leva o interior numa lembrança.

O concreto resiste, o aço avança,
mas a ponte entre Patos e o peito meu
nenhum cálculo da obra ainda alcança.

#saudade #engenharia #sertao""",
        "Soneto do cálculo estrutural",
    ),
    Poema(
        "soneto_re_menor",
        "helena_musica",
        "soneto",
        """\
Toquei a mesma escala a tarde inteira,
ré, mi, fá, sol, até doer o pulso;
o metrônomo, frio, num impulso
marcava o tempo como uma goteira.

Errava sempre o fá, de tal maneira
que o eco do corredor, meio avulso,
devolvia o meu erro sem recurso,
como quem ri baixinho na cadeira.

Mas quando a noite veio pela janela
e o maestro já tinha ido embora,
toquei sem partitura, só por ela,

uma canção que eu não sabia até agora;
e a nota que eu errava saiu bela,
sem metrônomo, sem medo e sem demora.

#musica #flauta #ensaio""",
        "Soneto em ré menor",
    ),
    Poema(
        "soneto_estuario",
        "nina_ufpe",
        "soneto",
        """\
O rio passa lento sob a ponte,
levando o que a cidade não quis ter:
a garrafa, o aguapé, o entardecer
de quem atravessou sem ver o horizonte.

Eu volto da aula e paro, sem ter pressa,
na mureta onde a tarde se demora;
o rio é água lenta que não chora
e sobe com a maré, mas não confessa.

Aprendi na faculdade a palavra estuário,
que é quando o doce aceita o sal do mar
sem deixar de ser rio no itinerário.

Talvez eu seja assim, de tanto olhar:
meio Recife, meio dicionário,
um rio que não sabe se quer chegar.

#recife #cidade #rio""",
        "Estuário",
    ),
    Poema(
        "soneto_infinito",
        "gabriel_mat",
        "soneto",
        """\
Contei os naturais até cansar:
um, dois, três, mil, e mais um, e também
os pares, que, por mais que falte alguém,
são tantos quanto os outros, sem sobrar.

Cantor, o velho Cantor, quis me ensinar
que há infinitos maiores que o de quem
conta nos dedos, e que um real contém
mais pontos que uma vida pode enumerar.

Por isso eu não te conto, nem divido
o que sinto em parcelas de semana:
o que eu sinto é real, não é contido

em lista, em fila, em conta cotidiana;
entre zero e um, amor, tenho escondido
um contínuo inteiro, a minha prova humana.

#matematica #amor #prova""",
        "Soneto do infinito",
    ),
    Poema(
        "soneto_sessao",
        "luiza_psi",
        "soneto",
        """\
Na sala de espera, ao lado da escola,
o relógio de parede anda devagar;
a moça ao lado tenta respirar
e aperta a alça da sua sacola.

Faz vinte anos que este é o meu papel:
é ouvir o que se cala, e não julgar,
deixar que o silêncio tenha o seu lugar,
mesmo quando ele pesa, mesmo quando é fel.

Às vezes volto pra casa sem saber
se ajudei alguém ou se só ouvi,
sentada com o meu medo, a escrever

relatórios do que eu nem entendi;
mas na quinta ela sorriu ao dizer:
"Doutora, essa semana eu dormi."

#psicologia #caps #cuidado""",
        "Soneto da sessão de quinta",
    ),
    # ---------------------------------------------------------------- haicais
    Poema(
        "haicai_commit",
        "rafa_cc",
        "haicai",
        """\
commit às três —
o cursor pisca e espera
um verso que compile

#madrugada #computacao""",
    ),
    Poema(
        "haicai_servidor",
        "rafa_cc",
        "haicai",
        """\
chuva no telhado
do laboratório: o servidor
também se cala

#chuva #ufpb""",
    ),
    Poema(
        "haicai_ru",
        "rafa_cc",
        "haicai",
        """\
lua sobre o RU —
a fila do jantar
nem levanta os olhos

#ru #lua #ufpb""",
    ),
    Poema(
        "haicai_areia",
        "lucas_agro",
        "haicai",
        """\
neblina em Areia —
o pé de café molhado
segura o orvalho

#brejo #madrugada #agronomia""",
    ),
    Poema(
        "haicai_alga",
        "ana_clara_bio",
        "haicai",
        """\
na lâmina de vidro
uma alga verde dança
sem saber que é vista

#biologia #laboratorio""",
    ),
    Poema(
        "haicai_onibus",
        "marina_letras",
        "haicai",
        """\
ônibus lotado —
no vidro embaçado alguém
desenhou um sol

#ônibus #chuva""",
    ),
    Poema(
        "haicai_seixas",
        "davi_arq",
        "haicai",
        """\
Ponta do Seixas —
o primeiro sol do país
nas minhas pestanas

#mar #joaopessoa""",
        "Extremo oriental",
    ),
    Poema(
        "haicai_plantao",
        "yasmin_enf",
        "haicai",
        """\
fim do plantão —
as mãos ainda cheiram
a álcool e a manhã

#plantao #enfermagem""",
    ),
    Poema(
        "haicai_cajueiro",
        "camila_filo",
        "haicai",
        """\
folha de cajueiro
cai no pátio do CCHLA —
ninguém a lê

#ufpb #outono""",
    ),
    Poema(
        "haicai_prova",
        "gabriel_mat",
        "haicai",
        """\
prova de cálculo —
uma formiga atravessa
o limite da folha

#prova #matematica""",
    ),
    Poema(
        "haicai_cinema",
        "sofia_cinema",
        "haicai",
        """\
sessão das sete —
na tela, o mar; na fila,
cheiro de pipoca

#cinema #mar""",
    ),
    Poema(
        "haicai_cafe",
        "iago_ifpb",
        "haicai",
        """\
café no copo
de plástico: o intervalo
dura um gole só

#intervalo #ifpb""",
    ),
    Poema(
        "haicai_corda",
        "helena_musica",
        "haicai",
        """\
corda partida
às duas da manhã —
o grilo continua

#madrugada #musica""",
    ),
    # ---------------------------------------------------------------- trovas
    Poema(
        "trova_historia",
        "thiago_hist",
        "trova",
        """\
Quem estuda a história sabe
que o tempo é rio sem volta:
não há prova que me acabe
nem saudade que se solta.

#historia #saudade""",
    ),
    Poema(
        "trova_letra_a",
        "larissa_ped",
        "trova",
        """\
Ensinei a uma criança
a letra A de amanhecer;
ela me deu a esperança
que eu esqueci de ter.

#pedagogia #infancia""",
    ),
    Poema(
        "trova_contrato",
        "joao_direito",
        "trova",
        """\
Fiz um contrato contigo
sem cláusula de saída:
se o amor virar castigo,
cumpro a pena pela vida.

#amor #direito""",
    ),
    Poema(
        "trova_ladeira",
        "pedro_fisio",
        "trova",
        """\
Meu joelho já não dobra
de tanto subir ladeira;
mas a saudade que sobra
dobra mais que a vida inteira.

#saudade #fisioterapia""",
    ),
    Poema(
        "trova_coxia",
        "clara_teatro",
        "trova",
        """\
No palco eu sou rainha,
na coxia, só atriz;
quando a luz se apaga, minha
sombra é que fica feliz.

#teatro""",
    ),
    Poema(
        "trova_feijao",
        "lucas_agro",
        "trova",
        """\
Plantei feijão na baixada,
milho no alto da serra;
mas a saudade, coitada,
não quer nascer noutra terra.

#sertao #saudade""",
    ),
    # ---------------------------------------------------------------- quadras
    Poema(
        "quadra_bequer",
        "matheus_quimica",
        "quadra",
        """\
Misturei sal e saudade
num béquer de cem mililitros:
a reação deu cidade,
fumaça, ônibus e gritos.

#quimica #cidade""",
    ),
    Poema(
        "quadra_inflacao",
        "enzo_eco",
        "quadra",
        """\
A inflação subiu de novo,
a passagem subiu também;
só o salário do banco
não sobe pra ninguém.

#economia #ônibus""",
    ),
    Poema(
        "quadra_manchete",
        "isabela_jor",
        "quadra",
        """\
Escrevi uma manchete
que ninguém vai publicar:
"Moça de vinte e nove anos
ainda aprende a amar."

#amor #jornalismo""",
        "Manchete",
    ),
    Poema(
        "quadra_campina",
        "vitor_ufcg",
        "quadra",
        """\
Campina Grande tem frio
que João Pessoa não tem;
mas o frio que eu sinto mesmo
é o da falta de alguém.

#saudade #campina""",
    ),
    Poema(
        "quadra_nervos",
        "bia_med",
        "quadra",
        """\
Decorei todos os nervos,
o vago, o facial, o ulnar;
mas nenhum atlas me ensina
o nervo que faz parar de amar.

#medicina #prova #amor""",
    ),
    Poema(
        "quadra_pontes",
        "nina_ufpe",
        "quadra",
        """\
Recife tem tanta ponte
que eu me perco sem querer;
toda ponte me dá conta
de um caminho até você.

#recife #amor""",
    ),
    # ---------------------------------------------------------------- cordéis
    Poema(
        "cordel_1500",
        "thiago_hist",
        "cordel",
        """\
Vou contar uma história
que se deu com Zé Ninguém,
estudante da federal
que mora longe de quem tem,
lá no fim do Valentina,
onde ônibus quase não vem.

Acordou às cinco e pouco,
tomou um café coado,
botou na mochila o livro
de Brasil Colônia, pesado,
e correu para a parada
com o cabelo ainda molhado.

Mas o 1500, esse,
é bicho de estimação:
só aparece quando quer,
nunca atende a oração;
Zé esperou quarenta minutos
debaixo de um sol de leão.

Quando o ônibus chegou
vinha cheio até a porta,
tinha gente no degrau,
tinha gente quase morta,
tinha um senhor com galinha
e uma moça com uma torta.

Zé entrou de lado, espremido,
segurando a apostila,
pisou no pé do cobrador,
pediu desculpa na fila,
e foi lendo a Inconfidência
de pé, sem perder a trilha.

Chegou na aula atrasado,
a prova tinha começado;
o professor olhou pra ele
com o olhar de um soldado:
"Sente aí, meu caro Zé,
que o tempo já foi contado."

Zé escreveu sobre a Colônia,
o açúcar e a escravidão,
escreveu com a mão tremendo
mas escreveu de coração,
e no canto da folha, à toa,
desenhou um busão.

Tirou oito e meio, gente,
e a moral que eu deixo aqui
é que quem pega o 1500
já sabe o que é sofrer, e ri:
conhece a história do Brasil
melhor que o livro que eu li.

#ônibus #joaopessoa #prova #cordel""",
        "O estudante e o 1500",
    ),
    Poema(
        "cordel_seca",
        "lucas_agro",
        "cordel",
        """\
Meu avô plantava milho
no sertão do Cariri,
olhava o céu de setembro
procurando o bem-te-vi,
que dizia, no seu canto,
se a chuva vinha por aqui.

Eu fiz o curso de técnico
pra estudar solo e semente,
aprendi o pH da terra,
a irrigação diferente,
mas a ciência do meu avô
eu carrego inteira na mente.

Hoje eu leio satélite,
mapa, gráfico e previsão,
mas quando o céu escurece
por cima do meu sertão,
eu procuro o bem-te-vi
antes do celular na mão.

Se a chuva vier, eu canto,
se não vier, eu espero:
o sertanejo é paciente
como o mandacaru é sincero;
a seca ensina a ficar,
e ficar é o que eu mais quero.

#sertao #chuva #agronomia""",
        "Peleja do agricultor com a seca",
    ),
    Poema(
        "cordel_wifi",
        "iago_ifpb",
        "cordel",
        """\
O Wi-Fi da federal
é coisa de assombração:
aparece na biblioteca,
some na hora da lição,
volta no banheiro do bloco
e cai de novo no portão.

Já tentei senha de todo tipo,
já reiniciei o celular,
já subi na escada do prédio
pra ver se pegava no ar;
o sinal é feito paquera:
some quando eu vou chegar.

Mas um dia, no almoço,
na fila da cantina, que alegria!
três barrinhas no telefone,
mandei o trabalho que eu devia,
e o "recebido" do professor
foi o verso mais bonito do dia.

#wifi #escola #cordel""",
        "Cordel do Wi-Fi",
    ),
    Poema(
        "cordel_sao_joao",
        "vitor_ufcg",
        "cordel",
        """\
Em junho, Campina Grande
vira o maior arraial,
tem fogueira, tem quadrilha,
tem milho no quintal,
e eu, que estudo Elétrica,
fico sem tempo, afinal.

Mas a prova de Circuitos
caiu no dia vinte e três,
e o professor, que é de fora,
não conhece o São João, talvez;
estudei Thévenin no Parque do Povo
pela primeira e última vez.

Entre um forró e uma corrente,
entre a sanfona e a tensão,
eu errei a malha toda
mas acertei o coração:
dancei com a moça da Mecânica
até o fim do São João.

#saojoao #campina #prova""",
        "Circuito de São João",
    ),
    Poema(
        "cordel_aluno_novo",
        "thiago_hist",
        "cordel",
        """\
Menino, preste atenção
no que eu vou lhe ensinar:
o recreio é às nove,
mas a fila é de amargar;
quem chega depois do sinal
come o que sobrar.

A biblioteca é pequena,
mas lá dentro cabe o sertão;
a quadra não tem cobertura,
leve garrafa na mão;
e se perder na escola,
pergunte ao vigia do portão.

Mas o mais importante, aluno,
não está no boletim, não:
faça amigo no corredor,
leia poesia, então,
que a escola um dia passa
e o verso fica, irmão.

#escola #conselho #cordel""",
        "Conselhos ao aluno novo",
    ),
    # ---------------------------------------------------------- prosa poética
    Poema(
        "prosa_fila_ru",
        "camila_filo",
        "prosa_poetica",
        """\
Há um tempo que não é de ninguém: o da fila do RU. Não é tempo de estudo, nem de descanso, nem de amor, embora às vezes o amor passe por ali de bandeja na mão. É um tempo em suspenso, como se a universidade respirasse entre um sinal e outro. Fico pensando em Heráclito: ninguém entra duas vezes na mesma fila, porque a fila já é outra e eu já sou outra, mais faminta.

Quando chega a minha vez, a moça do caixa sorri, e o dia, que parecia perdido, ganha um sentido pequeno, do tamanho de um grão de feijão. Talvez a filosofia seja só isso: prestar atenção no feijão.

#ru #ufpb #filosofia""",
        "Do tempo da fila",
    ),
    Poema(
        "prosa_carta",
        "luiza_psi",
        "prosa_poetica",
        """\
Querida, você vai crescer e vai estudar a mente das pessoas, imagina. Logo você, que se escondia no banheiro da escola para chorar sem ninguém ver. Queria te dizer que a tristeza que você sente não é defeito: é só um cômodo da casa, e um dia você vai aprender a abrir a janela dele.

Você vai conhecer gente que também se escondia. Vai ouvir histórias que ninguém nunca ouviu. E vai descobrir, numa quinta-feira qualquer, que escutar é uma forma de abraço.

Não precisa ter pressa. Eu te espero aqui, com o caderno aberto.

#psicologia #infancia #carta""",
        "Carta para a menina de onze anos",
    ),
    Poema(
        "prosa_plano",
        "sofia_cinema",
        "prosa_poetica",
        """\
Imagine a cena sem corte: eu saio do Centro de Comunicação, atravesso o estacionamento, desvio de uma poça, cumprimento o moço da tapioca, subo a rampa da biblioteca, esqueço o que ia fazer, desço, compro uma tapioca de coco, sento num banco e choro um pouco porque o roteiro não sai.

A câmera não corta. A câmera nunca corta na vida real, e é por isso que eu gosto tanto de montagem.

#cinema #ufpb #chuva""",
        "Plano-sequência",
    ),
    Poema(
        "prosa_lide",
        "isabela_jor",
        "prosa_poetica",
        """\
Quem: eu, vinte e nove anos, repórter de cidades. O quê: me apaixonei. Quando: terça-feira, às 14h, na coletiva da prefeitura. Onde: terceira fileira, do lado da janela que não fecha. Como: ele emprestou uma caneta e não pediu de volta. Por quê: ainda estou apurando.

Fontes ouvidas pela reportagem não quiseram se identificar. A redação segue acompanhando o caso.

#amor #jornalismo #fortaleza""",
        "Lide",
    ),
    Poema(
        "prosa_planta",
        "davi_arq",
        "prosa_poetica",
        """\
Desenhei a casa onde a gente ia morar. Tem uma varanda virada para o nascente, porque você acorda cedo, e um quarto de leitura virado para o poente, porque eu leio tarde. A cozinha não tem parede, para a conversa atravessar. O banheiro tem uma janela alta, só para ver a copa do cajueiro.

Mostrei à minha sócia, e ela riscou na margem: falta circulação. Ela tinha razão. Faltou um corredor para você voltar.

#arquitetura #amor #saudade""",
        "Planta baixa de uma casa que não existe",
    ),
    Poema(
        "prosa_sinais",
        "yasmin_enf",
        "prosa_poetica",
        """\
Pressão doze por oito. Frequência cardíaca oitenta e dois. Saturação noventa e sete. Temperatura trinta e seis e meio. Anoto tudo na prancheta, e o senhor do leito quatro me pergunta se vai ficar bom. Os números dizem que sim. Eu digo que sim.

Mas não existe campo na ficha para anotar o medo dele, nem o meu, e a gente fica os dois ali, estáveis, assustados, esperando o médico da manhã.

#plantao #enfermagem #madrugada""",
        "Sinais vitais",
    ),
    Poema(
        "prosa_custo",
        "enzo_eco",
        "prosa_poetica",
        """\
Toda escolha tem um custo de oportunidade, ensinou o professor de Micro, há vinte e cinco anos. Se eu fico na agência até as sete, perco o mar. Se vou ao mar, perco a meta do mês. Quando escolhi Economia, perdi a Música que eu quase fiz. Se digo que te amo, perco o conforto de não saber se você também.

Passei a vida inteira calculando. Hoje resolvi pagar o preço: fui ao mar, disse o que sentia e deixei a meta para segunda-feira.

#economia #mar #trabalho""",
        "Custo de oportunidade",
    ),
    # ------------------------------------------------------------- verso livre
    Poema(
        "livre_inventario",
        "marina_letras",
        "verso_livre",
        """\
Tenho na mochila:
três livros da biblioteca, dois atrasados,
um caderno de capa mole onde escrevo
poemas no verso das anotações de Linguística,
uma caneta que não é minha,
uma maçã que esqueci de comer na segunda-feira.

Tenho no peito:
a ansiedade da apresentação de quinta,
o nome de um menino de Comunicação
que eu ainda não sei dizer sem gaguejar,
a saudade de casa, em Guarabira,
e a dúvida de sempre:
    será que eu sei escrever
    ou só sei gostar de quem escreve?

Tenho no celular:
quarenta e sete fotos do pôr do sol no Jacaré,
todas iguais,
todas necessárias.

Tenho no bolso:
duas passagens de ônibus
e a certeza meio torta
de que, se eu continuar anotando tudo,
um dia o inventário vira livro.

#ufpb #letras #saudade""",
        "Inventário do quinto período",
    ),
    Poema(
        "livre_epitacio",
        "davi_arq",
        "verso_livre",
        """\
A avenida desce
até o mar
como quem não aguenta mais esperar o fim do expediente.

        Os carros, em fila,
        são vértebras de uma cobra cansada.

Eu, que desenho cidades,
devia saber explicar
por que a gente constrói tudo de costas para o poente,
por que os prédios da orla
fazem sombra na areia às três da tarde,
por que ninguém planejou um banco
onde a gente pudesse sentar
e simplesmente olhar.

Mas hoje eu não explico.
Hoje eu só desço a avenida
junto com ela,
até o mar.

#cidade #mar #joaopessoa #arquitetura""",
        "Epitácio Pessoa, 18h",
    ),
    Poema(
        "livre_domingo",
        "bia_med",
        "verso_livre",
        """\
No domingo eu não sei o nome dos ossos.
Esqueço o úmero, o rádio, a ulna,
deixo o corpo ser só corpo,
sem legenda.

Minha mãe liga de Cajazeiras
e pergunta se eu estou comendo direito.
Eu digo que sim
e como bolacha olhando o teto.

No domingo o coração
não é um músculo estriado:
é só esse bicho
que aperta quando o telefone desliga.

#saudade #medicina #domingo""",
        "Anatomia de um domingo",
    ),
    Poema(
        "livre_patos",
        "caio_eng",
        "verso_livre",
        """\
Patos fica a trezentos quilômetros daqui
e a uma vida inteira de distância.

Lá o sol não é praia,
é ofício.
Lá a gente aprende cedo
que sombra é coisa que se divide.

Eu vim para a capital
com uma mala azul e uma lista de recomendações:
não andar de noite pela Lagoa,
ligar todo domingo,
não esquecer de onde veio.

    A estrada desce a Borborema
    como quem tira o chapéu,
    e cada curva leva um pedaço
    do menino que eu era.

Aqui eu calculo pontes,
mas ninguém me ensina a atravessar
o domingo à tarde,
quando minha mãe manda áudio
com o barulho da feira ao fundo
e eu escuto três vezes
só para ouvir o vendedor de queijo
gritando o preço como quem canta.

#saudade #sertao #patos""",
        "Saudade de Patos",
    ),
    Poema(
        "livre_stack",
        "rafa_cc",
        "verso_livre",
        """\
chamei a função de mim mesmo
dentro de mim mesmo
dentro de mim mesmo
dentro de

faltou a condição de parada.

a psicóloga do campus disse
que isso tem nome,
que é ansiedade,
que o loop não é defeito de caráter.

hoje eu escrevi, no topo do código,
num comentário que ninguém vai ler:

    # se estiver cansado, retorne.

#madrugada #computacao #ansiedade""",
        "stack overflow",
    ),
    Poema(
        "livre_ensaio",
        "helena_musica",
        "verso_livre",
        """\
Na sala dos fundos da igreja do Carmo,
onde a orquestra do bairro ensaia,
alguém afina um violoncelo
há vinte minutos.

Eu espero a minha vez
com a flauta no colo
e penso que a vida inteira é isso:
afinar
  afinar
    afinar
até a nota certa aparecer
por um segundo
e sumir
antes do aplauso.

#musica #orquestra #ensaio""",
        "Ensaio de terça",
    ),
    Poema(
        "livre_fotossintese",
        "ana_clara_bio",
        "verso_livre",
        """\
A professora explicou a fotossíntese
e eu fiquei com inveja das folhas.

Elas pegam a luz que cai de graça,
a água que sobe do chão,
o ar que todo mundo já respirou,
e fazem disso açúcar.

Eu pego o sol das sete no ponto de ônibus,
a água do bebedouro do CCEN,
o ar viciado da sala sem janela,
e faço disso, com sorte,
um poema meio amargo.

Talvez eu ainda esteja aprendendo.
As folhas tiveram milhões de anos.

#biologia #ufpb #sol""",
        "Fotossíntese",
    ),
    Poema(
        "livre_pauta",
        "isabela_jor",
        "verso_livre",
        """\
Pauta do dia:
cobrir a greve dos motoristas,
entrevistar o prefeito,
escrever trinta linhas sobre a chuva que alagou a avenida.

Fora de pauta:
a senhora que me ofereceu o guarda-chuva
na parada da Aldeota
e disse "pode ficar, minha filha,
eu já me molhei demais nessa vida".

Essa não vai sair no jornal.
Por isso escrevo aqui.

#chuva #jornalismo #cidade""",
        "Pauta do dia",
    ),
    Poema(
        "livre_coxia",
        "clara_teatro",
        "verso_livre",
        """\
Da coxia se vê o palco ao contrário:
a plateia é um mar escuro
e a luz, um sol que não esquenta.

Faltam três minutos.
Eu repito a primeira fala
como quem reza:
    "Eu não vim aqui para ser perdoada."
    "Eu não vim aqui para ser perdoada."
    "Eu não vim aqui para ser perdoada."

Minha mãe está na quinta fileira.
Ela veio de Sapé de ônibus
e não sabe o que é dramaturgia,
mas sabe que eu choro antes de entrar,
desde pequena,
desde a peça do jardim de infância
em que eu fui uma nuvem
e esqueci de chover.

Falta um minuto.
O contrarregra faz sinal.
A luz se acende do outro lado.

    E eu entro,
    não para ser perdoada,
    mas para ser vista
    pela primeira vez
    inteira.

#teatro #palco #mae""",
        "Monólogo para a coxia",
    ),
    Poema(
        "livre_boa_viagem",
        "nina_ufpe",
        "verso_livre",
        """\
O mar de Boa Viagem acorda antes de mim
e já está cansado.

Corredores passam,
um vendedor de coco monta a barraca,
a placa dos tubarões continua lá,
avisando o que ninguém quer ouvir.

Eu sento na areia com o livro de Teoria Literária
e não leio nenhuma linha.

Tem dias em que o mar
é a única teoria
que me interessa.

#mar #recife #letras""",
        "Seis da manhã",
    ),
    Poema(
        "livre_tabela",
        "matheus_quimica",
        "verso_livre",
        """\
Meu pai é ferro:
enferruja na chuva, mas não quebra.

Minha mãe é carbono:
está em tudo o que é vivo lá em casa.

Minha avó é hélio:
leve, nobre, não reage a briga nenhuma,
e um dia vai subir.

Meu irmão é sódio:
basta um pouco de água para explodir.

E eu, que ainda estou no terceiro ano,
ainda não sei.
Talvez um desses elementos instáveis
que só existem por uma fração de segundo
no laboratório,
antes de virar outra coisa.

#quimica #familia""",
        "Tabela periódica da minha família",
    ),
    Poema(
        "livre_recreio",
        "larissa_ped",
        "verso_livre",
        """\
Na escola, a coordenadora
me pediu para olhar as crianças no recreio.

Olhei.

Uma menina enterrava um pirulito
para ver se nascia uma árvore de pirulito.
Um menino contava as formigas
e perdia a conta
e começava de novo
sem nenhuma raiva.

Voltei para a sala com vontade
de rasgar o plano de aula
e escrever só isto no quadro:
    hoje a gente vai aprender a esperar.

#pedagogia #infancia #escola""",
        "Recreio",
    ),
    Poema(
        "livre_reabilitacao",
        "pedro_fisio",
        "verso_livre",
        """\
Dona Lúcia voltou a andar
dez passos por semana.

Na primeira, segurou a barra
com as duas mãos e com os dentes.
Na terceira, soltou uma.
Na sexta, me disse:
"meu filho, eu quero ir na missa sozinha".

Ninguém me falou na faculdade
que a gente também se reabilita
vendo alguém atravessar a sala
como quem atravessa o mar.

#fisioterapia #cuidado""",
        "Reabilitação",
    ),
    Poema(
        "livre_habeas",
        "joao_direito",
        "verso_livre",
        """\
Peço habeas corpus
para o menino que eu era
antes da OAB, antes do estágio,
antes de aprender a dizer "data venia"
sem rir.

Ele está preso
em algum lugar entre o Código Civil
e a pilha de processos da Defensoria,
e às vezes bate na porta
pedindo para sair
e jogar bola na rua de terra.

Excelência,
não há perigo de fuga:
ele só quer
uma tarde.

#direito #infancia""",
        "Habeas corpus",
    ),
    Poema(
        "livre_br230",
        "vitor_ufcg",
        "verso_livre",
        """\
Entre Campina e João Pessoa
são cento e vinte quilômetros
de ônibus intermunicipal,
de fone de ouvido sem bateria,
de cana dos dois lados da estrada.

Eu conheço cada quebra-molas.
Conheço a curva em que o celular perde o sinal
e a gente fica sozinho com o que pensa.

É nessa curva que eu escrevo.
Talvez todo poema meu
seja só um trecho da BR
sem cobertura.

#ônibus #campina #estrada""",
        "BR-230",
    ),
    Poema(
        "livre_planilha",
        "enzo_eco",
        "verso_livre",
        """\
Fiz uma planilha da minha vida:
receitas, despesas, saldo.

Na coluna de receitas:
o salário do dia cinco,
o almoço de domingo na casa da avó,
o abraço do meu amigo quando passei no concurso.

Na coluna de despesas:
o aluguel no Rio Vermelho,
as madrugadas,
o tempo que perdi com quem não me via.

O saldo deu negativo.
Mas a fórmula estava errada:
esqueci de somar
as tardes em que eu ri sem motivo.

#economia #madrugada #amizade""",
        "Planilha",
    ),
    Poema(
        "livre_creditos",
        "sofia_cinema",
        "verso_livre",
        """\
Sou a última a sair da sala
porque fico para os créditos.

Leio o nome do eletricista,
da maquiadora,
do motorista da produção,
do rapaz que segurou o microfone
por horas
para que a gente ouvisse um sussurro.

Ninguém lembra deles,
mas sem eles
o beijo final
seria mudo.

Quando eu fizer o meu filme,
o primeiro nome
vai ser o do vigia
que deixou a gente gravar de madrugada.

#cinema #ufpb #madrugada""",
        "Créditos finais",
    ),
    Poema(
        "livre_senha",
        "iago_ifpb",
        "verso_livre",
        """\
Minha senha tem oito caracteres,
uma letra maiúscula,
um número
e um símbolo especial.

É a data em que você foi embora
com um ponto de exclamação no final.

Todo dia eu digito
e o sistema me deixa entrar.

Só eu não consigo.

#amor #saudade #computacao""",
        "Senha",
    ),
    Poema(
        "livre_chuva_jp",
        "marina_letras",
        "verso_livre",
        """\
Chove em João Pessoa
e a cidade inteira
vira um rascunho molhado.

Os ônibus atrasam,
os guarda-chuvas viram do avesso,
e eu fico na marquise do CCHLA
lendo no celular um poema
que alguém escreveu
debaixo de outra chuva.

#chuva #joaopessoa #ufpb""",
    ),
    Poema(
        "livre_seminario",
        "camila_filo",
        "verso_livre",
        """\
O professor perguntou
o que é o tempo.

Silêncio na sala.
O ar-condicionado pingando.
Alguém olhou o relógio
sem perceber a ironia.

Eu queria ter dito:
o tempo é o intervalo
entre a sua pergunta
e a nossa coragem de responder.

Mas fiquei calada
e o tempo passou.

#filosofia #ufpb #aula""",
        "Pergunta de seminário",
    ),
    Poema(
        "livre_mae",
        "yasmin_enf",
        "verso_livre",
        """\
Mãe,
você limpava a casa dos outros
para eu poder estudar.

Hoje eu limpo feridas
de gente que eu nunca vi
e penso em você
a cada luva que eu calço.

Não é a mesma coisa.
É a mesma coisa.

#enfermagem #mae #cuidado""",
        "Mãe, eu escolhi cuidar",
    ),
    Poema(
        "livre_assintota",
        "gabriel_mat",
        "verso_livre",
        """\
Eu me aproximo de você
como uma função se aproxima da reta:
cada vez mais perto,
cada vez mais perto,
sem nunca tocar.

O professor diz que isso é lindo,
que o limite existe
mesmo quando a gente não chega.

O professor nunca se apaixonou
por alguém da turma de Álgebra Linear.

#matematica #amor #prova""",
        "Assíntota",
    ),
    # ------------------------------------------- de outros lugares e idades
    Poema(
        "cordel_ponto_final",
        "damiao_cordel",
        "cordel",
        """\
Sou motorista de linha
faz vinte e dois carnavais,
conheço cada buraco
da Agamenon e mais,
conheço cada freguês
que desce e não volta mais.

Às cinco eu ligo o motor,
o café ainda quente;
sobe a moça da feira,
sobe o velho, sobe o doente,
sobe o menino da escola
com o sono na frente.

No ponto final eu paro
quinze minutos de paz,
tiro o caderno do bolso,
escrevo o que a rua me traz:
a briga, o beijo, o troco,
o povo que vai e que faz.

Tem gente que lê jornal,
tem gente que lê o celular;
eu leio a cara do povo
pelo espelho, devagar,
e cada rosto que eu levo
vira verso no lugar.

Se um dia eu me aposentar,
não me deem relógio, não:
me deem este cordel
num livro de papelão,
que a linha que eu mais rodei
foi a do meu coração.

#ônibus #caruaru #cordel""",
        "Cordel do ponto final",
    ),
    Poema(
        "trova_lotado",
        "damiao_cordel",
        "trova",
        """\
O ônibus vai lotado,
o povo vai sem lugar;
mas quem anda apertado
aprende a se abraçar.

#ônibus #cidade""",
    ),
    Poema(
        "soneto_giz",
        "lourdes_paiva",
        "soneto",
        """\
Guardei o giz na última gaveta,
junto com a chamada e uma lembrança:
o nome de uma aluna, ainda criança,
que me escreveu, com letra incompleta,

"professora, eu também vou ser poeta".
Passaram trinta anos. A esperança
anda devagar, mas sempre alcança:
ontem li seu soneto, e a rima é completa.

Contei as sílabas, como no passado,
batendo o dedo na mesa da cozinha,
e achei um verso torto, um só, coitado.

Não corrigi. Deixei-o ali, sozinha,
sorrindo para o verso desajeitado:
o erro, agora, é dela. A lição foi minha.

#escola #memoria""",
        "Soneto do giz",
    ),
    Poema(
        "quadra_camoes",
        "lourdes_paiva",
        "quadra",
        """\
Li Camões aos dezessete,
reli aos setenta e dois:
o amor que ele promete
só se entende depois.

#amor #releitura""",
    ),
    Poema(
        "livre_secao_poesia",
        "tomas_guaiba",
        "verso_livre",
        """\
Todo fim de tarde
a cidade desce até o Guaíba
para ver o sol se afogar
devagar,
como quem não quer incomodar.

Eu fecho a biblioteca às seis,
confiro as janelas,
apago a luz da seção de poesia
por último,
porque é ali que os livros conversam
quando ninguém está.

    No caminho, levo um deles emprestado
    sem anotar na ficha.
    É o único furto que eu cometo:
    devolvo sempre,
    um pouco mais lido.

O sol já foi.
O rio ficou com a cor dele
por mais uns minutos,
e eu também.

#portoalegre #biblioteca #rio""",
        "Seção de poesia",
    ),
    Poema(
        "haicai_minuano",
        "tomas_guaiba",
        "haicai",
        """\
minuano na fresta —
o chimarrão esfria
antes do poema

#frio #portoalegre""",
    ),
    Poema(
        "livre_interprete",
        "aline_libras",
        "verso_livre",
        """\
Na reunião da escola
eu traduzo a diretora para as mãos
e as mãos para a mãe da terceira fila.

Ela não ouve o microfone chiar,
mas vê quando eu faço o sinal de orgulho
e sorri antes de todo mundo.

Tem palavra que custa a caber nas mãos.
Saudade, por exemplo:
eu faço devagar, perto do peito,
com o rosto olhando longe,
e ela entende
melhor que muita gente que ouve.

#libras #manaus #saudade""",
        "Intérprete",
    ),
    Poema(
        "trova_costura",
        "cida_costura",
        "trova",
        """\
Costuro a barra da saia,
costuro a manga e o botão;
só não há linha que caia
no rasgo do coração.

#costura #saudade""",
    ),
    Poema(
        "quadra_neta",
        "cida_costura",
        "quadra",
        """\
Minha neta pediu um verso
pra ler na escola amanhã;
dei a ela, num envelope,
a trova que eu fiz pra mãe.

#familia #neta""",
    ),
    Poema(
        "livre_florbela",
        "larissa_ped",
        "verso_livre",
        """\
Leio Florbela no recreio,
entre um apito e outro,
com o pão de queijo esfriando no guardanapo.

Ela sofria tão bonito
que eu tenho vergonha
de sofrer só de cansaço.

Mas à noite, depois do banho dos meninos,
quando a casa enfim dorme,
eu abro o caderno
e escrevo o meu cansaço
com a mesma letra caprichada
que eu ensino de manhã.

#florbela #mae #escola""",
        "Recreio com Florbela",
    ),
    # ------------------------------------------------------------------ outro
    Poema(
        "acrostico_ifpb",
        "iago_ifpb",
        "outro",
        """\
Ipê na entrada da escola,
Florido em setembro de amarelo;
Passo por ele toda manhã, atrasado:
Bom dia, árvore. Hoje eu volto cedo.

#ifpb #acrostico""",
        "Acróstico",
    ),
)

CITACOES = (
    Citacao(
        "nina_ufpe",
        "soneto_biblioteca",
        """\
"alguém, antes de mim, sublinhou"

E agora eu sublinho você. Que soneto, Marina.

#biblioteca""",
    ),
    Citacao(
        "vitor_ufcg",
        "livre_patos",
        """\
Pra quem também deixou o sertão pra estudar no litoral. Leiam até o fim,
o vendedor de queijo no último verso me quebrou.

#saudade #sertao""",
    ),
    Citacao(
        "camila_filo",
        "haicai_commit",
        """\
"um verso que compile"

Talvez toda poesia seja isso: uma tentativa de fazer o mundo rodar sem erro.

#madrugada""",
    ),
    Citacao(
        "lucas_agro",
        "cordel_1500",
        """\
Mandei pro grupo da família e meu neto, que pega ônibus pra escola, se reconheceu no Zé.

#ônibus""",
    ),
    Citacao(
        "yasmin_enf",
        "soneto_plantao",
        """\
"e arrumo o travesseiro como prece"

Quem trabalha no hospital sabe que é isso mesmo.

#plantao""",
    ),
    Citacao(
        "clara_teatro",
        "soneto_re_menor",
        """\
Li em voz alta no ensaio de hoje e a turma pediu bis.

#teatro #musica""",
    ),
)

# Citação de um consagrado, feita depois da importação (se houver consagrados).
# {nome} é o nome do poeta citado.
CITACAO_DE_CONSAGRADO = Citacao(
    "marina_letras",
    "",
    """\
Reli {nome} hoje no ônibus, entre o Centro e o campus,
e fiquei com vontade de responder em verso:

tem poema que atravessa o tempo todo
e chega inteiro na minha parada,
com a tinta ainda molhada.

#consagrados #ônibus""",
)

# Os mais lidos da semana: concentram as curtidas, como numa rede de verdade.
EM_ALTA = (
    "cordel_1500",
    "soneto_biblioteca",
    "livre_patos",
    "prosa_lide",
    "haicai_commit",
    "soneto_estuario",
)

CONVERSAS = {
    "soneto_biblioteca": (
        Conversa(
            "joao_direito",
            "Que bonito esse \"alguém, antes de mim, sublinhou\". Dá vontade de saber quem foi.",
            (
                Conversa(
                    "marina_letras",
                    "Eu também queria saber! O livro era do acervo antigo, então deve ser "
                    "alguém dos anos 80.",
                    (
                        Conversa(
                            "camila_filo",
                            "Isso dá outro poema: uma conversa com o leitor anterior.",
                            (
                                Conversa(
                                    "marina_letras",
                                    "Anotado. Vou chamar de \"Marginália\".",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
        Conversa(
            "nina_ufpe",
            "Crítica gentil: o último verso, \"ainda acesa dentro, como um dia\", me pareceu "
            "mais fraco que o resto. O que você quis com o \"como um dia\"?",
            (
                Conversa(
                    "marina_letras",
                    "Justo. Queria a ideia de que a frase continua clara mesmo de noite, "
                    "mas talvez não tenha chegado lá.",
                    (
                        Conversa(
                            "helena_musica",
                            "Eu li como o dia que ainda não acabou dentro dela. Pra mim funcionou.",
                        ),
                    ),
                ),
            ),
        ),
    ),
    "cordel_1500": (
        Conversa(
            "rafa_cc",
            "Ri alto com o senhor da galinha. Isso aconteceu de verdade?",
            (
                Conversa(
                    "thiago_hist",
                    "Com galinha não, mas com um papagaio, sim. Licença poética.",
                ),
            ),
        ),
        Conversa(
            "caio_eng",
            "A métrica está muito boa. Só na quinta estrofe, \"pisou no pé do cobrador\" "
            "me pareceu ter uma sílaba a mais. Contei errado?",
            (
                Conversa(
                    "thiago_hist",
                    "Contou certo! Pensei em trocar por \"pisou no pé do fiscal\".",
                    (
                        Conversa(
                            "lucas_agro",
                            "Mas \"cobrador\" é muito mais 1500 do que \"fiscal\". Eu deixaria, "
                            "cordel aguenta uma sílaba.",
                            (
                                Conversa(
                                    "thiago_hist",
                                    "Vou deixar, então. O povo decidiu.",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
        Conversa(
            "enzo_eco",
            "Isso aqui não é poema, é crônica rimada.",
            (
                Conversa(
                    "marina_letras",
                    "Cordel é poesia, Enzo, e das mais nossas. Sextilha, rima nos versos pares, "
                    "sete sílabas: tem mais forma aí do que em muito soneto.",
                ),
                Conversa(
                    "thiago_hist",
                    "Crônica rimada é um elogio, viu? Meu avô dizia que o cordel é o jornal do sertão.",
                ),
            ),
            apagar=True,
        ),
    ),
    "soneto_plantao": (
        Conversa(
            "yasmin_enf",
            "\"a enfermaria, devagar, se aquece\" me pegou. É exatamente a hora em que o sol "
            "entra pela janela do HU.",
            (Conversa("bia_med", "É essa janela mesmo, a do terceiro andar."),),
        ),
        Conversa(
            "luiza_psi",
            "Uma pergunta: por que \"irmão\" no verso 8? O Seu Antônio é paciente, não irmão.",
            (
                Conversa(
                    "bia_med",
                    "Pensei em irmão no sentido amplo, mas você tem razão, pode confundir.",
                    (
                        Conversa(
                            "joao_direito",
                            "Eu li como se o medo dele fosse o mesmo de qualquer um de nós. "
                            "Pra mim funciona.",
                            (
                                Conversa(
                                    "luiza_psi",
                                    "Faz sentido. Retiro a pergunta, fica a admiração.",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    ),
    "haicai_commit": (
        Conversa(
            "iago_ifpb",
            "\"um verso que compile\" é muito bom.",
            (
                Conversa(
                    "rafa_cc",
                    "Passei a madrugada com um bug de ponteiro, alguma coisa boa tinha que sair.",
                ),
            ),
        ),
        Conversa(
            "gabriel_mat",
            "Contei o primeiro verso com quatro sílabas, não cinco. Haicai em português "
            "aguenta isso?",
            (
                Conversa(
                    "camila_filo",
                    "Aguenta. Muita gente prefere o recorte da imagem à contagem rígida.",
                    (
                        Conversa(
                            "rafa_cc",
                            "Vou ficar com a imagem, então. Obrigado aos dois.",
                        ),
                    ),
                ),
            ),
        ),
    ),
    "livre_patos": (
        Conversa(
            "vitor_ufcg",
            "Sou de Sousa e chorei no ônibus lendo isso.",
            (Conversa("caio_eng", "Sertão é tudo um bairro só, Vitor."),),
        ),
        Conversa(
            "davi_arq",
            "A estrofe recuada parece a estrada descendo a Borborema. Foi de propósito?",
            (
                Conversa(
                    "caio_eng",
                    "Foi! Queria que o poema descesse a serra junto.",
                    (
                        Conversa(
                            "marina_letras",
                            "Dá pra sentir a curva. Esse recuo é o melhor verso do poema "
                            "sem ser um verso.",
                        ),
                    ),
                ),
            ),
        ),
    ),
    "soneto_reu": (
        Conversa(
            "helena_musica",
            "\"o tom menor do riso\" é lindo. Traz a música pra dentro do poema.",
        ),
        Conversa(
            "matheus_quimica",
            "Quem é a moça do corredor?",
            (Conversa("joao_direito", "Segredo de justiça."),),
            apagar=True,
        ),
        Conversa(
            "nina_ufpe",
            "As rimas em -ante nos tercetos ficaram ótimas. \"Doravante\" fechando é muito "
            "Direito e muito soneto ao mesmo tempo.",
        ),
    ),
    "prosa_lide": (
        Conversa(
            "sofia_cinema",
            "Usar a estrutura do lide como forma é genial. Dá uma série.",
            (
                Conversa(
                    "isabela_jor",
                    "Pensei em fazer \"Pirâmide invertida\" na próxima.",
                    (Conversa("enzo_eco", "Quero ler. E o \"ainda estou apurando\" é perfeito."),),
                ),
            ),
        ),
    ),
    "soneto_estuario": (
        Conversa(
            "marina_letras",
            "\"meio Recife, meio dicionário\" entrou pro meu caderno.",
            (Conversa("nina_ufpe", "Que honra, Marina!"),),
        ),
        Conversa(
            "thiago_hist",
            "Uma pergunta técnica: o verso 9 ficou maior que os outros. Foi intencional, "
            "como o rio que transborda?",
            (
                Conversa(
                    "nina_ufpe",
                    "Não foi, mas agora vou dizer que foi.",
                    (Conversa("gabriel_mat", "Melhor resposta de oficina."),),
                ),
            ),
        ),
    ),
    "livre_coxia": (
        Conversa(
            "larissa_ped",
            "\"em que eu fui uma nuvem / e esqueci de chover\". Não consigo parar de pensar nisso.",
            (
                Conversa(
                    "clara_teatro",
                    "Aconteceu de verdade. A professora me chamou de nuvem seca o ano inteiro.",
                ),
            ),
        ),
    ),
    "cordel_ponto_final": (
        Conversa(
            "thiago_hist",
            "O senhor é o Zé do meu cordel, só que do outro lado do volante.",
            (
                Conversa(
                    "damiao_cordel",
                    "Já levei muito Zé atrasado pra prova, professor. Todos chegaram.",
                ),
            ),
        ),
        Conversa(
            "lourdes_paiva",
            "\"pelo espelho, devagar\" é a melhor imagem: ler o povo pelo retrovisor. "
            "Só no quarto verso da primeira estrofe a métrica pede uma sílaba.",
            (
                Conversa(
                    "damiao_cordel",
                    "A senhora tem razão. Vou pensar no ponto final de hoje.",
                ),
            ),
        ),
    ),
    "soneto_giz": (
        Conversa(
            "nina_ufpe",
            "\"o erro, agora, é dela. A lição foi minha.\" Que fecho, dona Lourdes.",
            (
                Conversa(
                    "lourdes_paiva",
                    "Obrigada, minha filha. Quarenta anos corrigindo redação servem pra alguma coisa.",
                ),
            ),
        ),
    ),
}

ANTOLOGIAS = (
    Antologia(
        "marina_letras",
        "Poemas de chuva",
        "Para ler na marquise do CCHLA, esperando a chuva passar.",
        True,
        (
            "haicai_onibus",
            "livre_chuva_jp",
            "haicai_servidor",
            "livre_pauta",
            "cordel_seca",
        ),
    ),
    Antologia(
        "davi_arq",
        "Para ler no ônibus",
        "Poemas que cabem entre duas paradas (e um cordel para quando o 1500 atrasa).",
        True,
        (
            "haicai_seixas",
            "trova_feijao",
            "quadra_campina",
            "livre_br230",
            "cordel_1500",
            "haicai_cafe",
        ),
    ),
    Antologia(
        "nina_ufpe",
        "Sonetos da rede",
        "Catorze versos de cada canto: do advogado à flautista aposentada. Soneto não é coisa do passado.",
        True,
        (
            "soneto_biblioteca",
            "soneto_reu",
            "soneto_plantao",
            "soneto_viga",
            "soneto_re_menor",
            "soneto_estuario",
            "soneto_infinito",
            "soneto_sessao",
            "soneto_giz",
        ),
    ),
    Antologia(
        "luiza_psi",
        "Para os dias difíceis",
        "Só pra mim.",
        False,
        ("livre_stack", "prosa_carta", "livre_recreio", "livre_reabilitacao"),
    ),
)


class Renga(NamedTuple):
    """Poema colaborativo: `estrofes` em ordem, (autor, texto); a primeira é do criador.

    Com tantas estrofes quanto o `limite`, a renga fecha sozinha.
    """

    criador: str
    titulo: str
    modo: str
    limite: int
    convidados: tuple[str, ...]
    estrofes: tuple[tuple[str, str], ...]


# Uma aberta (a conta demo pode escrever a próxima), uma fechada pelo limite e
# uma só de convidados (a demo é convidada).
RENGAS = (
    Renga(
        "caio_eng",
        "Renga do 1500",
        "aberta",
        12,
        (),
        (
            (
                "caio_eng",
                """\
O 1500 dobra a curva do Castelo Branco
e eu, de pé, seguro a barra e o caderno:
cada freada é uma vírgula
que o motorista põe sem perguntar.""",
            ),
            (
                "rafa_cc",
                """\
Do banco da frente, uma senhora
    reza o terço em voz baixa,
e o rosário balança no compasso
dos buracos da Pedro II.""",
            ),
            (
                "isabela_jor",
                """\
Meu fone acabou a bateria
no meio da música —
agora escuto o ônibus inteiro:
    o troco, a catraca, alguém rindo no fundo.""",
            ),
            (
                "iago_ifpb",
                """\
Desço na parada do IFPB
com a estrofe ainda no bolso;
quem pegar o próximo
que continue a viagem.""",
            ),
        ),
    ),
    Renga(
        "bia_med",
        "Renga da feira de domingo",
        "aberta",
        4,
        (),
        (
            (
                "bia_med",
                """\
Domingo cedo na feira:
o sol ainda não decidiu
e a moça da banca de coentro
já sabe o nome de todo mundo.""",
            ),
            (
                "thiago_hist",
                """\
Na barraca do caldo de cana,
quatro desconhecidos dividem o banco:
    um explica a crise,
    outro defende o milho.""",
            ),
            (
                "yasmin_enf",
                """\
Alguém derruba as laranjas
e a feira inteira ajuda a catar —
é o único mutirão da semana
que ninguém precisou marcar.""",
            ),
            (
                "lucas_agro",
                """\
Volto com a sacola cheia
e o troco de três reais:
o mais barato que já pesou
tanto quanto um poema.""",
            ),
        ),
    ),
    Renga(
        "nina_ufpe",
        "Renga do sarau de quinta",
        "convidados",
        8,
        ("marina_letras", "helena_musica", "clara_teatro"),
        (
            (
                "nina_ufpe",
                """\
Quinta à noite, no fundo da livraria:
o sarau começa sem microfone
e o ventilador de teto,
    como sempre, decide por nós.""",
            ),
            (
                "helena_musica",
                """\
Trouxe o violão por engano
e agora cada verso pede acorde:
    lá menor para a saudade,
    ré para quem chegou atrasado.""",
            ),
            (
                "clara_teatro",
                """\
Leio a minha estrofe de pé,
como quem entra em cena:
o papel treme mais que a voz,
e a plateia são seis cadeiras e um amigo.""",
            ),
        ),
    ),
)
