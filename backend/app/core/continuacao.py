"""A continuação do feed, como no X: depois do inédito, o feed nunca acaba.

Quando a pessoa lê tudo o que a rede tem de inédito para ela no "Para você"
(e, no Seguindo, tudo de quem segue e depois o "Para você"), o feed continua
com uma mistura de duas fontes:

- **consagrados** que a sessão ainda não viu, primeiro os que batem com as
  preferências da pessoa (`prioridade`: a forma do poema entre as formas
  marcadas, as escolas do poeta entre as escolas marcadas), depois os mais
  recentes. Não repetem: a fila anda por posição (`Estado.ultimo_consagrado`)
  e pula o que a sessão já recebeu no trecho inédito;
- **os mais curtidos** da comunidade, que podem repetir o que a pessoa já viu:
  a lista roda em volta (`Estado.curtidos` conta quantos já saíram).

Intercalados: a cada `PASSO` itens, um é dos mais curtidos. Quando uma fonte
acaba, a outra ocupa a vez dela; só para quando as duas estão vazias (banco
sem poema nenhum).

Python puro e sem estado entre requests: o `Estado` viaja no cursor. Com m
consagrados carregados e k pedidos, `proximos` é O(m log m) pela ordenação da
fila mais O(k) para montar a página.
"""

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, NamedTuple

# A cada PASSO itens da continuação, um é dos mais curtidos (3 consagrados : 1 curtido).
PASSO = 4

Fonte = Literal["consagrado", "curtido"]
# A posição de um consagrado na fila: (prioridade, data, id), maior primeiro.
PosicaoNaFila = tuple[int, datetime, int]


class Consagrado(NamedTuple):
    """Um poema de consagrado candidato à continuação."""

    post_id: int
    data: datetime
    prioridade: int

    @property
    def posicao(self) -> PosicaoNaFila:
        return (self.prioridade, self.data, self.post_id)


@dataclass(frozen=True)
class Estado:
    """Onde a continuação parou: quantos itens saíram (marca a vez de cada fonte),
    quantos dos mais curtidos saíram (a volta na lista) e a posição do último
    consagrado entregue (None antes do primeiro)."""

    entregues: int = 0
    curtidos: int = 0
    ultimo_consagrado: PosicaoNaFila | None = None


def prioridade(
    forma: str | None,
    escolas_do_poeta: Collection[str],
    formas_preferidas: Collection[str],
    escolas_preferidas: Collection[str],
) -> int:
    """Quanto o poema bate com as preferências: 1 pela forma, 1 pelas escolas. O(e)."""
    pela_forma = forma is not None and forma in formas_preferidas
    pelas_escolas = any(escola in escolas_preferidas for escola in escolas_do_poeta)
    return int(pela_forma) + int(pelas_escolas)


def proximos(
    consagrados: Sequence[Consagrado],
    curtidos: Sequence[int],
    ja_vistos: Collection[int],
    estado: Estado,
    quantos: int,
) -> tuple[list[tuple[Fonte, int]], Estado]:
    """Os próximos `quantos` poemas da continuação, como (fonte, post_id), e o
    estado para a página seguinte. Devolve menos só quando as duas fontes estão
    vazias.

    `curtidos` vem na ordem (o mais curtido primeiro); `ja_vistos` são os poemas
    que a sessão já recebeu, que ficam fora dos consagrados.
    """
    fila = sorted(
        (
            c
            for c in consagrados
            if c.post_id not in ja_vistos
            and (estado.ultimo_consagrado is None or c.posicao < estado.ultimo_consagrado)
        ),
        key=lambda c: c.posicao,
        reverse=True,
    )
    saida: list[tuple[Fonte, int]] = []
    entregues, voltas, ultimo = estado.entregues, estado.curtidos, estado.ultimo_consagrado
    restantes = iter(fila)
    proximo_consagrado = next(restantes, None)
    while len(saida) < quantos:
        vez_do_curtido = entregues % PASSO == PASSO - 1
        if curtidos and (vez_do_curtido or proximo_consagrado is None):
            saida.append(("curtido", curtidos[voltas % len(curtidos)]))
            voltas += 1
        elif proximo_consagrado is not None:
            saida.append(("consagrado", proximo_consagrado.post_id))
            ultimo = proximo_consagrado.posicao
            proximo_consagrado = next(restantes, None)
        else:
            break
        entregues += 1
    return saida, Estado(entregues, voltas, ultimo)
