"""Seed fake (N4): a rede da demo, com a cara do nicho."""

import shutil
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import Base, SessionLocal, engine
from app.models.antologia import Antologia
from app.models.comentario import Comentario
from app.models.curtida import Curtida
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User
from app.schemas.post import FORMAS
from app.schemas.user import USERNAMES_RESERVADOS
from scripts import importar_consagrados, seed
from scripts.seed_conteudo import CONTA_DEMO, POEMAS, POETAS


def versos(texto: str) -> list[str]:
    """Linhas do poema que são verso: sem as linhas em branco e sem a estrofe de #tags."""
    return [
        linha for linha in texto.split("\n") if linha.strip() and not linha.startswith("#")
    ]


def contar(db, modelo, *filtros) -> int:
    return db.scalar(select(func.count()).select_from(modelo).where(*filtros)) or 0


@pytest.fixture()
def semeado(client):
    with SessionLocal() as db:
        assert seed.seed_fake(db)
        yield db


def test_seed_roda_duas_vezes_no_mesmo_processo(client):
    with SessionLocal() as db:
        assert seed.seed_fake(db)
        antes = seed.contagens(db)
        assert not seed.seed_fake(db)
        assert seed.contagens(db) == antes

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        assert seed.seed_fake(db)
        assert seed.contagens(db) == antes


def test_main_roda_duas_vezes_sem_duplicar(client):
    seed.main()
    with SessionLocal() as db:
        antes = seed.contagens(db)
    seed.main()
    with SessionLocal() as db:
        assert seed.contagens(db) == antes


def test_senha_verso123_entra(client, semeado):
    for username in (CONTA_DEMO, "thiago_hist", "iago_ifpb"):
        r = client.post("/auth/login", json={"username": username, "password": "verso123"})
        assert r.status_code == 200, username
    r = client.post("/auth/login", json={"username": "marina_letras", "password": "errada123"})
    assert r.status_code == 401


def test_seed_so_tem_poetas_do_nicho(semeado):
    usernames = set(semeado.scalars(select(User.username)))
    assert usernames == {p.username for p in POETAS}
    assert not usernames & {"ada", "linus", "grace"}


def test_conta_de_demonstracao_tem_a_rede_toda(semeado):
    demo = semeado.scalar(select(User).where(User.username == CONTA_DEMO))
    assert contar(semeado, Post, Post.autor_id == demo.id, Post.repost_de_id.is_(None)) >= 3
    assert contar(semeado, Follow, Follow.seguido_id == demo.id) >= 5
    assert contar(semeado, Follow, Follow.seguidor_id == demo.id) >= 5
    assert contar(semeado, Antologia, Antologia.dono_id == demo.id) >= 1


def test_perfis_misturados_com_alguns_universitarios():
    """O público é quem lê e escreve poesia: universitários são parte, não a maioria."""
    universitarios = [p for p in POETAS if any(u in p.bio for u in ("UFPB", "UFPE", "UFCG"))]
    assert 0 < len(universitarios) < len(POETAS) / 2
    assert not any("iniciante" in p.bio.lower() for p in POETAS)


def test_usernames_validos_e_fora_dos_reservados():
    usernames = [p.username for p in POETAS]
    assert len(usernames) == len(set(usernames)) >= 20
    assert not set(usernames) & USERNAMES_RESERVADOS


def test_existe_poema_de_cada_forma(semeado):
    for forma in FORMAS:
        assert contar(semeado, Post, Post.forma == forma, Post.repost_de_id.is_(None)) > 0, forma


def test_sonetos_e_haicais_respeitam_a_forma():
    for poema in POEMAS:
        if poema.forma == "soneto":
            assert len(versos(poema.texto)) == 14, poema.chave
        if poema.forma == "haicai":
            assert len(versos(poema.texto)) == 3, poema.chave
    assert len(POEMAS) >= 60
    assert sum(len(p.texto.split("\n")) > 20 for p in POEMAS) >= 3


def test_existem_citacao_repost_e_comentario_com_resposta(semeado):
    citacoes = contar(semeado, Post, Post.repost_de_id.is_not(None), Post.texto != "")
    puros = contar(semeado, Post, Post.repost_de_id.is_not(None), Post.texto == "")
    respostas = contar(semeado, Comentario, Comentario.parent_id.is_not(None))
    assert citacoes >= 5
    assert puros >= 10
    assert respostas >= 10


def test_comentarios_em_arvore_com_quatro_niveis_e_removidos(semeado):
    pais = dict(semeado.execute(select(Comentario.id, Comentario.parent_id)).all())

    def nivel(comentario_id: int) -> int:
        pai = pais[comentario_id]
        return 1 if pai is None else 1 + nivel(pai)

    assert max(nivel(c) for c in pais) == 4
    removidos = list(semeado.scalars(select(Comentario).where(Comentario.removido.is_(True))))
    assert len(removidos) == 2
    for removido in removidos:
        assert removido.texto == ""
        assert contar(semeado, Comentario, Comentario.parent_id == removido.id) > 0


def test_curtidas_concentradas_e_antologias(semeado):
    total = contar(semeado, Curtida)
    assert total > 150
    por_post = sorted(
        semeado.scalars(select(func.count()).select_from(Curtida).group_by(Curtida.post_id)),
        reverse=True,
    )
    assert sum(por_post[:6]) > total / 4
    # Curtir um repost puro curte o original: nenhum repost puro tem curtida.
    puros = select(Post.id).where(Post.repost_de_id.is_not(None), Post.texto == "")
    assert contar(semeado, Curtida, Curtida.post_id.in_(puros)) == 0
    assert contar(semeado, Antologia, Antologia.publica.is_(True)) >= 2
    assert contar(semeado, Antologia, Antologia.publica.is_(False)) >= 1


def test_datas_nos_ultimos_14_dias_com_parte_nas_ultimas_24h(semeado):
    agora = datetime.now(UTC).replace(tzinfo=None)
    datas = list(semeado.scalars(select(Post.created_at)))
    assert all(agora - timedelta(days=14) <= d <= agora for d in datas)
    assert sum(d >= agora - timedelta(hours=24) for d in datas) >= 8


def entrar(client, username: str = "marina_letras") -> dict:
    r = client.post("/auth/login", json={"username": username, "password": "verso123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_tags_do_seed_no_trending_e_na_busca(client, semeado):
    """No mesmo processo, sem restart: o seed indexou com as datas reescritas."""
    marina = entrar(client)
    r = client.get("/tags/trending", headers=marina)
    assert r.status_code == 200
    assert r.json()["items"]
    r = client.get("/tags/ônibus/posts", headers=marina)
    assert r.status_code == 200
    assert r.json()["total"] >= 3


def test_tags_aparecem_depois_do_restart(client, semeado):
    """Com `make seed` o processo é outro: o índice está no banco, nada a reconstruir."""
    from app.main import app

    with TestClient(app) as reiniciado:
        r = reiniciado.get("/tags/chuva/posts", headers=entrar(reiniciado))
        assert r.json()["total"] >= 3


def test_poetas_do_seed_seguem_e_citam_consagrados(semeado, tmp_path):
    shutil.copy(importar_consagrados.PASTA_CONSAGRADOS / "_exemplo.json", tmp_path / "augusto.json")
    importar_consagrados.importar(semeado, importar_consagrados.ler_consagrados(tmp_path))
    seed.interagir_com_consagrados(semeado)
    seed.interagir_com_consagrados(semeado)

    augusto = semeado.scalar(select(User).where(User.consagrado.is_(True)))
    assert contar(semeado, Follow, Follow.seguido_id == augusto.id) == len(POETAS)
    poemas = select(Post.id).where(Post.autor_id == augusto.id)
    citacoes = contar(semeado, Post, Post.repost_de_id.in_(poemas), Post.texto != "")
    assert citacoes == 1


def test_main_liga_os_poetas_do_seed_aos_consagrados_reais(client):
    """Com os JSONs de data/consagrados: follows, curtidas, repost e citação de clássico."""
    seed.main()
    with SessionLocal() as db:
        consagrados = select(User.id).where(User.consagrado.is_(True))
        assert contar(db, User, User.consagrado.is_(True)) > 0
        for poeta in POETAS:
            seguidor = select(User.id).where(User.username == poeta.username)
            esperado = seed.CONSAGRADOS_DA_DEMO if poeta.username == CONTA_DEMO else 3
            seguidos = contar(
                db, Follow, Follow.seguidor_id.in_(seguidor), Follow.seguido_id.in_(consagrados)
            )
            assert seguidos == esperado, poeta.username
        classicos = select(Post.id).where(Post.autor_id.in_(consagrados))
        assert contar(db, Curtida, Curtida.post_id.in_(classicos)) >= len(POETAS)
        assert contar(db, Post, Post.repost_de_id.in_(classicos), Post.texto == "") == 1
        assert contar(db, Post, Post.repost_de_id.in_(classicos), Post.texto != "") == 1


def test_seed_sem_poema_repetido(client):
    """Nem nos consagrados reais (o importador deixa os trechos de fora) nem nos
    poetas do seed: nenhum autor tem o mesmo poema duas vezes, fora os pares de
    versões diferentes de `_versoes_distintas.json`, que ficam os dois."""
    from app.core.duplicados import grupos_de_duplicados

    distintos = importar_consagrados.ler_versoes_distintas()
    seed.main()
    with SessionLocal() as db:
        poemas_por_autor: dict[str, list[tuple[int, str, str | None]]] = {}
        autorais = (
            select(User.username, Post.id, Post.texto, Post.titulo)
            .join(User, User.id == Post.autor_id)
            .where(~Post.repost_puro)
        )
        for username, post_id, texto, titulo in db.execute(autorais.order_by(Post.id)):
            poemas_por_autor.setdefault(username, []).append((post_id, texto, titulo))
        repetidos = {
            username: grupos
            for username, poemas in poemas_por_autor.items()
            if (
                grupos := grupos_de_duplicados(
                    [(i, texto) for i, texto, _ in poemas],
                    [titulo for _, _, titulo in poemas],
                    distintos.get(username, set()),
                )
            )
        }
        titulos = set(db.scalars(select(Post.titulo)))
    assert repetidos == {}
    for pares in distintos.values():
        for par in pares:
            assert par <= titulos, par
