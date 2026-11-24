"""Antiguidade: originais em latim. O grego de Homero entra na tradução
de Alexander Pope (morto em 1744), porque o alfabeto grego não se lê
no Brasil e o tradutor está em domínio público. Epopeia: só a abertura.
"""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo("horacio", (), wiki="la", prefixo="Carmina (Horatius)/"),
    Alvo("virgilio", (), wiki="la", prefixo="Eclogae vel bucolica/"),
    Alvo("ovidio", (), wiki="la", prefixo="Metamorphoses (Ovidius)/"),
    Alvo("catulo", (), wiki="la", prefixo="Carmina (Catullus)/"),
    Alvo("lucrecio", (), wiki="la", prefixo="De rerum natura (Titus Lucretius Carus)/"),
    Alvo("homero", (), wiki="en", prefixo="The Iliad of Homer (Pope)/"),
    Alvo("hesiodo", ("Hesiod",), wiki="en"),
    Alvo("safo", ("Sappho",), wiki="en"),
    Alvo("pindaro", ("Pindar",), wiki="en"),
)

NOVOS: tuple[Alvo, ...] = ()
