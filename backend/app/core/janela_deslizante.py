"""Limite de eventos por chave numa janela deslizante (ex.: 30 traduções por hora).

Python puro, no padrão de core/README.md. A API usa o singleton
`limite_traducoes`: a chave é o id do usuário e cada evento é uma tradução nova
(as que vêm do cache não passam por aqui).

Estrutura: dict chave -> deque com os instantes (segundos desde a época, em
ordem crescente) dos eventos ainda dentro da janela. Ao consultar, os eventos
velhos saem pela esquerda da deque.

- permitido / registrar: O(1) amortizado (cada instante entra e sai uma vez só)
- memória: no máximo `limite` instantes por chave ativa
- reconstruir: O(n log n) com os n eventos da última janela, só no startup
"""

from collections import deque


class JanelaDeslizante:
    def __init__(self, limite: int, janela_segundos: float) -> None:
        self.limite = limite
        self.janela_segundos = janela_segundos
        self._eventos: dict[int, deque[float]] = {}

    def reconstruir(self, eventos: list[tuple[int, float]]) -> None:
        """Chamado no startup com os (chave, instante) gravados no banco."""
        self._eventos = {}
        for chave, instante in sorted(eventos, key=lambda evento: evento[1]):
            self.registrar(chave, instante)

    def permitido(self, chave: int, agora: float) -> bool:
        """Ainda cabe um evento de `chave` na janela que termina em `agora`?"""
        return self._na_janela(chave, agora) < self.limite

    def registrar(self, chave: int, instante: float) -> None:
        self._eventos.setdefault(chave, deque()).append(instante)

    def _na_janela(self, chave: int, agora: float) -> int:
        eventos = self._eventos.get(chave)
        if not eventos:
            return 0
        inicio = agora - self.janela_segundos
        while eventos and eventos[0] <= inicio:
            eventos.popleft()
        if not eventos:
            del self._eventos[chave]
            return 0
        return len(eventos)


# O singleton que a API importa (ver app/services/traducao.py e o lifespan em main.py).
limite_traducoes = JanelaDeslizante(limite=30, janela_segundos=3600)
