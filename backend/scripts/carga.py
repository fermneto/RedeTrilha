"""Teste de carga: N usuários logados navegando ao mesmo tempo num mix de 14 rotas de leitura.

Cada usuário virtual entra com uma conta do seed (senha verso123) e repete: escolhe
uma rota ao acaso, faz a requisição e pausa um tempo sorteado entre 0 e 2 x --pausa
segundos (média --pausa); a primeira pausa espalha as chegadas. Com --pausa 0, há sempre N requisições em voo. No fim,
mostra req/s, erros e os percentis do tempo de resposta.

Mensagens diretas (opcional): com --streams S, os S primeiros usuários mantêm o
stream das mensagens (SSE) aberto o tempo todo, como uma aba aberta; com
--mensageiros F, a fração F dos usuários, em vez de navegar, manda mensagens a
outra conta do seed (pausa média de pelo menos 3 s, abaixo do limite por minuto).
O resumo separa o tempo das rotas de leitura do envio das mensagens e conta os
eventos que chegaram pelos streams e os streams que caíram. Com --reconectar, o
stream que cai abre de novo como o front (lib/api.ts: 1 s, 2 s, 4 s...), e o
resumo mostra quantas vezes ele voltou e quanto tempo ficou fora (da queda ao
`pronto` do stream novo): é o teste de derrubar uma réplica da API no meio.

Sem as mensagens, só lê: não publica, não curte, não traduz (não gasta a chave da
Anthropic).

    cd backend
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 3
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 0
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 3 \
        --streams 100 --mensageiros 0.1
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 3 \
        --duracao 90 --streams 100 --reconectar   # e, no meio: docker compose stop api_1

Contra o compose local (deploy/oracle/compose.local.yaml), o Caddy usa um
certificado interno: o script não confere o certificado.
"""

import argparse
import asyncio
import random
import statistics
import time
from collections import Counter

import httpx

SENHA_SEED = "verso123"
# Quem manda mensagem pausa em média pelo menos isto (o limite é 30 por minuto).
PAUSA_MINIMA_DE_QUEM_MANDA = 3.0


def rotas(usernames: list[str], post_ids: list[int], tags: list[str]) -> list:
    """O mix de 14 rotas: o que uma pessoa abre navegando (feed, perfil, poema...)."""
    return [
        lambda: "/feed",
        lambda: "/feed/para-voce",
        lambda: "/poemas/do-dia",
        lambda: "/tags/trending",
        lambda: f"/tags/busca?q={random.choice(tags)[:2]}",
        lambda: f"/tags/{random.choice(tags)}/posts",
        lambda: "/explorar",
        lambda: "/acervo",
        lambda: "/sugestoes",
        lambda: f"/usuarios/{random.choice(usernames)}",
        lambda: f"/usuarios/{random.choice(usernames)}/posts",
        lambda: f"/posts/{random.choice(post_ids)}",
        lambda: f"/posts/{random.choice(post_ids)}/comentarios",
        lambda: "/auth/eu",
    ]


async def entrar(cliente: httpx.AsyncClient, username: str) -> str:
    r = await cliente.post("/auth/login", json={"username": username, "password": SENHA_SEED})
    r.raise_for_status()
    return r.json()["token"]


async def preparar(cliente: httpx.AsyncClient, n: int) -> tuple[list[str], list, list[str]]:
    """Os tokens de n contas do seed, as amostras (usernames, poemas, tags) para as rotas e
    as contas, na ordem dos tokens."""
    r = await cliente.get("/usuarios", params={"limit": 100})
    r.raise_for_status()
    contas = [u["username"] for u in r.json()["items"] if not u.get("consagrado")]
    tokens = [await entrar(cliente, contas[i % len(contas)]) for i in range(n)]
    cab = {"Authorization": f"Bearer {tokens[0]}"}
    feed = (await cliente.get("/feed", headers=cab)).json()["items"]
    post_ids = [p["id"] for p in feed if "id" in p] or [1]
    em_alta = (await cliente.get("/tags/trending", headers=cab)).json()
    tags = [t["tag"] for t in em_alta["items"]] or ["soneto"]
    return tokens, rotas(contas, post_ids, tags), [contas[i % len(contas)] for i in range(n)]


async def usuario(cliente, token, mix, pausa, fim, tempos, status):
    cab = {"Authorization": f"Bearer {token}"}
    # Cada um chega num momento diferente, como gente de verdade (sem pausa: todos juntos).
    await asyncio.sleep(random.uniform(0, 2 * pausa))
    while time.monotonic() < fim:
        caminho = random.choice(mix)()
        inicio = time.monotonic()
        try:
            r = await cliente.get(caminho, headers=cab)
            status[r.status_code] += 1
        except httpx.HTTPError as erro:
            status[type(erro).__name__] += 1
        tempos.append(time.monotonic() - inicio)
        if pausa:
            await asyncio.sleep(random.uniform(0, 2 * pausa))


async def mensageiro(cliente, token, para, pausa, fim, tempos, status):
    """Manda mensagens a `para`, uma conversa só, até o fim."""
    cab = {"Authorization": f"Bearer {token}"}
    pausa = max(pausa, PAUSA_MINIMA_DE_QUEM_MANDA)
    r = await cliente.post("/mensagens/conversas", json={"username": para}, headers=cab)
    r.raise_for_status()
    caminho = f"/mensagens/conversas/{r.json()['id']}/mensagens"
    await asyncio.sleep(random.uniform(0, 2 * pausa))
    n = 0
    while time.monotonic() < fim:
        inicio = time.monotonic()
        try:
            r = await cliente.post(caminho, json={"texto": f"verso {n}\nda carga"}, headers=cab)
            status[r.status_code] += 1
        except httpx.HTTPError as erro:
            status[type(erro).__name__] += 1
        tempos.append(time.monotonic() - inicio)
        n += 1
        await asyncio.sleep(random.uniform(0, 2 * pausa))


async def stream(url, token, fim, eventos, quedas, reconectar=False, fora=None):
    """Mantém o stream das mensagens aberto até o fim, contando eventos e quedas.

    Com `reconectar`, abre de novo depois de cada queda e guarda em `fora` os
    segundos entre a queda e o `pronto` do stream seguinte.
    """
    cab = {"Authorization": f"Bearer {token}"}
    espera = 1.0
    caiu_em = None
    async with httpx.AsyncClient(base_url=url, verify=False, timeout=None) as cliente:
        while time.monotonic() < fim:
            try:
                async with cliente.stream("GET", "/mensagens/stream", headers=cab) as r:
                    r.raise_for_status()

                    async def ler():
                        nonlocal caiu_em, espera
                        async for linha in r.aiter_lines():
                            if linha.startswith("event: "):
                                tipo = linha.removeprefix("event: ")
                                eventos[tipo] += 1
                                if tipo == "pronto" and caiu_em is not None:
                                    fora.append(time.monotonic() - caiu_em)
                                    caiu_em, espera = None, 1.0

                    await asyncio.wait_for(ler(), max(0.0, fim - time.monotonic()))
                quedas["terminou antes"] += 1
            except TimeoutError:
                return
            except httpx.HTTPError as erro:
                quedas[type(erro).__name__] += 1
            if not reconectar:
                return
            if caiu_em is None:
                caiu_em = time.monotonic()
            await asyncio.sleep(min(espera, max(0.0, fim - time.monotonic())))
            espera = min(espera * 2, 30.0)


def resumir(nome: str, tempos: list[float], status: Counter, decorrido: float) -> None:
    erros = sum(n for codigo, n in status.items() if codigo not in (200, 201))
    ms = [t * 1000 for t in tempos]
    if len(ms) < 2:
        print(f"{nome}: {len(ms)} req")
        return
    print(
        f"{nome}: {len(ms)} req, {len(ms) / decorrido:.0f} req/s, {erros} erros, "
        f"p50 {percentil(ms, 50):.0f} ms, p95 {percentil(ms, 95):.0f} ms, p99 {percentil(ms, 99):.0f} ms"
    )
    if erros:
        print("  status:", dict(status))


def percentil(valores: list[float], p: float) -> float:
    return statistics.quantiles(valores, n=100, method="inclusive")[int(p) - 1]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--usuarios", type=int, default=100)
    parser.add_argument("--pausa", type=float, default=3.0, help="pausa média entre cliques (s)")
    parser.add_argument("--duracao", type=float, default=30.0, help="segundos de carga")
    parser.add_argument("--streams", type=int, default=0, help="usuários com o stream das mensagens aberto")
    parser.add_argument("--mensageiros", type=float, default=0.0, help="fração dos usuários que manda mensagens")
    parser.add_argument("--reconectar", action="store_true", help="o stream que cai abre de novo, como o front")
    args = parser.parse_args()

    limites = httpx.Limits(max_connections=args.usuarios, max_keepalive_connections=args.usuarios)
    async with httpx.AsyncClient(
        base_url=args.url, verify=False, timeout=60, limits=limites
    ) as cliente:
        tokens, mix, contas = await preparar(cliente, args.usuarios)
        n_mensageiros = round(args.usuarios * args.mensageiros)
        tempos: list[float] = []
        status: Counter = Counter()
        tempos_msg: list[float] = []
        status_msg: Counter = Counter()
        eventos: Counter = Counter()
        quedas: Counter = Counter()
        fora: list[float] = []
        inicio = time.monotonic()
        fim = inicio + args.duracao
        tarefas = [stream(args.url, t, fim, eventos, quedas, args.reconectar, fora) for t in tokens[: args.streams]]
        for i, token in enumerate(tokens):
            if i < n_mensageiros:
                # Cada um escreve para a conta seguinte do seed (outra pessoa).
                para = next(c for c in contas[i + 1 :] + contas if c != contas[i])
                tarefas.append(mensageiro(cliente, token, para, args.pausa, fim, tempos_msg, status_msg))
            else:
                tarefas.append(usuario(cliente, token, mix, args.pausa, fim, tempos, status))
        await asyncio.gather(*tarefas)
        decorrido = time.monotonic() - inicio

    print(
        f"{args.usuarios} usuários, pausa média {args.pausa:g} s, {args.duracao:g} s, "
        f"{args.streams} streams abertos, {n_mensageiros} mandando mensagens"
    )
    resumir("rotas de leitura", tempos, status, decorrido)
    if n_mensageiros:
        resumir("envio de mensagens", tempos_msg, status_msg, decorrido)
    if args.streams:
        print(f"streams: eventos recebidos {dict(eventos)}, quedas {sum(quedas.values())} {dict(quedas)}")
    if args.reconectar and fora:
        print(
            f"reconexões: {len(fora)}, tempo fora: mediana {statistics.median(fora):.1f} s, "
            f"máximo {max(fora):.1f} s"
        )


if __name__ == "__main__":
    asyncio.run(main())
