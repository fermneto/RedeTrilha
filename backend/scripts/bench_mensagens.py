"""Bench das mensagens diretas: a caixa pelos ponteiros contra a varredura linear das
mensagens, e o fan-out do stream pelo dict pessoa → filas contra a lista de streams.

Rode com: make bench. Duas medições, com semente fixa:

1. **A caixa e as não lidas** (SQLite local descartável). A massa (pessoas,
   conversas entre pares sorteados e mensagens espalhadas por elas) vai para as
   tabelas de models/conversa.py e models/mensagem.py, com os índices de
   produção. Para a pessoa com mais conversas:
   - ponteiros: `services.mensagens.caixa` (a primeira página, 20 conversas, com
     a última mensagem e as não lidas de cada uma) e `resumo` (o contador da
     navegação), as funções que a API usa. Leem o índice da caixa e só as
     mensagens da página;
   - varredura: lê todas as mensagens (`NOT INDEXED`) e monta em Python o dict
     conversa → (última, não lidas), ordena pela última e conta as não lidas.
   O script confere que os dois dão a mesma caixa e o mesmo contador.
2. **O fan-out de um evento** (core/assinaturas.py, em memória). Com S streams
   abertos num processo, um evento para duas pessoas: `Assinaturas.publicar`
   (dict) contra percorrer a lista de todos os streams procurando os destinatários.

Cada tempo é a mediana de REPETICOES rodadas. O ganho é varredura / estrutura.
"""

import random
import statistics
import sys
import tempfile
import timeit
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.orm import Session

from app.core.assinaturas import Assinaturas
from app.db import Base
from app.models.conversa import Conversa, ParticipanteConversa
from app.models.mensagem import Mensagem
from app.models.post import Post
from app.models.user import User
from app.services import mensagens

SEMENTE = 2026
TAMANHOS = (1_000, 10_000, 100_000, 1_000_000)
PESSOAS = 500
MENSAGENS_POR_CONVERSA = 25
PAGINA = 20
REPETICOES = 7
STREAMS = (100, 1_000, 10_000, 100_000)


# ---------- 1. a caixa ----------


def massa(n: int) -> tuple[list[dict], list[dict], list[dict]]:
    """Conversas entre pares sorteados, n mensagens e os ponteiros de cada lado."""
    rng = random.Random(SEMENTE)
    pares: set[tuple[int, int]] = set()
    while len(pares) < max(1, n // MENSAGENS_POR_CONVERSA):
        a, b = sorted(rng.sample(range(1, PESSOAS + 1), 2))
        pares.add((a, b))
    conversas = [{"id": i, "menor_id": a, "maior_id": b} for i, (a, b) in enumerate(sorted(pares), 1)]
    linhas, ultima, minha_ultima = [], {}, {}
    for mensagem_id in range(1, n + 1):
        conversa = rng.choice(conversas)
        autor = rng.choice((conversa["menor_id"], conversa["maior_id"]))
        linhas.append({"id": mensagem_id, "conversa_id": conversa["id"], "autor_id": autor, "texto": "verso"})
        ultima[conversa["id"]] = minha_ultima[(conversa["id"], autor)] = mensagem_id
    # Como na API: quem manda leu tudo até a própria mensagem.
    participantes = [
        {
            "conversa_id": c["id"],
            "user_id": quem,
            "situacao": "caixa",
            "ultima_mensagem_id": ultima.get(c["id"]),
            "ultima_lida_id": rng.randint(minha_ultima.get((c["id"], quem), 0), ultima.get(c["id"], 0)),
        }
        for c in conversas
        for quem in (c["menor_id"], c["maior_id"])
    ]
    return conversas, linhas, participantes


def banco(pasta: Path, n: int) -> Session:
    engine = create_engine(f"sqlite:///{pasta}/mensagens{n}.db")
    tabelas = [User.__table__, Post.__table__, Conversa.__table__, ParticipanteConversa.__table__, Mensagem.__table__]
    Base.metadata.create_all(engine, tables=tabelas)
    conversas, linhas, participantes = massa(n)
    with engine.begin() as conexao:
        conexao.execute(insert(User), [{"id": i, "username": f"p{i}", "name": f"P{i}"} for i in range(1, PESSOAS + 1)])
        conexao.execute(insert(Conversa), conversas)
        conexao.execute(insert(Mensagem), linhas)
        conexao.execute(insert(ParticipanteConversa), participantes)
        conexao.execute(text("ANALYZE"))
    return Session(engine)


def pelos_ponteiros(db: Session, eu: User):
    pagina = mensagens.caixa(db, eu, "conversas", None, PAGINA)
    caixa = [(c.id, c.ultima_mensagem.id, c.nao_lidas) for c in pagina.items]
    return caixa, mensagens.resumo(db, eu).nao_lidas


def pela_varredura(db: Session, eu: User):
    lidas = dict(
        db.execute(
            select(ParticipanteConversa.conversa_id, ParticipanteConversa.ultima_lida_id).where(
                ParticipanteConversa.user_id == eu.id
            )
        ).all()
    )
    por_conversa: dict[int, list[int]] = {}
    for conversa_id, mensagem_id, autor_id in db.execute(
        text("SELECT conversa_id, id, autor_id FROM mensagens NOT INDEXED")
    ):
        if conversa_id not in lidas:
            continue
        estado = por_conversa.setdefault(conversa_id, [0, 0])
        estado[0] = max(estado[0], mensagem_id)
        if mensagem_id > lidas[conversa_id] and autor_id != eu.id:
            estado[1] += 1
    ordem = sorted(por_conversa.items(), key=lambda item: item[1][0], reverse=True)
    caixa = [(conversa_id, ultima, nao_lidas) for conversa_id, (ultima, nao_lidas) in ordem[:PAGINA]]
    return caixa, sum(1 for _, nao_lidas in por_conversa.values() if nao_lidas)


def quem_mais_conversa(db: Session) -> User:
    contagem: dict[int, int] = {}
    for user_id in db.scalars(select(ParticipanteConversa.user_id)):
        contagem[user_id] = contagem.get(user_id, 0) + 1
    return db.get(User, max(contagem, key=lambda u: (contagem[u], -u)))


# ---------- 2. o fan-out ----------


def fan_out(s: int) -> tuple[float, float]:
    rng = random.Random(SEMENTE)
    pessoas = max(2, s // 2)
    assinaturas = Assinaturas()
    todas = [assinaturas.assinar(rng.randint(1, pessoas)) for _ in range(s)]
    para = [1, 2]
    evento = {"tipo": "mensagem", "conversa_id": 1, "mensagem_id": 1}

    def varrer():
        alvo = set(para)
        for fila in todas:
            if fila.user_id in alvo:
                fila.por(evento)

    return mediana_ms(lambda: assinaturas.publicar(para, evento)), mediana_ms(varrer)


def mediana_ms(funcao) -> float:
    vezes, _ = timeit.Timer(funcao).autorange()
    rodadas = timeit.repeat(funcao, number=vezes, repeat=REPETICOES)
    return statistics.median(rodadas) / vezes * 1000


def main() -> None:
    print("bench_mensagens: a caixa pelos ponteiros x varredura linear das mensagens (SQLite local)")
    print(
        f"massa: {PESSOAS} pessoas, ~{MENSAGENS_POR_CONVERSA} mensagens por conversa, "
        f"página de {PAGINA}, semente {SEMENTE}; mediana de {REPETICOES} rodadas\n"
    )
    cabecalho = (
        f"{'mensagens':>9} | {'conversas da pessoa':>19} | {'ponteiros (ms)':>14} | "
        f"{'varredura (ms)':>14} | {'ganho':>7}"
    )
    print(cabecalho)
    print("-" * len(cabecalho))
    with tempfile.TemporaryDirectory(prefix="bench-mensagens-") as pasta:
        for n in TAMANHOS:
            db = banco(Path(pasta), n)
            eu = quem_mais_conversa(db)
            assert pelos_ponteiros(db, eu) == pela_varredura(db, eu), n
            conversas = db.scalar(
                select(text("count(*)")).select_from(ParticipanteConversa).where(ParticipanteConversa.user_id == eu.id)
            )
            t_ponteiros = mediana_ms(lambda: pelos_ponteiros(db, eu))
            t_varredura = mediana_ms(lambda: pela_varredura(db, eu))
            print(
                f"{n:>9} | {conversas:>19} | {t_ponteiros:>14.3f} | {t_varredura:>14.3f} | "
                f"{t_varredura / t_ponteiros:>6.1f}x"
            )
            db.close()

    print("\nfan-out de um evento para 2 pessoas: dict pessoa → filas x lista de streams\n")
    cabecalho = f"{'streams':>8} | {'dict (ms)':>10} | {'lista (ms)':>10} | {'ganho':>8}"
    print(cabecalho)
    print("-" * len(cabecalho))
    for s in STREAMS:
        t_dict, t_lista = fan_out(s)
        print(f"{s:>8} | {t_dict:>10.4f} | {t_lista:>10.4f} | {t_lista / t_dict:>7.0f}x")


if __name__ == "__main__":
    main()
