"""Bloco inglês: uma edição completa por poeta no en.wikisource.

Epopeias (Faerie Queene, Don Juan, Hiawatha) ficam na abertura.
"""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo("shakespeare", (), wiki="en", prefixo="Shakespeare's Sonnets (1883)/"),
    Alvo("keats", (), wiki="en", prefixo="Keats; poems published in 1820/"),
    Alvo("blake", (), wiki="en", prefixo="Songs of Innocence and of Experience (1826)/"),
    Alvo("walt_whitman", (), wiki="en", prefixo="Leaves of Grass (1882)/"),
    Alvo("wordsworth", (), wiki="en", prefixo="Lyrical Ballads (1800)/"),
    Alvo("yeats", (), wiki="en", prefixo="Responsibilities/"),
    Alvo("john_donne", (), wiki="en", prefixo="Poems of John Donne/"),
    Alvo("edgar_allan_poe", (), wiki="en", prefixo="The Raven and Other Poems/"),
    Alvo(
        "milton",
        (),
        wiki="en",
        prefixo="Poems of Mr. John Milton, Both English and Latin, Compos'd at several times/",
    ),
    Alvo("tennyson", (), wiki="en", prefixo="Poems, Chiefly Lyrical/"),
    Alvo("chaucer", (), wiki="en", prefixo="The Canterbury Tales/"),
    Alvo("spenser", (), wiki="en", prefixo="The Faerie Queene/"),
    Alvo("byron", (), wiki="en", prefixo="Don Juan (Byron)/"),
    Alvo("shelley", ("Percy Bysshe Shelley",), wiki="en"),
    Alvo("emily_dickinson", ("Emily Dickinson",), wiki="en"),
)

NOVOS: tuple[Alvo, ...] = (
    Alvo(
        "housman",
        (),
        "A. E. Housman",
        "A. E. Housman",
        "Poeta inglês. A Shropshire Lad é o livro de poemas curtos sobre a "
        "juventude, o condado e a morte que entrou no cânone escolar inglês.",
        wiki="en",
        prefixo="A Shropshire Lad/",
    ),
    Alvo(
        "thomas_hardy",
        (),
        "Thomas Hardy",
        "Thomas Hardy",
        "Romancista e poeta inglês. Wessex Poems and Other Verses é o primeiro "
        "livro de poemas, sobre o campo, o tempo e a ironia do destino.",
        wiki="en",
        prefixo="Wessex Poems and Other Verses/",
        qid="Q132805",
    ),
    Alvo(
        "robert_browning",
        (),
        "Robert Browning",
        "Robert Browning",
        "Poeta inglês da era vitoriana. Men and Women é o livro dos monólogos "
        "dramáticos, entre eles Fra Lippo Lippi e Andrea del Sarto.",
        wiki="en",
        prefixo="Men and Women (Browning)/",
        qid="Q233265",
    ),
    Alvo(
        "paul_dunbar",
        (),
        "Paul Laurence Dunbar",
        "Paul Laurence Dunbar",
        "Poeta norte-americano. Lyrics of Lowly Life reúne a lírica em inglês "
        "literário e os poemas em dialeto que o tornaram a voz negra do seu tempo.",
        wiki="en",
        prefixo="Lyrics of Lowly Life/",
        qid="Q974678",
    ),
    Alvo(
        "amy_lowell",
        (),
        "Amy Lowell",
        "Amy Lowell",
        "Poeta norte-americana do imagismo. Sword Blades and Poppy Seed é o "
        "livro em que o verso livre e o poema em prosa entram na sua obra.",
        wiki="en",
        prefixo="Sword Blades and Poppy Seed/",
        qid="Q265841",
    ),
    Alvo(
        "millay",
        (),
        "Edna St. Vincent Millay",
        "Edna St. Vincent Millay",
        "Poeta norte-americana. Renascence and Other Poems abre com o poema "
        "longo da juventude e inclui os sonetos que a fixaram no cânone.",
        wiki="en",
        prefixo="Renascence and Other Poems/",
    ),
    Alvo(
        "claude_mckay",
        (),
        "Claude McKay",
        "Claude McKay",
        "Poeta jamaicano do Harlem Renaissance. Harlem Shadows é o livro dos "
        "sonetos da cidade, da diáspora e da raiva contida na forma clássica.",
        wiki="en",
        prefixo="Harlem Shadows/",
    ),
    Alvo(
        "thomas_moore",
        (),
        "Thomas Moore",
        "Thomas Moore",
        "Poeta irlandês. Irish Melodies pôs a canção nacional em inglês, "
        "entre elas The Last Rose of Summer e The Minstrel Boy.",
        wiki="en",
        prefixo="Irish Melodies/",
        qid="Q315346",
    ),
    Alvo(
        "alexander_pope",
        (),
        "Alexander Pope",
        "Alexander Pope",
        "Poeta inglês do neoclassicismo. An Essay on Man é o poema filosófico "
        "em dísticos heroicos sobre a ordem do universo e o lugar humano.",
        wiki="en",
        prefixo="An Essay on Man/",
        qid="Q164047",
    ),
    Alvo(
        "dryden",
        (),
        "John Dryden",
        "John Dryden",
        "Poeta inglês da Restauração. Absalom and Achitophel é a sátira "
        "política em dísticos que define o verso público do seu tempo.",
        wiki="en",
        prefixo="Absalom and Achitophel/",
        qid="Q213355",
    ),
    Alvo(
        "marlowe",
        (),
        "Christopher Marlowe",
        "Christopher Marlowe",
        "Dramaturgo e poeta elisabetano. Hero and Leander é o poema erótico "
        "inacabado que ficou ao lado dos sonetos de Shakespeare.",
        wiki="en",
        prefixo="Hero and Leander (Marlowe)/",
        qid="Q28975",
    ),
    Alvo(
        "longfellow",
        (),
        "Henry Wadsworth Longfellow",
        "Henry Wadsworth Longfellow",
        "Poeta norte-americano. The Song of Hiawatha é o poema narrativo "
        "indígena em tetrâmetros. Aqui entra a abertura, não o poema inteiro.",
        wiki="en",
        prefixo="The Song of Hiawatha/",
        qid="Q152513",
    ),
    Alvo(
        "banjo_paterson",
        (),
        "Banjo Paterson",
        "Andrew Barton Paterson",
        "Poeta australiano. The Man from Snowy River and Other Verses é o "
        "livro do bush, com a balada do cavaleiro e Waltzing Matilda no horizonte.",
        wiki="en",
        prefixo="The Man from Snowy River and Other Verses/",
    ),
    Alvo(
        "countee_cullen",
        (),
        "Countee Cullen",
        "Countee Cullen",
        "Poeta norte-americano do Harlem Renaissance. Color é o primeiro livro, "
        "de sonetos sobre a raça, a herança e a forma tradicional.",
        wiki="en",
        prefixo="Color (Cullen)/",
        qid="Q1137066",
    ),
)
