"""Árvore de comentários de um poema.

Python puro: a API passa tuplas (id, parent_id, created_at, payload) e recebe
nós aninhados. O `payload` é opaco aqui (o service guarda o model nele).

A árvore é montada sobre o subconjunto carregado, como no X: uma página de
respostas diretas (ao poema ou a um comentário) e, abaixo de cada uma, a
prévia das primeiras respostas, nível a nível. `montar` não busca nem corta
nada: aninha o que recebeu, a partir de `raiz` (None = respostas ao poema).

Esta estrutura NÃO é um singleton de módulo: nada do core/ guarda estado entre
requests (core/README.md). Ela é montada a cada request a partir do que aquela
página carregou. Motivos:

- A resposta precisa do texto e do autor de cada comentário, que vêm do banco
  de qualquer jeito; uma árvore em memória não pouparia a ida ao banco.
- Um singleton com as árvores de todos os poemas custaria O(total de
  comentários da rede) no startup e uma atualização a cada write, só para
  economizar a montagem, que é linear no tamanho da página.
- Montada por request, a árvore não tem estado para dessincronizar do banco
  (restart, `--reload`, vários workers).

Montar por request é o padrão do `core/README.md`, com o Big O declarado.
Com k = comentários carregados (página + prévias), não n = todos os do poema:

- agrupar por pai: O(k), um dict parent_id -> filhos, cada item visitado uma
  vez;
- montar recursivamente: O(k), cada nó é criado uma vez;
- ordenar: O(k log k) no pior caso. O service entrega cada nível já em ordem
  (ORDER BY created_at, id) e o Timsort aproveita esses trechos ordenados. A
  ordenação fica aqui para a ordem cronológica não depender de quem chama.

Memória O(k). A recursão desce tanto quanto a prévia carregada.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

Item = tuple[int, int | None, datetime, Any]


@dataclass
class No:
    id: int
    parent_id: int | None
    created_at: datetime
    payload: Any
    respostas: list["No"] = field(default_factory=list)


def montar(itens: list[Item], raiz: int | None = None) -> list[No]:
    """Filhos de `raiz` com as respostas aninhadas, tudo em ordem cronológica.

    Empate de horário desempata pelo id (ordem de criação). Um item cujo pai
    não está na lista (nem é a `raiz`) não aparece.
    """
    filhos: dict[int | None, list[Item]] = {}
    for item in sorted(itens, key=lambda item: (item[2], item[0])):
        filhos.setdefault(item[1], []).append(item)
    return _montar_filhos(raiz, filhos)


def _montar_filhos(parent_id: int | None, filhos: dict[int | None, list[Item]]) -> list[No]:
    return [
        No(id_, pai, criado_em, payload, _montar_filhos(id_, filhos))
        for id_, pai, criado_em, payload in filhos.get(parent_id, [])
    ]
