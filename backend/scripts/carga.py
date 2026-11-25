"""Teste de carga: N usuários logados navegando ao mesmo tempo num mix de 14 rotas de leitura.

Cada usuário virtual entra com uma conta do seed (senha verso123) e repete: escolhe
uma rota ao acaso, faz a requisição e pausa um tempo sorteado entre 0 e 2 x --pausa
segundos (média --pausa); a primeira pausa espalha as chegadas. Com --pausa 0, há sempre N requisições em voo. No fim,
mostra req/s, erros e os percentis do tempo de resposta.

Só lê: não publica, não curte, não traduz (não gasta a chave da Anthropic).

    cd backend
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 3
    uv run python scripts/carga.py --url https://localhost:8443 --usuarios 100 --pausa 0

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
    """Os tokens de n contas do seed e as amostras (usernames, poemas, tags) para as rotas."""
    r = await cliente.get("/usuarios", params={"limit": 100})
    r.raise_for_status()
    contas = [u["username"] for u in r.json()["items"] if not u.get("consagrado")]
    tokens = [await entrar(cliente, contas[i % len(contas)]) for i in range(n)]
    cab = {"Authorization": f"Bearer {tokens[0]}"}
    feed = (await cliente.get("/feed", headers=cab)).json()["items"]
    post_ids = [p["id"] for p in feed if "id" in p] or [1]
    em_alta = (await cliente.get("/tags/trending", headers=cab)).json()
    tags = [t["tag"] for t in em_alta["items"]] or ["soneto"]
    return tokens, rotas(contas, post_ids, tags), tags


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


def percentil(valores: list[float], p: float) -> float:
    return statistics.quantiles(valores, n=100, method="inclusive")[int(p) - 1]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--usuarios", type=int, default=100)
    parser.add_argument("--pausa", type=float, default=3.0, help="pausa média entre cliques (s)")
    parser.add_argument("--duracao", type=float, default=30.0, help="segundos de carga")
    args = parser.parse_args()

    limites = httpx.Limits(max_connections=args.usuarios, max_keepalive_connections=args.usuarios)
    async with httpx.AsyncClient(
        base_url=args.url, verify=False, timeout=60, limits=limites
    ) as cliente:
        tokens, mix, _ = await preparar(cliente, args.usuarios)
        tempos: list[float] = []
        status: Counter = Counter()
        inicio = time.monotonic()
        fim = inicio + args.duracao
        await asyncio.gather(
            *(usuario(cliente, t, mix, args.pausa, fim, tempos, status) for t in tokens)
        )
        decorrido = time.monotonic() - inicio

    erros = sum(n for codigo, n in status.items() if codigo != 200)
    ms = [t * 1000 for t in tempos]
    print(
        f"{args.usuarios} usuários, pausa média {args.pausa:g} s, {args.duracao:g} s: "
        f"{len(ms)} req, {len(ms) / decorrido:.0f} req/s, {erros} erros, "
        f"p50 {percentil(ms, 50):.0f} ms, p95 {percentil(ms, 95):.0f} ms, "
        f"p99 {percentil(ms, 99):.0f} ms"
    )
    if erros:
        print("status:", dict(status))


if __name__ == "__main__":
    asyncio.run(main())
