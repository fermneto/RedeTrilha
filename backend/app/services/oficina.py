"""Oficina do compositor: sílabas e rimas de um rascunho, sem banco e sem estado.

O algoritmo fica em core/metrica.py; aqui só se monta a resposta da rota.
"""

from app.core.metrica import analisar, aviso_de_forma
from app.schemas.oficina import AnaliseOut, VersoAnalisado


def analisar_rascunho(texto: str, forma: str | None) -> AnaliseOut:
    versos, esquema = analisar(texto)
    return AnaliseOut(
        versos=[VersoAnalisado(silabas=v.silabas, rima=v.rima, tipo_rima=v.tipo_rima) for v in versos],
        esquema=esquema,
        aviso=aviso_de_forma(forma, versos),
    )
