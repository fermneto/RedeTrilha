"""scripts/corrigir_titulos_consagrados.py e o importador com o título sem o caminho."""

import json
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models.post import Post
from app.models.traducao import Traducao
from app.models.user import User
from scripts import corrigir_titulos_consagrados as corrigir
from scripts.importar_consagrados import importar, ler_consagrados

VOZES = "Eu (Augusto dos Anjos, 1912)/Vozes de um Tumulo"
MAR = "O Mar (Augusto dos Anjos)"
TEXTOS = {
    VOZES: "Morri! E a Terra — a mãe commum — o brilho\nDestes meus olhos apagou!...",
    MAR: "Gemem, em derredor, as ondas do mar\nnum ritmo de dor",
    "Versos Íntimos": "Vês?! Ninguém assistiu ao formidável\nEnterro de tua última quimera.",
}


def _json(pasta) -> None:
    poemas = [
        {"titulo": titulo, "texto": texto, "fonte": f"https://pt.wikisource.org/wiki/{i}"}
        for i, (titulo, texto) in enumerate(TEXTOS.items())
    ]
    dados = {"username": "augusto_dos_anjos", "name": "Augusto dos Anjos", "nascimento": 1884,
             "morte": 1914, "poemas": poemas}
    (pasta / "augusto_dos_anjos.json").write_text(json.dumps(dados), encoding="utf-8")


def _banco_antigo(db) -> dict[str, int]:
    """O banco como o importador antigo deixou: o título com o caminho."""
    autor = User(username="augusto_dos_anjos", name="Augusto dos Anjos", consagrado=True)
    db.add(autor)
    db.flush()
    ids = {}
    for titulo, texto in TEXTOS.items():
        post = Post(autor_id=autor.id, titulo=titulo, texto=texto)
        db.add(post)
        db.flush()
        ids[titulo] = post.id
    db.commit()
    return ids


def _titulos(db) -> list[tuple]:
    return sorted(db.execute(select(Post.titulo, Post.obra, Post.ano)).all(), key=str)


ESPERADO = [("O Mar", None, None), ("Versos Íntimos", None, None), ("Vozes de um Tumulo", "Eu", 1912)]


def test_importador_grava_o_titulo_sem_o_caminho(client, tmp_path):
    _json(tmp_path)
    with SessionLocal() as db:
        importar(db, ler_consagrados(tmp_path))
        assert _titulos(db) == ESPERADO


def test_dry_run_lista_e_nao_muda_nada(client, tmp_path, monkeypatch, capsys):
    _json(tmp_path)
    monkeypatch.setattr(corrigir, "PASTA_CONSAGRADOS", tmp_path)
    monkeypatch.setattr(sys, "argv", ["corrigir", "--dry-run"])
    with SessionLocal() as db:
        _banco_antigo(db)

    corrigir.main()

    saida = capsys.readouterr().out
    assert f"{VOZES!r} (obra=None, ano=None) → 'Vozes de um Tumulo' (obra='Eu', ano=1912)" in saida
    assert "2 poemas mudariam" in saida
    with SessionLocal() as db:
        assert sorted(db.scalars(select(Post.titulo))) == sorted(TEXTOS)


def test_corrige_tira_a_traducao_e_o_importador_acha_os_poemas(client, tmp_path, monkeypatch):
    _json(tmp_path)
    monkeypatch.setattr(corrigir, "PASTA_CONSAGRADOS", tmp_path)
    monkeypatch.setattr(sys, "argv", ["corrigir"])
    with SessionLocal() as db:
        ids = _banco_antigo(db)
        for post_id in ids.values():
            db.add(Traducao(post_id=post_id, idioma_destino="en", titulo="t", texto="x", modelo="m"))
        db.commit()

    corrigir.main()

    with SessionLocal() as db:
        assert _titulos(db) == ESPERADO
        # Só a tradução do poema que mudou de título sai.
        assert list(db.scalars(select(Traducao.post_id))) == [ids["Versos Íntimos"]]
        assert corrigir.planejar(db, ler_consagrados(tmp_path)).mudancas == []
        resumo = importar(db, ler_consagrados(tmp_path))
        assert (resumo.poemas_criados, resumo.poemas_atualizados) == (0, 3)


def test_poema_fora_do_json_tambem_muda_e_o_que_colide_fica(client, tmp_path):
    _json(tmp_path)
    with SessionLocal() as db:
        ids = _banco_antigo(db)
        autor_id = db.get(Post, ids[MAR]).autor_id
        # Um poema que saiu do JSON e uma cópia que fundir_poemas_repetidos não fundiu,
        # que ficaria com a chave de "Versos Íntimos".
        fora = Post(autor_id=autor_id, titulo="Eu (Augusto dos Anjos, 1912)/Solitario", texto="y")
        copia = Post(autor_id=autor_id, titulo="Versos Íntimos (Augusto dos Anjos)", texto="x")
        db.add_all([copia, fora])
        db.commit()

        plano = corrigir.planejar(db, ler_consagrados(tmp_path))

        depois = {m.post_id: m.depois for m in plano.mudancas}
        assert depois[fora.id] == corrigir.Poema("Solitario", "Eu", 1912)
        assert set(depois) == {fora.id, ids[MAR], ids[VOZES]}
        assert [c.post_id for c in plano.conflitos] == [copia.id]
