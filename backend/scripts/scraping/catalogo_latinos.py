"""Bloco das línguas latinas e do espanhol: uma coleção por poeta.

Só entram livros ou categorias que a API mostrou transcritos. Epopeia
(L'Atlàntida) fica no excerto de abertura, pela regra geral do coletor.
"""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo("becquer", ("Rimas (Bécquer, 1885)",), wiki="es"),
    Alvo("baudelaire", (), wiki="fr", prefixo="Les Fleurs du mal (1861)/"),
    Alvo("rimbaud", (), wiki="fr", prefixo="Poésies (Rimbaud)/"),
    Alvo("verlaine", (), wiki="fr", prefixo="Fêtes galantes/"),
    Alvo("mallarme", ("Stéphane Mallarmé",), wiki="fr"),
    Alvo("victor_hugo", (), wiki="fr", prefixo="Les Contemplations/"),
    Alvo("apollinaire", (), wiki="fr", prefixo="Alcools/"),
    Alvo("ronsard", (), wiki="fr", prefixo="Sonnets pour Hélène/"),
    Alvo("dante", (), wiki="it", prefixo="Rime (Dante)/"),
    Alvo("petrarca", (), wiki="it", prefixo="Canzoniere (Rerum vulgarium fragmenta)/"),
    Alvo("leopardi", (), wiki="it", prefixo="Canti (Leopardi - Donati)/"),
    Alvo("rosalia_de_castro", ("Cantares gallegos",), wiki="gl"),
    Alvo("ruben_dario", ("Prosas profanas",), wiki="es"),
    Alvo("garcia_lorca", ("Romancero gitano",), wiki="es"),
    Alvo("cesar_vallejo", ("Trilce",), wiki="es"),
    # Procurados: a categoria não tem poemas transcritos. O JSON antigo fica.
    Alvo("quevedo", ("Francisco de Quevedo",), wiki="es"),
    Alvo("gongora", ("Luis de Góngora y Argote",), wiki="es"),
    Alvo("garcilaso", ("Garcilaso de la Vega",), wiki="es"),
    Alvo("jorge_manrique", ("Jorge Manrique",), wiki="es"),
    Alvo("san_juan_de_la_cruz", ("San Juan de la Cruz",), wiki="es"),
    Alvo("antonio_machado", ("Antonio Machado",), wiki="es"),
    Alvo("ariosto", ("Ludovico Ariosto",), wiki="it"),
    Alvo("tasso", ("Torquato Tasso",), wiki="it"),
)

NOVOS: tuple[Alvo, ...] = (
    Alvo(
        "lope_de_vega",
        ("Rimas (Lope de Vega)",),
        "Lope de Vega",
        "Lope de Vega",
        "Dramaturgo e poeta madrilenho do Século de Ouro. As Rimas, ao lado da "
        "comédia nova, fixam o soneto e o romance castelhanos do seu tempo.",
        wiki="es",
    ),
    Alvo(
        "la_fontaine",
        (),
        "La Fontaine",
        "Jean de La Fontaine",
        "Poeta francês do classicismo. As Fábulas, em versos, reescrevem Esopo e "
        "Fedro e tornaram-se o livro de formação moral e literária da língua francesa.",
        wiki="fr",
        prefixo="Fables de La Fontaine (éd. 1874)/",
    ),
    Alvo(
        "heredia",
        (),
        "José-Maria de Heredia",
        "José-Maria de Heredia",
        "Poeta francês de origem cubana, do Parnaso. Les Trophées é um livro de "
        "sonetos sobre a Antiguidade, a Idade Média e o trópico, modelo da escola.",
        wiki="fr",
        prefixo="Les Trophées/",
    ),
    Alvo(
        "lamartine",
        (),
        "Alphonse de Lamartine",
        "Alphonse de Lamartine",
        "Poeta francês que abre o romantismo com as Méditations poétiques. O verso "
        "elegíaco do lago e da perda tornou-se o tom da geração de 1820.",
        wiki="fr",
        prefixo="Méditations poétiques/",
        qid="Q188697",
    ),
    Alvo(
        "jose_marti",
        ("Versos sencillos",),
        "José Martí",
        "José Martí",
        "Poeta e líder da independência de Cuba. Versos sencillos é o livro breve "
        "da poesia modernista hispânica e da canção popular que saiu desses versos.",
        wiki="es",
    ),
    Alvo(
        "michelangelo",
        (),
        "Michelangelo",
        "Michelangelo Buonarroti",
        "Escultor e poeta florentino do Renascimento. As Rime, muitas dirigidas a "
        "Vittoria Colonna, são a lírica íntima do artista da Capela Sistina.",
        wiki="it",
        prefixo="Rime (Michelangelo)/",
        qid="Q5592",
    ),
    Alvo(
        "foscolo",
        (),
        "Ugo Foscolo",
        "Ugo Foscolo",
        "Poeta italiano entre o neoclassicismo e o romantismo. Os sonetos e Dei "
        "sepolcri ligam a pátria, o exílio e o culto dos mortos.",
        wiki="it",
        prefixo="Sonetti (Foscolo)/",
    ),
    Alvo(
        "villon",
        (),
        "François Villon",
        "François Villon",
        "Poeta parisiense do fim da Idade Média. O Testament e a balada dos "
        "enforcados são a voz da rua, da morte e do arrependimento em francês.",
        wiki="fr",
        prefixo="Œuvres complètes de François Villon/",
    ),
    Alvo(
        "verdaguer",
        (),
        "Jacint Verdaguer",
        "Jacint Verdaguer",
        "Poeta catalão da Renaixença e padre. L'Atlàntida é a epopeia do renascimento "
        "da língua. Aqui entra a abertura, não o poema inteiro.",
        wiki="ca",
        prefixo="L'Atlàntida/",
    ),
    Alvo(
        "eminescu",
        ("Mihai Eminescu",),
        "Mihai Eminescu",
        "Mihai Eminescu",
        "Poeta romeno do romantismo tardio, figura nacional da língua. Luceafărul "
        "e a lírica de amor e de noite organizam o cânone poético da Romênia.",
        wiki="ro",
    ),
    Alvo(
        "nerval",
        (),
        "Gérard de Nerval",
        "Gérard de Nerval",
        "Poeta francês do romantismo visionário. Les Chimères, sonetos fechados e "
        "herméticos, antecipam o simbolismo e a poesia moderna.",
        wiki="fr",
        prefixo="Les Chimères/",
    ),
    Alvo(
        "carducci",
        (),
        "Giosuè Carducci",
        "Giosuè Carducci",
        "Poeta italiano do fim do século XIX, prêmio Nobel. As Rime nuove recuperam "
        "o verso clássico e a história italiana contra o romantismo sentimental.",
        wiki="it",
        prefixo="Rime nuove/",
    ),
    Alvo(
        "pascoli",
        (),
        "Giovanni Pascoli",
        "Giovanni Pascoli",
        "Poeta italiano do crepuscularismo nascente. Myricae é o livro dos ninhos, "
        "da infância e do verso curto que mudou a dicção italiana depois de Carducci.",
        wiki="it",
        prefixo="Myricae/",
    ),
    Alvo(
        "cavalcanti",
        (),
        "Guido Cavalcanti",
        "Guido Cavalcanti",
        "Poeta florentino do dolce stil novo, amigo de Dante. As rime de amor e a "
        "canção da alma ferida são o núcleo lírico anterior à Comédia.",
        wiki="it",
        prefixo="Rime (Cavalcanti)/",
    ),
    Alvo(
        "musset",
        (),
        "Alfred de Musset",
        "Alfred de Musset",
        "Poeta francês do romantismo. As Noites e as poesias de amor e de ironia "
        "são a voz juvenil da geração de 1830, ao lado do teatro de Lorenzaccio.",
        wiki="fr",
        prefixo="Poésies (Musset)/",
    ),
    Alvo(
        "valery",
        ("Paul Valéry",),
        "Paul Valéry",
        "Paul Valéry",
        "Poeta francês do simbolismo tardio. Charmes e O cemitério marinho levam o "
        "verso clássico ao limite da inteligência e da forma.",
        wiki="fr",
    ),
    Alvo(
        "espronceda",
        (),
        "José de Espronceda",
        "José de Espronceda",
        "Poeta espanhol do romantismo liberal. El estudiante de Salamanca e as "
        "canções do pirata e do condenado são o verso rebelde do século XIX castelhano.",
        wiki="es",
        prefixo="El estudiante de Salamanca/",
    ),
)
