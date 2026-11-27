"""Texto sem acento, em Python puro: a normalização que as buscas e comparações dividem.

Só tira os acentos (decompõe em NFKD e descarta as marcas combinantes): "Solidão"
vira "Solidao". As maiúsculas ficam; cada chamador aplica a sua regra antes ou
depois (`lower` nos duplicados, `casefold` nas tags, no acervo e nos títulos).
"""

import unicodedata


def sem_acento(texto: str) -> str:
    """O texto sem acento: "Allucinação" → "Allucinacao"."""
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c))
