"""Quem está com o stream de mensagens aberto neste processo: dict pessoa → filas.

O `GET /mensagens/stream` (SSE) fica aberto por minutos. Cada stream assina uma
`Fila`; quando chega um evento ("mensagem nova na conversa 7, para a bia e o
caio"), `Assinaturas.publicar` acha as filas dos destinatários no dict e põe o
evento nelas. O stream acorda e escreve o evento na conexão.

**Por que o estado aqui é aceitável** (o `core/README.md` pede o contrário):
o registro só guarda as conexões abertas *deste* processo, e uma conexão SSE só
existe no processo que a atende. Nada aqui precisa sobreviver a um restart (o
cliente reconecta e busca o que perdeu pelas rotas normais, com `?depois=`) nem
valer igual em dois workers: o que passa entre os workers é o evento, pelo
Postgres `LISTEN/NOTIFY` (app/tempo_real.py), e cada worker entrega aos seus.

Custos, com d = streams abertos dos destinatários e S = streams do processo:

- `assinar` / `cancelar`: O(1);
- `publicar`: O(destinatários + d). Uma varredura de todos os streams
  procurando os destinatários custaria O(S) por evento
  (scripts/bench_mensagens.py);
- `publicar_para_todos`: O(S), só quando o LISTEN reconecta (o cliente pode ter
  perdido eventos enquanto ele estava fora).

Cada fila tem limite (`LIMITE_DA_FILA`): um cliente que não lê não faz a memória
crescer. Ao passar do limite, a fila descarta o que guardava e entrega um único
`ressincronizar`, e o cliente busca tudo de novo pelas rotas.

`encerrar_todos` fecha os streams quando o processo vai desligar (O(S)): cada
fila devolve `ENCERRAR`, o stream termina, e o cliente reconecta noutra réplica
em vez de o desligamento esperar o `TIMEOUT_GRACEFUL_SHUTDOWN` (docs/deploy-oracle.md).
"""

import asyncio
from collections import deque
from collections.abc import Iterable

LIMITE_DA_FILA = 100

RESSINCRONIZAR = {"tipo": "ressincronizar"}
# Não vai ao cliente: avisa o stream para terminar (o processo vai desligar).
ENCERRAR = {"tipo": "encerrar"}


class Fila:
    """Os eventos ainda não escritos num stream. Só o event loop do processo mexe nela."""

    def __init__(self, user_id: int, limite: int = LIMITE_DA_FILA) -> None:
        self.user_id = user_id
        self._limite = limite
        self._eventos: deque[dict] = deque()
        self._transbordou = False
        self._encerrada = False
        self._chegou = asyncio.Event()

    def por(self, evento: dict) -> None:
        if len(self._eventos) >= self._limite:
            self._eventos.clear()
            self._transbordou = True
        else:
            self._eventos.append(evento)
        self._chegou.set()

    def encerrar(self) -> None:
        self._encerrada = True
        self._chegou.set()

    async def proximo(self, espera: float) -> dict | None:
        """O próximo evento, ou None se nada chegou em `espera` segundos (hora da batida).

        Fila encerrada: `ENCERRAR`, antes do que ainda estiver guardado (o cliente
        busca o resto pelas rotas ao reconectar).
        """
        if not self._eventos and not self._transbordou and not self._encerrada:
            self._chegou.clear()
            try:
                await asyncio.wait_for(self._chegou.wait(), espera)
            except TimeoutError:
                return None
        if self._encerrada:
            return ENCERRAR
        if self._transbordou:
            self._transbordou = False
            return RESSINCRONIZAR
        return self._eventos.popleft() if self._eventos else None


class Assinaturas:
    def __init__(self) -> None:
        self._por_pessoa: dict[int, set[Fila]] = {}
        self.encerrando = False

    def assinar(self, user_id: int) -> Fila:
        fila = Fila(user_id)
        if self.encerrando:
            # O processo já vai desligar: o stream termina logo e o cliente vai a outro.
            fila.encerrar()
        self._por_pessoa.setdefault(user_id, set()).add(fila)
        return fila

    def cancelar(self, fila: Fila) -> None:
        filas = self._por_pessoa.get(fila.user_id)
        if filas is None:
            return
        filas.discard(fila)
        if not filas:
            del self._por_pessoa[fila.user_id]

    def publicar(self, para: Iterable[int], evento: dict) -> int:
        """Põe o evento nas filas de cada destinatário; devolve quantos streams o recebem."""
        entregues = 0
        for user_id in set(para):
            for fila in self._por_pessoa.get(user_id, ()):
                fila.por(evento)
                entregues += 1
        return entregues

    def publicar_para_todos(self, evento: dict) -> int:
        entregues = 0
        for filas in self._por_pessoa.values():
            for fila in filas:
                fila.por(evento)
                entregues += 1
        return entregues

    def encerrar_todos(self) -> int:
        """Encerra os streams abertos e os que abrirem depois; devolve quantos estavam abertos."""
        self.encerrando = True
        encerrados = 0
        for filas in self._por_pessoa.values():
            for fila in filas:
                fila.encerrar()
                encerrados += 1
        return encerrados

    def __len__(self) -> int:
        return sum(len(filas) for filas in self._por_pessoa.values())
