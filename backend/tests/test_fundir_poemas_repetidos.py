"""scripts/fundir_poemas_repetidos.py e o importador sem poemas repetidos."""

import json

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models.ancora_comentario import AncoraComentario
from app.models.antologia import Antologia, AntologiaPoema
from app.models.aviso import Aviso
from app.models.comentario import Comentario
from app.models.conversa import Conversa
from app.models.curtida import Curtida
from app.models.mensagem import Mensagem
from app.models.post import Post
from app.models.rascunho import Rascunho
from app.models.traducao import Traducao
from app.models.user import User
from scripts import fundir_poemas_repetidos as fundir
from scripts.importar_consagrados import importar, ler_consagrados

INTEIRO = (
    "Minha terra tem palmeiras,\nOnde canta o Sabiá;\n"
    "As aves, que aqui gorjeiam,\nNão gorjeiam como lá.\n\n"
    "Nosso céu tem mais estrelas,\nNossas várzeas têm mais flores,\n"
    "Nossos bosques têm mais vida,\nNossa vida mais amores."
)
TRECHO = "Nosso céu tem mais estrelas,\nNossas várzeas têm mais flores,\n"
OUTRO = "No meio do caminho tinha uma pedra\ntinha uma pedra no meio do caminho"


def _consagrado(db, username="goncalves_dias") -> User:
    autor = User(username=username, name=username.title(), consagrado=True)
    db.add(autor)
    db.flush()
    return autor


def _post(db, autor_id: int, texto: str, titulo: str | None = None, repost_de_id=None) -> int:
    post = Post(autor_id=autor_id, texto=texto, titulo=titulo, repost_de_id=repost_de_id)
    db.add(post)
    db.flush()
    return post.id


def _contar(db, modelo, *filtros) -> int:
    return db.scalar(select(func.count()).select_from(modelo).where(*filtros))


def test_simular_lista_e_nao_muda_nada(client, criar_usuario, capsys):
    with SessionLocal() as db:
        autor = _consagrado(db)
        trecho = _post(db, autor.id, TRECHO, "Canção do exílio (estrofes)")
        inteiro = _post(db, autor.id, INTEIRO, "Canção do exílio")
        _post(db, autor.id, OUTRO, "Outro")
        db.commit()

    fundir.main([])

    saida = capsys.readouterr().out
    assert f"goncalves_dias: fica {inteiro} (Canção do exílio); sai {trecho}" in saida
    assert "1 grupos, 1 poemas a fundir (simulação: nada mudou)" in saida
    with SessionLocal() as db:
        assert db.get(Post, trecho) is not None


def test_aplicar_funde_tudo_no_mantido_sem_duplicar(client, criar_usuario):
    ana, bia, caio = (criar_usuario(u) for u in ("ana", "bia", "caio"))
    with SessionLocal() as db:
        autor = _consagrado(db)
        inteiro = _post(db, autor.id, INTEIRO)
        trecho = _post(db, autor.id, TRECHO)
        # Curtidas: ana curtiu os dois (não duplica), bia só o trecho (passa).
        db.add_all([Curtida(user_id=ana, post_id=inteiro), Curtida(user_id=ana, post_id=trecho)])
        db.add(Curtida(user_id=bia, post_id=trecho))
        db.add_all(
            [
                Aviso(destinatario_id=autor.id, tipo="curtida", ator_id=ana, post_id=inteiro),
                Aviso(destinatario_id=autor.id, tipo="curtida", ator_id=ana, post_id=trecho),
                Aviso(destinatario_id=autor.id, tipo="curtida", ator_id=bia, post_id=trecho),
            ]
        )
        # Reposts puros: ana repostou os dois (não duplica), caio só o trecho.
        _post(db, ana, "", repost_de_id=inteiro)
        repost_repetido = _post(db, ana, "", repost_de_id=trecho)
        repost_do_caio = _post(db, caio, "", repost_de_id=trecho)
        citacao = _post(db, bia, "que estrofe", repost_de_id=trecho)
        # Comentário com resposta e crítica ancorada nos versos 1-2 do trecho
        # (no inteiro, 6-7); outra nos versos 1-3, com o verso em branco do fim do
        # trecho, que no inteiro não vêm nessa sequência.
        comentario = Comentario(post_id=trecho, autor_id=bia, texto="bonito")
        db.add(comentario)
        db.flush()
        resposta = Comentario(post_id=trecho, autor_id=ana, texto="sim", parent_id=comentario.id)
        critica = Comentario(post_id=trecho, autor_id=caio, texto="o ritmo")
        sem_lugar = Comentario(post_id=trecho, autor_id=caio, texto="o verso vazio")
        db.add_all([resposta, critica, sem_lugar])
        db.flush()
        db.add(AncoraComentario(comentario_id=critica.id, verso_inicio=1, verso_fim=2))
        db.add(AncoraComentario(comentario_id=sem_lugar.id, verso_inicio=1, verso_fim=3))
        # Antologias: a de ana tem os dois (não duplica), a de bia só o trecho.
        da_ana = Antologia(dono_id=ana, nome="Exílio")
        da_bia = Antologia(dono_id=bia, nome="Brasil")
        db.add_all([da_ana, da_bia])
        db.flush()
        db.add_all(
            [
                AntologiaPoema(antologia_id=da_ana.id, post_id=inteiro, posicao=1),
                AntologiaPoema(antologia_id=da_ana.id, post_id=trecho, posicao=2),
                AntologiaPoema(antologia_id=da_bia.id, post_id=trecho, posicao=1),
            ]
        )
        conversa = Conversa(menor_id=ana, maior_id=bia)
        db.add(conversa)
        db.flush()
        db.add(Mensagem(conversa_id=conversa.id, autor_id=ana, post_id=trecho))
        db.add(Rascunho(autor_id=caio, texto="cito depois", repost_de_id=trecho))
        db.add(Traducao(post_id=trecho, idioma_destino="en", texto="Our sky", modelo="x"))
        db.commit()
        ids = {
            "comentario": comentario.id,
            "resposta": resposta.id,
            "critica": critica.id,
            "sem_lugar": sem_lugar.id,
        }

    fundir.main(["--aplicar"])

    with SessionLocal() as db:
        assert db.get(Post, trecho) is None
        assert sorted(db.scalars(select(Curtida.user_id).where(Curtida.post_id == inteiro))) == [
            ana,
            bia,
        ]
        assert sorted(
            db.scalars(select(Aviso.ator_id).where(Aviso.tipo == "curtida", Aviso.post_id == inteiro))
        ) == [ana, bia]
        assert db.get(Post, repost_repetido) is None
        assert db.get(Post, repost_do_caio).repost_de_id == inteiro
        assert _contar(db, Post, Post.repost_de_id == inteiro, Post.texto == "") == 2
        assert db.get(Post, citacao).repost_de_id == inteiro
        for chave in ("comentario", "resposta", "critica", "sem_lugar"):
            assert db.get(Comentario, ids[chave]).post_id == inteiro
        assert db.get(Comentario, ids["resposta"]).parent_id == ids["comentario"]
        ancora = db.get(AncoraComentario, ids["critica"])
        assert (ancora.verso_inicio, ancora.verso_fim) == (6, 7)
        assert db.get(AncoraComentario, ids["sem_lugar"]) is None
        assert _contar(db, AntologiaPoema, AntologiaPoema.antologia_id == da_ana.id) == 1
        assert db.scalar(
            select(AntologiaPoema.post_id).where(AntologiaPoema.antologia_id == da_bia.id)
        ) == inteiro
        assert db.scalar(select(Mensagem.post_id)) == inteiro
        assert db.scalar(select(Rascunho.repost_de_id)) == inteiro
        assert _contar(db, Traducao) == 0


def test_aplicar_duas_vezes_nao_faz_nada_na_segunda(client, capsys):
    with SessionLocal() as db:
        autor = _consagrado(db)
        _post(db, autor.id, INTEIRO)
        _post(db, autor.id, TRECHO)
        _post(db, autor.id, TRECHO.upper())
        db.commit()

    fundir.main(["--aplicar"])
    assert "1 grupos, 2 poemas fundidos" in capsys.readouterr().out
    fundir.main(["--aplicar"])
    assert "0 grupos, 0 poemas fundidos" in capsys.readouterr().out
    with SessionLocal() as db:
        assert [p.texto for p in db.scalars(select(Post))] == [INTEIRO]


def test_poema_de_conta_comum_nao_entra(client, criar_usuario):
    ana = criar_usuario("ana")
    with SessionLocal() as db:
        _post(db, ana, INTEIRO)
        _post(db, ana, TRECHO)
        db.commit()
        assert fundir.encontrar_grupos(db) == []


def test_importador_deixa_o_trecho_de_fora_e_nao_o_cria_ao_reimportar(client, tmp_path):
    poemas = [
        {"titulo": "Canção do exílio (estrofes)", "texto": TRECHO, "fonte": "https://pt.wikisource.org/wiki/A"},
        {"titulo": "Canção do exílio", "texto": INTEIRO, "fonte": "https://pt.wikisource.org/wiki/B"},
        {"titulo": "Outro", "texto": OUTRO, "fonte": "https://pt.wikisource.org/wiki/C"},
    ]
    dados = {"username": "goncalves_dias", "name": "Gonçalves Dias", "nascimento": 1823,
             "morte": 1864, "poemas": poemas}
    (tmp_path / "goncalves_dias.json").write_text(json.dumps(dados), encoding="utf-8")

    with SessionLocal() as db:
        resumo = importar(db, ler_consagrados(tmp_path))
        assert (resumo.poemas_criados, resumo.poemas_repetidos) == (2, 1)
        resumo = importar(db, ler_consagrados(tmp_path))
        assert (resumo.poemas_criados, resumo.poemas_atualizados) == (0, 2)
        assert sorted(db.scalars(select(Post.titulo))) == ["Canção do exílio", "Outro"]
        assert fundir.encontrar_grupos(db) == []
