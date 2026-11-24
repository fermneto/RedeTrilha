import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.consagrado import Consagrado
from scripts.importar_consagrados import (
    PASTA_CONSAGRADOS,
    ArquivoConsagradoInvalido,
    datas_dos_poemas,
    ler_consagrados,
)

AGORA = datetime(2026, 11, 25, 12, 0, tzinfo=UTC)


def consagrado(**campos) -> dict:
    poema = {
        "titulo": "Poema",
        "texto": "verso um\nverso dois",
        "forma": "soneto",
        "fonte": "https://pt.wikisource.org/wiki/Poema",
        "tags": ["morte"],
    }
    poema.update(campos.pop("poema", {}))
    dados = {
        "username": "poeta_teste",
        "name": "Poeta Teste",
        "nascimento": 1884,
        "morte": 1914,
        "poemas": [poema],
    }
    dados.update(campos)
    return dados


def escrever(pasta: Path, nome: str, dados: dict) -> None:
    (pasta / nome).write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")


def test_exemplo_segue_o_schema():
    exemplo = Consagrado.model_validate_json(
        (PASTA_CONSAGRADOS / "_exemplo.json").read_text(encoding="utf-8")
    )
    assert exemplo.username == "augusto_dos_anjos"
    assert exemplo.poemas[0].forma == "soneto"
    assert "\n\n" in exemplo.poemas[0].texto


def test_morte_depois_de_1955_e_recusada():
    with pytest.raises(ValidationError, match="domínio público"):
        Consagrado.model_validate(consagrado(nascimento=1902, morte=1987))


def test_nascimento_depois_da_morte_e_recusado():
    with pytest.raises(ValidationError, match="anterior à morte"):
        Consagrado.model_validate(consagrado(nascimento=1920, morte=1914))


def test_forma_invalida_e_recusada():
    with pytest.raises(ValidationError, match="forma deve ser uma de"):
        Consagrado.model_validate(consagrado(poema={"forma": "epopeia"}))


def test_fonte_e_obrigatoria_e_tag_fora_do_padrao_e_recusada():
    sem_fonte = consagrado()
    del sem_fonte["poemas"][0]["fonte"]
    with pytest.raises(ValidationError):
        Consagrado.model_validate(sem_fonte)
    with pytest.raises(ValidationError, match="tag inválida"):
        Consagrado.model_validate(consagrado(poema={"tags": ["Solidão"]}))


def test_texto_vazio_e_sem_poemas_sao_recusados():
    with pytest.raises(ValidationError, match="vazio"):
        Consagrado.model_validate(consagrado(poema={"texto": "  \n\n  "}))
    with pytest.raises(ValidationError):
        Consagrado.model_validate(consagrado(poemas=[]))


def test_quebras_de_linha_e_recuos_preservados():
    texto = "\n  primeiro verso\n    recuado\n\nnova estrofe  \n"
    lido = Consagrado.model_validate(consagrado(poema={"texto": texto}))
    assert lido.poemas[0].texto == texto


def test_le_a_pasta_em_ordem_e_ignora_rascunhos(tmp_path):
    escrever(tmp_path, "olavo_bilac.json", consagrado(username="olavo_bilac"))
    escrever(tmp_path, "castro_alves.json", consagrado(username="castro_alves"))
    escrever(tmp_path, "_rascunho.json", consagrado(username="rascunho"))
    lidos = ler_consagrados(tmp_path)
    assert [c.username for c in lidos] == ["castro_alves", "olavo_bilac"]


def test_arquivo_invalido_traz_o_nome_no_erro(tmp_path):
    escrever(tmp_path, "valido.json", consagrado())
    escrever(tmp_path, "vivo_demais.json", consagrado(morte=1987))
    with pytest.raises(ArquivoConsagradoInvalido, match=r"vivo_demais\.json.*domínio público"):
        ler_consagrados(tmp_path)


def test_nome_e_bio_seguem_as_regras_do_cadastro():
    with pytest.raises(ValidationError, match="o nome é obrigatório e tem até 80 caracteres"):
        Consagrado.model_validate(consagrado(name="   "))
    with pytest.raises(ValidationError, match="o nome é obrigatório e tem até 80 caracteres"):
        Consagrado.model_validate(consagrado(name="x" * 81))
    with pytest.raises(ValidationError, match="a bio tem até 1000 caracteres"):
        Consagrado.model_validate(consagrado(bio="x" * 1001))
    assert Consagrado.model_validate(consagrado(bio="x" * 1000)).bio == "x" * 1000


def test_username_reservado_e_recusado():
    with pytest.raises(ValidationError, match="reservado"):
        Consagrado.model_validate(consagrado(username="explorar"))


def test_username_reservado_aborta_a_importacao_sem_gravar_nada(client, tmp_path, monkeypatch):
    from scripts import importar_consagrados

    escrever(tmp_path, "a_valido.json", consagrado(username="a_valido"))
    escrever(tmp_path, "feed.json", consagrado(username="feed"))
    monkeypatch.setattr(importar_consagrados, "PASTA_CONSAGRADOS", tmp_path)
    with pytest.raises(SystemExit, match=r"feed\.json.*reservado"):
        importar_consagrados.main()
    assert _usuario("a_valido") is None


def test_json_malformado_traz_o_nome_no_erro(tmp_path):
    (tmp_path / "quebrado.json").write_text("{ nao e json", encoding="utf-8")
    with pytest.raises(ArquivoConsagradoInvalido, match=r"quebrado\.json"):
        ler_consagrados(tmp_path)


def test_datas_deterministicas_ordenadas_e_nos_ultimos_30_dias():
    datas = datas_dos_poemas("augusto_dos_anjos", 10, AGORA)
    assert datas == datas_dos_poemas("augusto_dos_anjos", 10, AGORA)
    assert datas != datas_dos_poemas("olavo_bilac", 10, AGORA)
    assert datas == sorted(datas)
    assert len(datas) == 10
    assert all(AGORA - timedelta(days=30) <= d <= AGORA for d in datas)
    assert all(d.tzinfo == UTC for d in datas)


def test_nascimento_e_opcional():
    dados = consagrado()
    del dados["nascimento"]
    assert Consagrado.model_validate(dados).nascimento is None


def test_poema_repetido_no_mesmo_json_e_recusado():
    poema = consagrado()["poemas"][0]
    with pytest.raises(ValidationError, match="poema repetido"):
        Consagrado.model_validate(consagrado(poemas=[poema, dict(poema, texto="outro")]))


# --- gravação no banco ---

TEXTO = "\n  Vês! Ninguém assistiu ao formidável\n    Enterro\n\nnova estrofe  \n"


def _importar_pasta(pasta: Path, agora: datetime = AGORA):
    from app.db import SessionLocal
    from scripts.importar_consagrados import importar

    with SessionLocal() as db:
        return importar(db, ler_consagrados(pasta), agora)


def _usuario(username: str):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        return db.scalar(select(User).where(User.username == username))


def _posts_de(username: str):
    from sqlalchemy import select

    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.user import User

    with SessionLocal() as db:
        consulta = select(Post).join(Post.autor).where(User.username == username)
        return list(db.scalars(consulta.order_by(Post.id)))


def test_importar_cria_consagrado_sem_login_e_poema_com_texto_identico(
    client, logar, tmp_path
):
    escrever(tmp_path, "poeta_teste.json", consagrado(poema={"texto": TEXTO, "obra": "Eu"}))
    resumo = _importar_pasta(tmp_path)
    assert (resumo.poetas_criados, resumo.poemas_criados) == (1, 1)

    poeta = _usuario("poeta_teste")
    assert (poeta.consagrado, poeta.password_hash) == (True, None)
    assert (poeta.nascimento, poeta.morte) == (1884, 1914)
    r = client.post("/auth/login", json={"username": "poeta_teste", "password": "qualquer"})
    assert r.status_code == 401

    [post] = _posts_de("poeta_teste")
    assert post.texto == TEXTO
    assert (post.forma, post.obra, post.tags_extras) == ("soneto", "Eu", ["morte"])
    leitora = logar("leitora")
    assert client.get(f"/posts/{post.id}", headers=leitora).json()["texto"] == TEXTO


def test_importar_grava_o_idioma_da_fonte(client, tmp_path):
    fonte = "https://la.wikisource.org/wiki/Carmen"
    escrever(tmp_path, "poeta_teste.json", consagrado(poema={"fonte": fonte}))
    _importar_pasta(tmp_path)
    [post] = _posts_de("poeta_teste")
    assert post.idioma == "la"


def test_reimportar_nao_duplica_atualiza_e_mantem_a_data(client, tmp_path):
    escrever(tmp_path, "poeta_teste.json", consagrado())
    _importar_pasta(tmp_path)
    [antes] = _posts_de("poeta_teste")

    escrever(
        tmp_path,
        "poeta_teste.json",
        consagrado(bio="bio nova", poema={"texto": "verso novo\n", "tags": ["mar"]}),
    )
    resumo = _importar_pasta(tmp_path, AGORA + timedelta(days=3))
    assert (resumo.poetas_criados, resumo.poetas_atualizados) == (0, 1)
    assert (resumo.poemas_criados, resumo.poemas_atualizados) == (0, 1)

    [depois] = _posts_de("poeta_teste")
    assert depois.id == antes.id
    assert (depois.texto, depois.tags_extras) == ("verso novo\n", ["mar"])
    assert depois.created_at == antes.created_at
    assert _usuario("poeta_teste").bio == "bio nova"


def test_tags_extras_entram_no_indice_ao_reconstruir(client, logar, tmp_path):
    from app.db import SessionLocal
    from app.services.posts import reconstruir_indice

    escrever(tmp_path, "poeta_teste.json", consagrado(poema={"tags": ["desilusao"]}))
    _importar_pasta(tmp_path)
    with SessionLocal() as db:
        reconstruir_indice(db)

    [post] = _posts_de("poeta_teste")
    pagina = client.get("/tags/desilusao/posts", headers=logar("leitora")).json()
    assert [p["id"] for p in pagina["items"]] == [post.id]
    assert pagina["items"][0]["tags"] == ["desilusao", "soneto"]


def test_morte_depois_de_1955_nao_grava_nada(client, tmp_path, monkeypatch):
    from scripts import importar_consagrados

    escrever(tmp_path, "a_valido.json", consagrado(username="a_valido"))
    escrever(tmp_path, "vivo_demais.json", consagrado(username="vivo_demais", morte=1987))
    monkeypatch.setattr(importar_consagrados, "PASTA_CONSAGRADOS", tmp_path)
    with pytest.raises(SystemExit, match="domínio público"):
        importar_consagrados.main()
    assert _usuario("a_valido") is None
    assert _usuario("vivo_demais") is None


def test_username_de_conta_comum_aborta_tudo(client, tmp_path):
    from scripts.importar_consagrados import UsernameDeUsuarioComum

    client.post("/usuarios", json={"username": "b_comum", "name": "Comum"})
    escrever(tmp_path, "a_poeta.json", consagrado(username="a_poeta"))
    escrever(tmp_path, "b_comum.json", consagrado(username="b_comum"))
    with pytest.raises(UsernameDeUsuarioComum):
        _importar_pasta(tmp_path)
    assert _usuario("a_poeta") is None
    assert _usuario("b_comum").consagrado is False


def test_pasta_so_com_exemplo_importa_zero(client, tmp_path, monkeypatch, capsys):
    from scripts import importar_consagrados

    escrever(tmp_path, "_exemplo.json", consagrado())
    monkeypatch.setattr(importar_consagrados, "PASTA_CONSAGRADOS", tmp_path)
    importar_consagrados.main()
    assert "0 poetas criados" in capsys.readouterr().out
    assert _usuario("poeta_teste") is None
