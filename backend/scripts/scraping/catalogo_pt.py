"""Coleção única, no pt.wikisource, de cada poeta do bloco em português.

A coleção é a categoria com os poemas transcritos (ou o livro, quando a
categoria do autor não lista as peças). Epopeia não entra inteira: o coletor
fica com o excerto de abertura.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Alvo:
    username: str
    categorias: tuple[str, ...]
    # Poeta novo. None = já existe em data/consagrados; só se acrescentam poemas.
    name: str | None = None
    busca: str | None = None
    bio: str | None = None
    cordel: bool = False
    # Wikisource de origem. "pt" usa o namespace Categoria; os outros, Category.
    wiki: str = "pt"
    # Se preenchido, a coleção são as subpáginas deste prefixo (um livro), não a categoria.
    prefixo: str | None = None
    # QID do Wikidata quando a busca pelo nome acerta noutro homónimo.
    qid: str | None = None


# Categorias conferidas na API: é onde os poemas transcritos estão de facto.
EXISTENTES: tuple[Alvo, ...] = (
    Alvo("alberto_de_oliveira", ("Alberto de Oliveira",)),
    Alvo("alphonsus_de_guimaraens", ("Alphonsus de Guimaraens",)),
    Alvo("alvares_de_azevedo", ("Álvares de Azevedo",)),
    Alvo("antero_de_quental", ("Antero de Quental",)),
    Alvo("augusto_dos_anjos", ("Augusto dos Anjos",)),
    Alvo("auta_de_souza", ("Auta de Sousa",)),
    Alvo("bocage", ("Bocage",)),
    Alvo("camilo_pessanha", ("Camilo Pessanha",)),
    Alvo("camoes", ("Luís Vaz de Camões",)),
    Alvo("casimiro_de_abreu", ("Casimiro de Abreu",)),
    Alvo("castro_alves", ("Castro Alves",)),
    Alvo("cesario_verde", ("Cesário Verde",)),
    Alvo("cruz_e_sousa", ("Cruz e Sousa",)),
    Alvo("fagundes_varela", ("Fagundes Varela",)),
    Alvo("fernando_pessoa", ("Fernando Pessoa",)),
    Alvo("florbela_espanca", ("Florbela Espanca",)),
    Alvo("goncalves_dias", ("Gonçalves Dias",)),
    Alvo("gregorio_de_matos", ("Gregório de Matos",)),
    Alvo("guerra_junqueiro", ("Guerra Junqueiro",)),
    Alvo("machado_de_assis", ("Machado de Assis",)),
    Alvo("mario_de_andrade", ("Mário de Andrade",)),
    Alvo("olavo_bilac", ("Olavo Bilac",)),
    Alvo("raimundo_correia", ("Raimundo Correia",)),
    Alvo("sa_carneiro", ("Mário de Sá-Carneiro",)),
    # As liras estão na categoria do livro, não na do autor.
    Alvo("tomas_antonio_gonzaga", ("Marília de Dirceu",)),
    Alvo("sousandrade", ("Sousândrade",)),
    Alvo("vicente_de_carvalho", ("Vicente de Carvalho",)),
)


NOVOS: tuple[Alvo, ...] = (
    Alvo(
        "claudio_manuel",
        ("Cláudio Manuel da Costa",),
        "Cláudio Manuel da Costa",
        "Cláudio Manuel da Costa",
        "Poeta mineiro do Arcadismo, nascido em Mariana, conhecido na Arcádia como "
        "Glauceste Satúrnio. As Obras poéticas (1768) fixam o soneto da terra do ouro, "
        "e Vila Rica é o poema da capitania. É a voz lírica da Inconfidência e um dos "
        "fundadores da poesia brasileira.",
    ),
    Alvo(
        "basilio_da_gama",
        ("O Uraguai",),
        "Basílio da Gama",
        "Basílio da Gama",
        "Poeta fluminense do Arcadismo. O Uraguai, epopeia em versos brancos sobre a "
        "guerra contra as missões jesuíticas, é o poema narrativo mais célebre do "
        "século XVIII brasileiro. Aqui entra só a abertura do canto I, não a epopeia inteira.",
    ),
    Alvo(
        "santa_rita_durao",
        ("Caramuru", "Santa Rita Durão"),
        "Santa Rita Durão",
        "Santa Rita Durão",
        "Frei e poeta mineiro do Arcadismo. Caramuru é a epopeia do achamento da Bahia "
        "e de Diogo Álvares Correia, par a par com O Uraguai no século XVIII brasileiro. "
        "Entra o excerto de abertura, não o poema inteiro.",
    ),
    Alvo(
        "silva_alvarenga",
        ("Silva Alvarenga", "Manuel Inácio da Silva Alvarenga"),
        "Silva Alvarenga",
        "Manuel Inácio da Silva Alvarenga",
        "Poeta carioca do Arcadismo, Alcindo Palmireno na Arcádia Ultramarina. As "
        "Glaustas, em redondilhas, cantam o amor e a paisagem do Rio colonial. "
        "Participou da conjuração fluminense e ficou preso.",
    ),
    Alvo(
        "alvarenga_peixoto",
        ("Alvarenga Peixoto",),
        "Alvarenga Peixoto",
        "Inácio José de Alvarenga Peixoto",
        "Poeta mineiro do Arcadismo e inconfidente, morto no degredo em Ambaca. "
        "Deixou sonetos e liras de circunstância — a lírica civil da Inconfidência "
        "ao lado de Cláudio Manuel e Gonzaga.",
    ),
    Alvo(
        "junqueira_freire",
        ("Junqueira Freire", "Inspirações do Claustro"),
        "Junqueira Freire",
        "Luís José Junqueira Freire",
        "Poeta baiano da segunda geração romântica. Monge beneditino por um tempo, "
        "escreveu Inspirações do claustro, livro da crise entre o convento, o corpo "
        "e a fé. Morreu muito jovem, em Salvador.",
    ),
    Alvo(
        "laurindo_rabelo",
        ("Laurindo Rabelo",),
        "Laurindo Rabelo",
        "Laurindo Rabelo",
        "Poeta carioca da segunda geração romântica, o Poeta-Lagartixa. Médico e "
        "improvisador, ficou na memória popular pela sátira e pela trova, entre o "
        "humor e a melancolia.",
    ),
    Alvo(
        "bernardo_guimaraes",
        ("Bernardo Guimarães",),
        "Bernardo Guimarães",
        "Bernardo Guimarães",
        "Poeta e romancista mineiro da segunda geração romântica. Além da prosa de "
        "A escrava Isaura, deixou cantos, liras e o poema A orgia dos duendes. "
        "É uma das vozes do sertão na poesia do Império.",
    ),
    Alvo(
        "goncalves_magalhaes",
        ("Suspiros Poéticos e Saudades",),
        "Gonçalves de Magalhães",
        "Domingos José Gonçalves de Magalhães",
        "Poeta carioca, introdutor do romantismo no Brasil. Suspiros poéticos e "
        "saudades (1836), escrito em Paris, é o livro que abre a escola, com a "
        "religiosidade e o indianismo depois desenvolvido por Gonçalves Dias.",
    ),
    Alvo(
        "porto_alegre",
        ("Araújo Porto-Alegre", "Manuel de Araújo Porto-Alegre"),
        "Araújo Porto-Alegre",
        "Manuel de Araújo Porto-Alegre",
        "Poeta, pintor e diplomata gaúcho do romantismo. Autor de Brasilianas e do "
        "poema Colombo, participou do grupo de Magalhães na introdução da escola "
        "nova e foi um dos fundadores do conservatório dramático.",
    ),
    Alvo(
        "tobias_barreto",
        ("Tobias Barreto",),
        "Tobias Barreto",
        "Tobias Barreto",
        "Poeta, jurista e filósofo sergipano. Líder da Escola do Recife, escreveu "
        "versos românticos e depois de combate, em português e em alemão, e puxou "
        "a cultura brasileira para o germanismo no fim do Império.",
    ),
    Alvo(
        "francisca_julia",
        ("Francisca Júlia",),
        "Francisca Júlia",
        "Francisca Júlia",
        "Poeta paulista do Parnasianismo. Mármores e a segunda série de versos "
        "fizeram dela a principal voz feminina da escola no Brasil, ao lado da "
        "tríade Bilac, Raimundo Correia e Alberto de Oliveira.",
    ),
    Alvo(
        "emilio_de_meneses",
        ("Emílio de Meneses", "Emílio de Menezes", "Emilio de Menezes"),
        "Emílio de Meneses",
        "Emílio de Meneses",
        "Poeta paranaense do Parnasianismo, famoso pela sátira e pelo epigrama tanto "
        "quanto pelo soneto de Mortalha. Boêmio no Rio, foi temido pelo verso de "
        "circunstância e respeitado na forma.",
    ),
    Alvo(
        "luis_delfino",
        ("Luís Delfino",),
        "Luís Delfino",
        "Luís Delfino",
        "Poeta catarinense entre o romantismo tardio e o Parnaso. Médico no Rio, "
        "publicou pouco em vida; a obra vasta, sobretudo sonetos, saiu póstuma e "
        "entra no cânone pela perfeição formal.",
    ),
    Alvo(
        "bernardo_lopes",
        ("Bernardo Lopes", "B. Lopes"),
        "B. Lopes",
        "Bernardino da Costa Lopes",
        "Poeta fluminense do Parnasianismo, autor de Cromos e de Canções do Rio. "
        "O verso descreve o subúrbio e a paisagem carioca com o apuro da escola, "
        "sem o bronze oficial de Bilac.",
    ),
    Alvo(
        "emiliano_perneta",
        ("Emiliano Perneta",),
        "Emiliano Perneta",
        "Emiliano Perneta",
        "Poeta paranaense na passagem do Parnaso para o simbolismo. Ilusão e outros "
        "livros, mais a vida literária em Curitiba, fizeram dele o nome da geração "
        "simbolista no Paraná.",
    ),
    Alvo(
        "pedro_kilkerry",
        ("Pedro Kilkerry",),
        "Pedro Kilkerry",
        "Pedro Kilkerry",
        "Poeta baiano do simbolismo, quase inédito em vida. Os sonetos e fragmentos "
        "recuperados no século XX — a dicção torta, a imagem rara — colocam-no "
        "entre os precursores da modernidade poética no Brasil.",
    ),
    Alvo(
        "costa_e_silva",
        ("Da Costa e Silva", "Antônio Francisco da Costa e Silva"),
        "Da Costa e Silva",
        "Antônio Francisco da Costa e Silva",
        "Poeta piauiense, parnasiano e depois de uma lírica mais solta. Sangue e "
        "Zodíaco são os livros de referência, e o soneto dela ficou na memória "
        "escolar do início do século XX.",
    ),
    Alvo(
        "raul_de_leoni",
        ("Raul de Leoni",),
        "Raul de Leoni",
        "Raul de Leoni",
        "Poeta fluminense de Luz mediterrânea, livro único entre o Parnaso e o "
        "modernismo. A ode e o soneto filosófico, de fatura clássica, ficaram como "
        "uma das vozes mais citadas da geração morta jovem.",
    ),
    Alvo(
        "hermes_fontes",
        ("Hermes Fontes",),
        "Hermes Fontes",
        "Hermes Fontes",
        "Poeta sergipano de Apoteoses e A lâmpada velada, entre o simbolismo e o "
        "penumbrismo. A dicção elevada e a vida curta, encerrada no Rio, marcaram "
        "a leitura da poesia brasileira anterior a 1922.",
    ),
    Alvo(
        "jorge_de_lima",
        ("Jorge de Lima",),
        "Jorge de Lima",
        "Jorge de Lima",
        "Poeta alagoano, do soneto parnasiano de XIV alexandrinos ao modernismo de "
        "Poemas e ao grande poema de Invenção de Orfeu. Também romancista. A obra "
        "em verso é uma das pontes entre 1922 e a geração seguinte.",
    ),
    Alvo(
        "ronald_carvalho",
        ("Ronald de Carvalho",),
        "Ronald de Carvalho",
        "Ronald de Carvalho",
        "Poeta e ensaísta carioca, signatário da primeira fase modernista. Toda a "
        "América e os Epigramas irônicos e sentimentais, além da Pequena história "
        "da literatura brasileira, fixam o lugar dele na geração de 22.",
    ),
    Alvo(
        "juo_bananere",
        ("Juó Bananére", "Juo Bananere"),
        "Juó Bananére",
        "Alexandre Ribeiro Marcondes Machado",
        "Poeta paulista que assinou Juó Bananére, a máscara ítalo-paulistana de "
        "Alexandre Marcondes Machado. As cartas e sonetos em dialeto são a sátira "
        "da belle époque de São Paulo e um clássico do humor modernista.",
    ),
    Alvo(
        "catulo_cearense",
        ("Catulo da Paixão Cearense",),
        "Catulo da Paixão Cearense",
        "Catulo da Paixão Cearense",
        "Poeta e compositor maranhense criado no Ceará. Autor de Luar do sertão e "
        "de modinhas que passaram da página para a voz popular, é a ligação entre "
        "a poesia letrada e a canção sertaneja no começo do século XX.",
    ),
    Alvo(
        "leandro_barros",
        ("Leandro Gomes de Barros",),
        "Leandro Gomes de Barros",
        "Leandro Gomes de Barros",
        "Poeta paraibano, o maior cordelista clássico. Os folhetos — O boi misterioso, "
        "A intriga do cachorro com o gato, a Peleja com Zé Pretinho — fundam o cânone "
        "do cordel nordestino impresso.",
        True,
    ),
    Alvo(
        "sa_de_miranda",
        ("Sá de Miranda",),
        "Sá de Miranda",
        "Francisco de Sá de Miranda",
        "Poeta português do Renascimento. Trouxe de Itália o soneto, a oitava e a "
        "endecassílaba e escreveu as éclogas e as cartas que abrem o quinhentismo, "
        "ao lado de Bernardim e antes de Camões.",
    ),
    Alvo(
        "bernardim",
        ("Bernardim Ribeiro",),
        "Bernardim Ribeiro",
        "Bernardim Ribeiro",
        "Poeta português do Renascimento. As éclogas e as cantigas, com a novela "
        "Menina e moça, definem a lírica da saudade anterior a Camões. O verso "
        "curto e o cantar tradicional convivem com a medida nova.",
    ),
    Alvo(
        "gil_vicente",
        ("Gil Vicente",),
        "Gil Vicente",
        "Gil Vicente",
        "Poeta e dramaturgo português do teatro de corte manuelino. Autos, farsas "
        "e as trovas — entre elas a que se canta à Virgem — são a poesia dramática "
        "fundadora em português.",
    ),
    Alvo(
        "antonio_ferreira",
        ("António Ferreira", "Antonio Ferreira"),
        "António Ferreira",
        "António Ferreira",
        "Poeta português quinhentista, o mais doutrinário da medida nova. Os sonetos, "
        "as odes e a tragédia Castro (Inês de Castro) são o classicismo horaciano "
        "da geração de Coimbra.",
    ),
    Alvo(
        "filinto_elisio",
        ("Filinto Elísio",),
        "Filinto Elísio",
        "Francisco Manoel de Nascimento",
        "Poeta português do Arcadismo, exilado em Paris, que assinou Filinto Elísio. "
        "Defendeu o purismo da língua e deixou odes, epístolas e sátiras que o "
        "século XIX leu como mestre do verso solto.",
    ),
    Alvo(
        "marquesa_alorna",
        ("Marquesa de Alorna", "Leonor de Almeida Portugal"),
        "Marquesa de Alorna",
        "Leonor de Almeida Portugal",
        "Poeta portuguesa do Arcadismo e do pré-romantismo, Alcipe na Arcádia. "
        "Odes, sonetos e o poema à solidão, escritos em parte no convento de Chelas, "
        "abrem a lírica feminina moderna em Portugal.",
    ),
    Alvo(
        "almeida_garrett",
        ("Folhas Caídas",),
        "Almeida Garrett",
        "Almeida Garrett",
        "Poeta, dramaturgo e político português, introdutor do romantismo com Camões "
        "(1825) e Folhas caídas. O verso livre de emoção e o teatro de Frei Luís de "
        "Sousa refizeram a literatura nacional no século XIX.",
    ),
    Alvo(
        "joao_de_deus",
        ("João de Deus",),
        "João de Deus",
        "João de Deus Nogueira Ramos",
        "Poeta português do lirismo simples de Campo de flores. À margem das escolas, "
        "o verso curto e sentimental ficou na memória popular e na leitura escolar "
        "do fim do século XIX.",
    ),
    Alvo(
        "soares_de_passos",
        ("Soares de Passos", "António Augusto Soares de Passos"),
        "Soares de Passos",
        "António Augusto Soares de Passos",
        "Poeta português do ultra-romantismo. O noivado do sepulcro, no livro "
        "poemas da mocidade, é a balada fúnebre que define a geração de Coimbra "
        "antes de Antero.",
    ),
    Alvo(
        "gomes_leal",
        ("Gomes Leal",),
        "Gomes Leal",
        "António Gomes Leal",
        "Poeta português entre o ultra-romantismo, o parnaso e a sátira social. "
        "Claridades do sul e o Anti-Cristo, mais a figura excêntrica nas ruas de "
        "Lisboa, marcam o fim do século na poesia portuguesa.",
    ),
    Alvo(
        "antonio_nobre",
        ("António Nobre", "Antonio Nobre"),
        "António Nobre",
        "António Nobre",
        "Poeta português do Só (1892), livro único da saudade moderna. Entre o "
        "simbolismo e o falar da gente do Porto e da praia, abriu o caminho que "
        "Pessoa e a geração seguinte reconheceram.",
    ),
    Alvo(
        "eugenio_de_castro",
        ("Eugénio de Castro", "Eugenio de Castro"),
        "Eugénio de Castro",
        "Eugénio de Castro",
        "Poeta português, introdutor do simbolismo com Oaristos (1890). Professor "
        "em Coimbra, a obra longa — do verso raro de juventude ao classicismo "
        "posterior — organiza a escola em Portugal.",
    ),
    Alvo(
        "pascoaes",
        ("Teixeira de Pascoaes",),
        "Teixeira de Pascoaes",
        "Teixeira de Pascoaes",
        "Poeta português do saudosismo, em Amarante. Os poemas de Marânus, Regresso "
        "ao paraíso e a teoria da saudade como mito nacional são o núcleo da "
        "Renascença Portuguesa, ao lado e em disputa com o Orpheu.",
    ),
    Alvo(
        "angelo_de_lima",
        ("Ângelo de Lima", "Angelo de Lima"),
        "Ângelo de Lima",
        "Ângelo de Lima",
        "Poeta português ligado ao Orpheu, internado no Hospital de Rilhafoles. "
        "Os poemas publicados na revista, de sintaxe partida, são o extremo "
        "visionário da geração de Pessoa.",
    ),
    Alvo(
        "costa_alegre",
        ("Caetano da Costa Alegre",),
        "Caetano da Costa Alegre",
        "Caetano da Costa Alegre",
        "Poeta são-tomense que estudou medicina em Lisboa. Os versos publicados "
        "a título póstumo são a primeira voz lírica moderna da África de língua "
        "portuguesa, entre a cor, o amor e o exílio na metrópole.",
    ),
    Alvo(
        "oswald_andrade",
        ("Oswald de Andrade",),
        "Oswald de Andrade",
        "Oswald de Andrade",
        "Poeta e prosador paulista, autor dos manifestos antropófago e da poesia "
        "pau-brasil. Os poemas-piada de Pau Brasil e Primeiro caderno do aluno de "
        "poesia Oswald de Andrade são o núcleo lírico do modernismo de 1922.",
    ),
)
