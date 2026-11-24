"""Ásia oriental.

As categorias de autor no Wikisource chinês e japonês passam de 400 páginas
e não apareceu uma edição legível isolada em domínio público. O bloco registra
a busca; os poemas já importados no original ficam.
"""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo("li_bai", ("Li Bai English",), wiki="en"),
    Alvo("du_fu", ("Du Fu English",), wiki="en"),
    Alvo("wang_wei", ("Wang Wei English",), wiki="en"),
    Alvo("qu_yuan", ("Qu Yuan English",), wiki="en"),
    Alvo("basho", ("Basho English",), wiki="en"),
    Alvo("buson", ("Buson English",), wiki="en"),
    Alvo("issa", ("Issa English",), wiki="en"),
)

NOVOS: tuple[Alvo, ...] = ()
