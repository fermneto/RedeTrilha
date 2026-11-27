"""Escolas e períodos da poesia: vocabulário fixo das preferências e dos consagrados.

O código vai no banco e na API; o rótulo é o que a tela mostra. Espelhado em
`frontend/lib/api.ts` pelo `GET /preferencias/opcoes`.
"""

ESCOLAS: dict[str, str] = {
    "antiguidade_classica": "antiguidade clássica",
    "medieval_trovadorismo": "medieval e trovadorismo",
    "renascimento_classicismo": "renascimento e classicismo",
    "barroco": "barroco",
    "arcadismo_neoclassicismo": "arcadismo e neoclassicismo",
    "romantismo": "romantismo",
    "vitorianos_prerrafaelitas": "vitorianos e pré-rafaelitas",
    "realismo": "realismo",
    "parnasianismo": "parnasianismo",
    "simbolismo": "simbolismo",
    "decadentismo_esteticismo": "decadentismo e esteticismo",
    "modernismo_hispanico": "modernismo hispânico",
    "pre_modernismo": "pré-modernismo",
    "guerra_georgiana": "poesia de guerra e georgiana",
    "modernismo_vanguardas": "modernismo e vanguardas",
    "popular_cordel": "poesia popular e cordel",
    "classica_oriental": "clássica oriental",
    "classica_arabe_persa": "clássica árabe e persa",
}


def validar_escolas(escolas: list[str]) -> list[str]:
    """Só códigos de ESCOLAS, sem repetir, na ordem em que vieram."""
    for escola in escolas:
        if escola not in ESCOLAS:
            raise ValueError(f"escola inválida {escola!r}: use uma de {', '.join(ESCOLAS)}")
    return list(dict.fromkeys(escolas))
