"""A mistura do feed "Para você" e das sugestões de quem seguir, em Python puro.

O "Para você" junta atividades de toda a rede (poemas publicados, estrofes de
rengas abertas, comentários e críticas) numa linha do tempo só, cronológica
pela atividade, sem ranking por engajamento (decisão 3). Três passos:

1. `rarear_consagrados`: os consagrados têm milhares de poemas espalhados pelos
   últimos 30 dias e afogariam os poetas da rede. Dos poemas publicados por
   consagrados, fica só o mais recente de cada janela de tempo (a janela é uma
   constante do service). A janela é fixa no relógio (múltiplos da época), então
   a escolha não depende de qual página se pede: o cursor continua estável.
2. `misturar`: ordena da atividade mais recente para a mais antiga e deixa um
   item por poema ou renga, na atividade mais recente, como um repost no X. O
   item guarda quem fez as atividades do mesmo tipo da que o subiu (quem
   comentou, quem escreveu estrofe), a mais recente primeiro.
3. O service pagina a lista com o cursor (data, chave), como o feed Seguindo.

Desempate: atividades de tabelas diferentes podem ter o mesmo id e a mesma
data; a `chave` (3·id + 2 para poema, 3·id + 1 para estrofe, 3·id para
comentário) é única entre as três e crescente com o id dentro de cada uma.

Montada por request, como `arvore_comentarios.py`: não é singleton. Com n =
atividades carregadas:

- rarear: O(n), um dict janela -> poema mais recente;
- misturar: O(n log n) pela ordenação, mais O(n) para deduplicar;
- intercalar (sugestões): O(a + b).

Memória O(n).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, TypeVar

from app.core.datas import para_utc

TipoDoItem = Literal["poema", "renga"]
# "publicou": o poema em si. "comentou" / "criticou": um comentário (com âncora
# nos versos, é crítica). "abriu" / "escreveu": uma estrofe do criador da renga
# ou de outra pessoa.
Acao = Literal["publicou", "comentou", "criticou", "abriu", "escreveu"]

_DESEMPATE: dict[Acao, int] = {
    "publicou": 2,
    "abriu": 1,
    "escreveu": 1,
    "comentou": 0,
    "criticou": 0,
}

# Ações que juntam várias pessoas no rótulo ("ana e bia comentaram").
_ROTULO_COLETIVO: dict[Acao, tuple[Acao, ...]] = {
    "comentou": ("comentou", "criticou"),
    "criticou": ("comentou", "criticou"),
    "escreveu": ("escreveu",),
}

T = TypeVar("T")


@dataclass(frozen=True)
class Atividade:
    """Algo que aconteceu num poema ou numa renga.

    `origem_id` é o id da linha que gerou a atividade (o poema, a estrofe ou o
    comentário) e `alvo_id` o do item mostrado (o poema ou a renga).
    """

    tipo: TipoDoItem
    acao: Acao
    origem_id: int
    alvo_id: int
    autor_id: int
    data: datetime
    consagrado: bool = False

    @property
    def posicao(self) -> tuple[datetime, int]:
        return (self.data, 3 * self.origem_id + _DESEMPATE[self.acao])


@dataclass
class ItemMisturado:
    """Um item do feed: a atividade que o subiu e quem está no rótulo."""

    atividade: Atividade
    por: list[int] = field(default_factory=list)


def janela_de(data: datetime, segundos: int) -> int:
    """Número da janela de `segundos` (contada da época) em que a data cai; data sem
    fuso conta como UTC, como no resto do core."""
    return int(para_utc(data).timestamp()) // segundos


def rarear_consagrados(atividades: list[Atividade], segundos: int) -> list[Atividade]:
    """Tira os poemas publicados por consagrados, menos o mais recente de cada janela.

    As outras atividades (poemas de quem não é consagrado, estrofes, comentários,
    inclusive comentários em poemas de consagrados) passam todas. O(n).
    """
    escolhidos: dict[int, Atividade] = {}
    for atividade in atividades:
        if atividade.consagrado and atividade.acao == "publicou":
            janela = janela_de(atividade.data, segundos)
            atual = escolhidos.get(janela)
            if atual is None or atividade.posicao > atual.posicao:
                escolhidos[janela] = atividade
    mantidos = {a.posicao for a in escolhidos.values()}
    return [
        a
        for a in atividades
        if not (a.consagrado and a.acao == "publicou") or a.posicao in mantidos
    ]


def misturar(atividades: list[Atividade]) -> list[ItemMisturado]:
    """Um item por poema ou renga, na atividade mais recente, mais novo primeiro.

    `por` é quem fez as atividades do mesmo tipo da que subiu o item, a mais
    recente primeiro e sem repetir: quem comentou ou criticou, quem escreveu
    estrofe. Poema que subiu pela publicação vem com `por` vazio; renga que subiu
    por estrofe do criador ("abriu") traz só o criador.
    """
    ordenadas = sorted(atividades, key=lambda a: a.posicao, reverse=True)
    itens: dict[tuple[TipoDoItem, int], ItemMisturado] = {}
    for atividade in ordenadas:
        chave = (atividade.tipo, atividade.alvo_id)
        item = itens.get(chave)
        if item is None:
            item = itens[chave] = ItemMisturado(atividade)
            if atividade.acao == "abriu":
                item.por.append(atividade.autor_id)
                continue
        coletivas = _ROTULO_COLETIVO.get(item.atividade.acao, ())
        if atividade.acao in coletivas and atividade.autor_id not in item.por:
            item.por.append(atividade.autor_id)
    return list(itens.values())


def intercalar(primeira: list[T], segunda: list[T]) -> list[T]:
    """Um de cada, começando pela primeira; quando uma acaba, segue a outra. O(a + b)."""
    juntas: list[T] = []
    for i in range(max(len(primeira), len(segunda))):
        juntas.extend(lista[i] for lista in (primeira, segunda) if i < len(lista))
    return juntas
