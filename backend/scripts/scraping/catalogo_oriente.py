"""Árabe, persa e índico: tradução em domínio público ou o inglês do próprio autor.

FitzGerald morreu em 1883. O Gitanjali em inglês é do próprio Tagore.
"""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo(
        "omar_khayyam",
        (),
        wiki="en",
        prefixo="The Rubaiyat of Omar Khayyam (tr. Fitzgerald, 5th edition)",
    ),
    Alvo("tagore", (), wiki="en", prefixo="Gitanjali/"),
    # Sem edição legível isolada: o original está em categorias de centenas de páginas.
    Alvo("hafez", ("Hafez-en",), wiki="en"),
    Alvo("rumi", ("Rumi-en",), wiki="en"),
    Alvo("saadi", ("Saadi-en",), wiki="en"),
    Alvo("ferdowsi", ("Ferdowsi-en",), wiki="en"),
    Alvo("kalidasa", ("Kalidasa",), wiki="en"),
    Alvo("al_mutanabbi", ("Al-Mutanabbi",), wiki="en"),
    Alvo("imru_al_qais", ("Imru al-Qais",), wiki="en"),
)

NOVOS: tuple[Alvo, ...] = ()
