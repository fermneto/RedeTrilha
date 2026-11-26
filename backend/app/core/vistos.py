"""O que uma sessão de leitura do feed já entregou, num texto curto para o cursor.

O feed pagina por posição (data, chave) da atividade mais recente de cada poema
ou renga. A posição sozinha não basta para um item não voltar: se a atividade
que o subiu some entre uma página e a próxima (quem repostou desfaz o repost,
quem comentou apaga o comentário, a renga do "Para você" fecha), ele cai para
uma atividade mais antiga, abaixo do cursor, e sairia de novo. Por isso o
cursor também carrega o conjunto do que já saiu, e o service pula esses itens.

Um item é a chave `(tipo, id)` do poema ou da renga mostrados ("poema", 12).
O texto agrupa os ids por tipo, em ordem e como diferenças entre vizinhos
(ids próximos viram números pequenos), comprime com zlib e passa para base64
de URL: umas 2 a 3 vezes menor que os ids por extenso. Com v itens vistos:

- `codificar`: O(v log v) pela ordenação; texto O(v), mas pequeno (umas 400
  posições de leitura, 20 páginas, cabem em menos de 1 KB);
- `decodificar`: O(v), e o `frozenset` devolvido responde "já vi?" em O(1).

Python puro, sem estado entre requests: o estado viaja no cursor.
"""

import base64
import binascii
import zlib
from collections.abc import Iterable

Chave = tuple[str, int]


class VistosInvalidos(ValueError):
    """O texto não veio de `codificar`."""


def codificar(vistos: Iterable[Chave]) -> str:
    """`{("poema", 3), ("poema", 9), ("renga", 2)}` → texto curto e seguro em URL."""
    por_tipo: dict[str, list[int]] = {}
    for tipo, id_ in vistos:
        por_tipo.setdefault(tipo, []).append(id_)
    grupos = []
    for tipo in sorted(por_tipo):
        ids = sorted(set(por_tipo[tipo]))
        diferencas = [ids[0], *(b - a for a, b in zip(ids, ids[1:]))]
        grupos.append(f"{tipo}:{','.join(map(str, diferencas))}")
    if not grupos:
        return ""
    bruto = zlib.compress(";".join(grupos).encode(), level=9)
    return base64.urlsafe_b64encode(bruto).decode().rstrip("=")


def decodificar(texto: str) -> frozenset[Chave]:
    """O inverso de `codificar`; texto vazio é "nada visto"."""
    if not texto:
        return frozenset()
    try:
        bruto = zlib.decompress(base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4)))
        vistos: set[Chave] = set()
        for grupo in bruto.decode().split(";"):
            tipo, diferencas = grupo.split(":")
            id_ = 0
            for diferenca in diferencas.split(","):
                id_ += int(diferenca)
                vistos.add((tipo, id_))
        return frozenset(vistos)
    except (binascii.Error, zlib.error, UnicodeDecodeError, ValueError) as erro:
        raise VistosInvalidos(texto) from erro
