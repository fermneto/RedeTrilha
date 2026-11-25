"""Avisos (decisão 16): quem recebe e o que a linha mostra, em Python puro.

O aviso é gravado pelo service na transação da ação (services/avisos.py); aqui
ficam só as regras, testáveis sem banco:

- `destinatarios`: os pares (pessoa, tipo) de uma ação, cada pessoa uma vez
  (vale o primeiro tipo, o mais específico: quem teve o comentário respondido
  recebe "resposta", não "comentário"), sem quem agiu e sem quem não pode
  receber (sem login, como os consagrados, ou com bloqueio). O(c), c = candidatos.
- `estrofes_tocadas`: as estrofes de uma renga que os versos `inicio..fim`
  cobrem, contando as linhas como os comentários contam (as estrofes em ordem,
  separadas por uma linha em branco, que também conta). O(e + linhas).
- `trecho`: a primeira linha com texto, cortada no limite, para a linha do aviso.
"""

from collections.abc import Iterable
from typing import TypeVar

T = TypeVar("T")

LIMITE_DO_TRECHO = 120


def destinatarios(
    ator_id: int, candidatos: Iterable[tuple[int | None, T]], excluidos: set[int]
) -> list[tuple[int, T]]:
    """Os (pessoa, tipo) na ordem em que vieram, cada pessoa uma vez (com o primeiro
    tipo), sem o ator e sem `excluidos`."""
    vistos: dict[int, T] = {}
    for pessoa, tipo in candidatos:
        if pessoa is not None and pessoa != ator_id and pessoa not in excluidos:
            vistos.setdefault(pessoa, tipo)
    return list(vistos.items())


def estrofes_tocadas(estrofes: list[str], inicio: int, fim: int) -> list[int]:
    """Os índices (base 0) das estrofes com algum verso entre `inicio` e `fim` (base 1).

    A linha em branco entre duas estrofes não é de nenhuma: uma crítica só dela
    não toca estrofe nenhuma.
    """
    tocadas = []
    linha = 1
    for indice, estrofe in enumerate(estrofes):
        primeira = linha
        ultima = linha + len(estrofe.split("\n")) - 1
        if primeira <= fim and inicio <= ultima:
            tocadas.append(indice)
        # A linha em branco que separa da próxima estrofe.
        linha = ultima + 2
    return tocadas


def trecho(texto: str, limite: int = LIMITE_DO_TRECHO) -> str:
    """A primeira linha com texto, sem os espaços das pontas, com "…" se passar do limite."""
    linha = next((l.strip() for l in texto.split("\n") if l.strip()), "")
    if len(linha) <= limite:
        return linha
    return linha[: limite - 1].rstrip() + "…"
