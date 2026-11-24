"""Américas não hispânicas: um livro por poeta."""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = ()

NOVOS: tuple[Alvo, ...] = (
    Alvo(
        "phillis_wheatley",
        (),
        "Phillis Wheatley",
        "Phillis Wheatley",
        "Poeta norte-americana, nascida na África Ocidental e escravizada em Boston. "
        "Poems on Various Subjects, Religious and Moral (1773) é o primeiro livro "
        "de uma autora negra publicado na América inglesa.",
        wiki="en",
        prefixo="Memoir and Poems of Phillis Wheatley/",
    ),
    Alvo(
        "emile_nelligan",
        (),
        "Émile Nelligan",
        "Émile Nelligan",
        "Poeta quebequense do simbolismo. A obra reunida por Louis Dantin, "
        "com o soneto e a música do inverno, funda a poesia moderna do Québec.",
        wiki="fr",
        prefixo="Émile Nelligan et son œuvre/",
    ),
    Alvo(
        "louis_frechette",
        (),
        "Louis Fréchette",
        "Louis-Honoré Fréchette",
        "Poeta quebequense. La Légende d'un peuple é o poema da história "
        "do Canadá francês, em cantos.",
        wiki="fr",
        prefixo="La Légende d’un peuple/",
    ),
)
