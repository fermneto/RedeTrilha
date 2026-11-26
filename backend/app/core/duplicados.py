"""Poemas repetidos no acervo de um consagrado, em Python puro.

Os JSONs dos consagrados (o scraper do Wikisource) trazem o mesmo poema mais de
uma vez: o inteiro e um trecho dele ("estrofes iniciais", uma estrofe solta), a
mesma obra em duas edições ou na grafia antiga e na nova ("Allucinação" e
"Alucinação"). No feed, o leitor via o mesmo poema duas vezes.

Dois poemas do mesmo autor são o mesmo quando, no texto normalizado (sem as
marcas de formatação, sem acento, em minúsculas, só as palavras), o menor está
dentro do maior, ou quase: pelo menos `COBERTURA_MINIMA` do menor cai em trechos
de `BLOCO_MINIMO` caracteres seguidos que também estão no maior (a diferença de
grafia quebra o trecho, mas sobra muito; as variantes de Pessoa, poemas
reescritos, ficam bem abaixo). Fica a versão mais completa: o texto
normalizado mais longo; no empate, o texto mais longo; depois, o que veio
primeiro (no JSON ou, no banco, o de menor id, que é a mesma ordem).

Cada poema que tem uma versão mais completa aponta para a melhor delas, e o
grupo é a raiz dessas setas. Assim, um trecho que cabe em dois poemas
diferentes vai para um só, e os dois poemas não viram um grupo.

Custo, com n poemas do autor e p palavras no total: os candidatos saem de um
índice invertido de trigramas de palavras, O(p); só os pares que dividem pelo
menos `TRIGRAMAS_EM_COMUM` dos trigramas do menor passam pela comparação de
texto, linear nos dois textos. Os 11 mil poemas dos JSONs levam uns 2 s.
"""

import re
import unicodedata
from collections import defaultdict
from collections.abc import Hashable, Sequence
from dataclasses import dataclass, field
from typing import Generic, TypeVar

from app.core.marcas import texto_sem_marcas

K = TypeVar("K", bound=Hashable)

COBERTURA_MINIMA = 0.9
BLOCO_MINIMO = 12
# Fração dos trigramas do poema menor que precisa estar no maior para comparar os textos.
TRIGRAMAS_EM_COMUM = 0.3
# Só esses caracteres abrem marca de formatação (core/marcas.py); sem eles, o texto já
# está sem marcas, e o `texto_sem_marcas`, lento em texto longo, fica de fora.
_PODE_TER_MARCA = re.compile(r"[*+~\\]")


def normalizar(texto: str) -> str:
    """Só as palavras, em minúsculas e sem acento: "Allucinação!" → "allucinacao"."""
    if _PODE_TER_MARCA.search(texto):
        texto = texto_sem_marcas(texto)
    texto = unicodedata.normalize("NFKD", texto.lower())
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return " ".join(re.findall(r"\w+", texto))


def _trigramas(normalizado: str) -> set[tuple[str, ...]]:
    palavras = normalizado.split()
    if len(palavras) < 3:
        return {tuple(palavras)} if palavras else set()
    return {tuple(palavras[i : i + 3]) for i in range(len(palavras) - 2)}


def mesmo_poema(menor: str, maior: str) -> bool:
    """`menor` (normalizado) é o `maior`, um trecho dele ou o mesmo em outra grafia.

    Conta os caracteres do menor que caem em algum trecho de `BLOCO_MINIMO`
    caracteres que também está no maior. O(|menor| + |maior|).
    """
    if not menor:
        return False
    if menor in maior or len(menor) < BLOCO_MINIMO:
        return menor in maior
    trechos = {maior[i : i + BLOCO_MINIMO] for i in range(len(maior) - BLOCO_MINIMO + 1)}
    coberto = 0
    ate = 0  # o menor está coberto até aqui (exclusive)
    for i in range(len(menor) - BLOCO_MINIMO + 1):
        if menor[i : i + BLOCO_MINIMO] in trechos:
            fim = i + BLOCO_MINIMO
            coberto += fim - max(i, ate)
            ate = fim
    return coberto >= COBERTURA_MINIMA * len(menor)


@dataclass
class Grupo(Generic[K]):
    """O poema que fica e os que saem, na ordem em que vieram."""

    mantido: K
    removidos: list[K] = field(default_factory=list)


def grupos_de_duplicados(poemas: Sequence[tuple[K, str]]) -> list[Grupo[K]]:
    """Os grupos de poemas repetidos de UM autor, dados (chave, texto) em ordem.

    Só os grupos com repetição, na ordem do poema mantido.
    """
    normalizados = [normalizar(texto) for _, texto in poemas]
    # Maior = mais completo: (tamanho normalizado, tamanho bruto, quem veio antes).
    peso = [(len(n), len(t), -i) for i, (n, (_, t)) in enumerate(zip(normalizados, poemas))]
    trigramas = [_trigramas(n) for n in normalizados]
    indice: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for i, conjunto in enumerate(trigramas):
        for trigrama in conjunto:
            indice[trigrama].append(i)

    pai: dict[int, int] = {}
    for i, conjunto in enumerate(trigramas):
        em_comum: dict[int, int] = defaultdict(int)
        for trigrama in conjunto:
            for j in indice[trigrama]:
                if peso[j] > peso[i]:
                    em_comum[j] += 1
        candidatos = sorted(
            (j for j, n in em_comum.items() if n >= TRIGRAMAS_EM_COMUM * len(conjunto)),
            key=lambda j: peso[j],
            reverse=True,
        )
        for j in candidatos:
            if mesmo_poema(normalizados[i], normalizados[j]):
                pai[i] = j
                break

    def raiz(i: int) -> int:
        while i in pai:
            i = pai[i]
        return i

    grupos: dict[int, list[int]] = defaultdict(list)
    for i in sorted(pai):
        grupos[raiz(i)].append(i)
    return [
        Grupo(poemas[r][0], [poemas[i][0] for i in membros]) for r, membros in sorted(grupos.items())
    ]
