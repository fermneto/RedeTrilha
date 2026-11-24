"""Árvore de comentários de um poema.

Python puro: a API passa tuplas (id, parent_id, created_at, payload) e recebe
nós aninhados. O `payload` é opaco aqui (o service guarda o model nele).

Diferente de `contadores.py` e `indice_tags.py`, esta estrutura NÃO é um
singleton de módulo reconstruído no startup. A árvore é de um poema só e é
montada a cada `GET /posts/{id}/comentarios` a partir dos comentários daquele
poema. Motivos:

- A leitura sempre devolve a árvore inteira do poema, então o texto e o autor
  de cada comentário vêm do banco de qualquer jeito; guardar a árvore em
  memória não pouparia essa ida ao banco.
- Um singleton com as árvores de todos os poemas custaria O(total de
  comentários da rede) no startup e uma atualização a cada write, só para
  economizar a montagem, que já é linear no tamanho da resposta.
- Montada por request, a árvore não tem estado para dessincronizar do banco
  (restart, `--reload`, vários workers).

O `core/README.md` aceita montar por request desde que o Big O esteja
declarado. Com n = comentários do poema:

- agrupar por pai: O(n), um dict parent_id -> filhos, cada comentário
  visitado uma vez;
- montar recursivamente: O(n), cada nó é criado uma vez;
- ordenar: O(n log n) no pior caso. O service já entrega os comentários em
  ordem (ORDER BY created_at, id) e o Timsort faz isso em O(n) com a entrada
  ordenada. A ordenação fica aqui para a ordem cronológica não depender de
  quem chama.

Memória O(n). A recursão desce tanto quanto a conversa mais longa.
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


def montar(itens: list[Item]) -> list[No]:
    """Raízes (parent_id None) com as respostas aninhadas, tudo em ordem cronológica.

    Empate de horário desempata pelo id (ordem de criação). Um item cujo pai
    não está na lista não aparece: a API só aceita pai do mesmo poema.
    """
    filhos: dict[int | None, list[Item]] = {}
    for item in sorted(itens, key=lambda item: (item[2], item[0])):
        filhos.setdefault(item[1], []).append(item)
    return _montar_filhos(None, filhos)


def _montar_filhos(parent_id: int | None, filhos: dict[int | None, list[Item]]) -> list[No]:
    return [
        No(id_, pai, criado_em, payload, _montar_filhos(id_, filhos))
        for id_, pai, criado_em, payload in filhos.get(parent_id, [])
    ]
