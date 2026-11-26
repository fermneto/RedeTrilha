"""A continuação do feed, como no X: depois do inédito, o feed nunca acaba.

Quando a pessoa lê tudo o que a rede tem de inédito para ela no "Para você"
(e, no Seguindo, tudo de quem segue e depois o "Para você"), o feed continua
com uma mistura de duas fontes:

- **consagrados**, numa fila ordenada pelo service no banco: primeiro os que
  batem com as preferências da pessoa (forma e escolas), depois os da língua de
  quem lê, depois os mais recentes. A fila anda por posição
  (`Estado.ultimo_consagrado`), então não repete. Na primeira rodada, só os que
  a pessoa nunca viu; quando eles acabam, a fila **recicla**: começa outra rodada
  do topo, com todos os consagrados ("releitura", que pode repetir o já visto);
- **os mais curtidos** da comunidade, que podem repetir: a lista roda em volta
  (`Estado.curtidos` conta quantos já saíram).

Intercalados: a cada `PASSO` itens, um é dos mais curtidos. Sem consagrados, os
mais curtidos ocupam todas as vezes; sem mais curtidos, os consagrados. Como a
fila recicla, um poema só se repete em toda folha se o banco tiver um poema só.

Python puro e sem estado entre requests: o `Estado` viaja no cursor. Com k
pedidos, `intercalar` é O(k).
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, NamedTuple

# A cada PASSO itens da continuação, um é dos mais curtidos (3 consagrados : 1 curtido).
PASSO = 4

# "consagrado": inédito para a pessoa; "releitura": de uma rodada reciclada;
# "curtido": um dos mais curtidos da comunidade.
Fonte = Literal["consagrado", "releitura", "curtido"]
# A posição na fila: (prioridade pelas preferências, mesma língua, data, id), maior primeiro.
PosicaoNaFila = tuple[int, int, datetime, int]


class Candidato(NamedTuple):
    """Um poema de consagrado na fila, na ordem em que deve sair."""

    post_id: int
    rodada: int
    posicao: PosicaoNaFila


@dataclass(frozen=True)
class Estado:
    """Onde a continuação parou: quantos itens saíram (marca a vez de cada fonte),
    quantos dos mais curtidos saíram (a volta na lista), a rodada da fila de
    consagrados (0 = só os nunca vistos) e a posição do último entregue nela
    (None no começo da rodada)."""

    entregues: int = 0
    curtidos: int = 0
    rodada: int = 0
    ultimo_consagrado: PosicaoNaFila | None = None


def intercalar(
    estado: Estado,
    quantos: int,
    fila: Sequence[Candidato],
    curtidos: Sequence[int],
) -> tuple[list[tuple[Fonte, int]], Estado]:
    """Os próximos `quantos` poemas, como (fonte, post_id), e o estado seguinte.

    `fila` são os próximos consagrados a partir do estado (o service traz até
    `quantos`, já reciclando); `curtidos`, os mais curtidos, o primeiro na
    frente. Devolve menos só quando as duas fontes estão vazias.
    """
    saida: list[tuple[Fonte, int]] = []
    entregues, voltas = estado.entregues, estado.curtidos
    rodada, ultimo = estado.rodada, estado.ultimo_consagrado
    restantes = iter(fila)
    proximo = next(restantes, None)
    while len(saida) < quantos:
        vez_do_curtido = entregues % PASSO == PASSO - 1
        if curtidos and (vez_do_curtido or proximo is None):
            saida.append(("curtido", curtidos[voltas % len(curtidos)]))
            voltas += 1
        elif proximo is not None:
            saida.append(("consagrado" if proximo.rodada == 0 else "releitura", proximo.post_id))
            rodada, ultimo = proximo.rodada, proximo.posicao
            proximo = next(restantes, None)
        else:
            break
        entregues += 1
    return saida, Estado(entregues, voltas, rodada, ultimo)
