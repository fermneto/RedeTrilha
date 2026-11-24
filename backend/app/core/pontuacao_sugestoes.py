"""Ordem das sugestões de quem seguir: uma nota com pesos, em Python puro.

    nota = PESO_SEGUIDORES · log(1 + seguidores)
         + PESO_GOSTO · (escolas em comum + formas em comum)
         + PESO_LINGUA · (a língua dos poemas da conta é a de quem vê)
         + PESO_PAIS · (mesmo país) + PESO_UF · (mesmo país e mesmo estado)

O log dos seguidores faz a fama pesar sem dominar: 1000 seguidores valem só uns
4,5 pontos a mais que 10, e uma escola em comum vale 2. O estado só conta junto
com o país (UF só existe no Brasil), então mesmo estado vale PESO_PAIS + PESO_UF. Empate desempata pelo
poema mais recente e depois pelo id, para a ordem ser estável.

Montada por request (não é singleton), como `arvore_comentarios.py`. Com c
contas candidatas: nota O(e + f) por conta (tamanho das listas de escolas e
formas), ordenar O(c log c). Memória O(c).
"""

import math
from dataclasses import dataclass, field
from datetime import datetime

from app.core.datas import para_utc

# Os pesos de cada parte da nota.
PESO_SEGUIDORES = 1.0
PESO_GOSTO = 2.0
PESO_LINGUA = 1.5
PESO_PAIS = 1.0
PESO_UF = 1.0


@dataclass(frozen=True)
class Perfil:
    """O que entra na nota, de quem vê ou de uma conta candidata."""

    id: int = 0
    seguidores: int = 0
    escolas: frozenset[str] = field(default_factory=frozenset)
    formas: frozenset[str] = field(default_factory=frozenset)
    lingua: str | None = None
    pais: str | None = None
    uf: str | None = None
    ultimo_poema: datetime | None = None


def nota(conta: Perfil, quem_ve: Perfil) -> float:
    gosto = len(conta.escolas & quem_ve.escolas) + len(conta.formas & quem_ve.formas)
    mesma_lingua = conta.lingua is not None and conta.lingua == quem_ve.lingua
    mesmo_pais = conta.pais is not None and conta.pais == quem_ve.pais
    mesmo_estado = mesmo_pais and conta.uf is not None and conta.uf == quem_ve.uf
    return (
        PESO_SEGUIDORES * math.log1p(conta.seguidores)
        + PESO_GOSTO * gosto
        + PESO_LINGUA * mesma_lingua
        + PESO_PAIS * mesmo_pais
        + PESO_UF * mesmo_estado
    )


def ordenar(contas: list[Perfil], quem_ve: Perfil) -> list[Perfil]:
    """Maior nota primeiro; empate: poema mais recente, depois o maior id."""

    def chave(conta: Perfil) -> tuple:
        recente = para_utc(conta.ultimo_poema).timestamp() if conta.ultimo_poema else float("-inf")
        return (nota(conta, quem_ve), recente, conta.id)

    return sorted(contas, key=chave, reverse=True)
