"""Tradução de poemas. O cliente da Anthropic é sempre falso: nenhum teste chama a API real."""

from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.schemas.consagrado import idioma_da_fonte

TEXTO_EN = "Because I could not stop for Death –\nHe kindly stopped for me –\n\n  The Carriage held but just Ourselves –"
TRADUCAO_PT = "Porque eu não pude parar pela Morte –\nEla gentil parou por mim –\n\n  A Carruagem levava só nós –"


class ClienteFalso:
    """Imita `anthropic.Anthropic`: guarda os pedidos e devolve uma resposta fixa."""

    def __init__(self, texto: str = f"TÍTULO: Porque eu não pude\n\n{TRADUCAO_PT}", stop_reason="end_turn"):
        self.pedidos: list[dict] = []
        self.resposta = SimpleNamespace(
            stop_reason=stop_reason,
            content=[
                SimpleNamespace(type="thinking", thinking=""),
                SimpleNamespace(type="text", text=texto),
            ],
        )
        self.messages = SimpleNamespace(create=self._criar)

    def _criar(self, **pedido):
        self.pedidos.append(pedido)
        return self.resposta


@pytest.fixture()
def falso(monkeypatch):
    from app.services import traducao

    cliente = ClienteFalso()
    monkeypatch.setattr(traducao, "_cliente", cliente)
    return cliente


def _poema_em_ingles() -> int:
    """Um consagrado com poema em inglês, gravado direto no banco (sem login)."""
    from app.db import SessionLocal
    from app.models.post import Post
    from app.models.user import User

    with SessionLocal() as db:
        poeta = User(username="emily", name="Emily Dickinson", consagrado=True, morte=1886)
        db.add(poeta)
        db.flush()
        post = Post(
            autor_id=poeta.id,
            titulo="Because I could not stop for Death",
            texto=TEXTO_EN,
            fonte="https://en.wikisource.org/wiki/Because_I_could_not_stop_for_Death",
            idioma="en",
        )
        db.add(post)
        db.commit()
        return post.id


def _traducoes() -> int:
    from app.db import SessionLocal
    from app.models.traducao import Traducao

    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(Traducao))


def test_idioma_da_fonte_vem_do_subdominio():
    assert idioma_da_fonte("https://pt.wikisource.org/wiki/Versos_%C3%8Dntimos") == "pt"
    assert idioma_da_fonte("https://ja.wikiquote.org/wiki/x") == "ja"
    assert idioma_da_fonte("https://FA.wikisource.org/wiki/x") == "fa"
    assert idioma_da_fonte("https://www.gutenberg.org/ebooks/1") is None
    assert idioma_da_fonte("https://wikisource.org/wiki/x") is None
    assert idioma_da_fonte(None) is None


def test_post_out_traz_o_idioma(client, logar):
    ana = logar("ana")
    r = client.post("/posts", json={"texto": "meu verso"}, headers=ana)
    assert r.json()["idioma"] == "pt"

    post_id = _poema_em_ingles()
    assert client.get(f"/posts/{post_id}", headers=ana).json()["idioma"] == "en"


def test_traduz_preserva_estrutura_e_grava_no_cache(client, logar, falso):
    ana = logar("ana")
    post_id = _poema_em_ingles()

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert r.status_code == 200
    assert r.json() == {
        "titulo": "Porque eu não pude",
        "texto": TRADUCAO_PT,
        "idioma_origem": "en",
        "idioma_destino": "pt",
        "modelo": "claude-haiku-5-5",
        "em_cache": False,
    }
    [pedido] = falso.pedidos
    assert pedido["model"] == "claude-haiku-5-5"
    assert "thinking" not in pedido and "temperature" not in pedido
    assert TEXTO_EN in pedido["messages"][0]["content"]
    assert _traducoes() == 1


def test_cache_nao_chama_o_cliente_de_novo(client, logar, falso):
    ana, bia = logar("ana"), logar("bia")
    post_id = _poema_em_ingles()
    client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=bia)
    assert (r.status_code, r.json()["em_cache"], r.json()["texto"]) == (200, True, TRADUCAO_PT)
    assert len(falso.pedidos) == 1


def test_sem_chave_da_503(client, logar, monkeypatch):
    from app.services import traducao

    monkeypatch.setattr(traducao, "_cliente", None)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    ana = logar("ana")
    post_id = _poema_em_ingles()

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert (r.status_code, r.json()["detail"]) == (503, "tradução indisponível no momento")


def test_mesma_lingua_da_422(client, logar, falso):
    ana = logar("ana")
    post_id = _poema_em_ingles()

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "en"}, headers=ana)
    assert (r.status_code, r.json()["detail"]) == (422, "o poema já está nessa língua")
    assert falso.pedidos == []


def test_lingua_invalida_da_422(client, logar, falso):
    ana = logar("ana")
    post_id = _poema_em_ingles()
    for para in ("portugues", "PT", "p1", ""):
        r = client.post(f"/posts/{post_id}/traduzir", json={"para": para}, headers=ana)
        assert r.status_code == 422


def test_sem_login_da_401_e_poema_inexistente_da_404(client, logar, falso):
    post_id = _poema_em_ingles()
    assert client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}).status_code == 401
    r = client.post("/posts/999/traduzir", json={"para": "pt"}, headers=logar("ana"))
    assert r.status_code == 404


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_recusa_ou_corte_da_502_sem_gravar(client, logar, falso, stop_reason):
    falso.resposta.stop_reason = stop_reason
    ana = logar("ana")
    post_id = _poema_em_ingles()

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert r.status_code == 502
    assert _traducoes() == 0


def test_repost_puro_traduz_o_original(client, logar, falso):
    ana = logar("ana")
    post_id = _poema_em_ingles()
    from app.db import SessionLocal
    from app.models.post import Post

    client.post(f"/posts/{post_id}/repostar", headers=ana)
    with SessionLocal() as db:
        repost_id = db.scalar(select(Post.id).where(Post.repost_de_id == post_id))

    r = client.post(f"/posts/{repost_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert (r.status_code, r.json()["idioma_origem"]) == (200, "en")
    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert r.json()["em_cache"] is True


def test_linhas_diferentes_aceita_com_aviso(client, logar, falso, caplog):
    falso.resposta.content[1].text = "TÍTULO: Porque eu não pude\n\numa linha só"
    ana = logar("ana")
    post_id = _poema_em_ingles()

    r = client.post(f"/posts/{post_id}/traduzir", json={"para": "pt"}, headers=ana)
    assert (r.status_code, r.json()["texto"]) == (200, "uma linha só")
    assert "tem 1 linhas; o original tem 4" in caplog.text


def test_apagar_e_editar_o_poema_apagam_as_traducoes(client, logar, falso):
    ana = logar("ana")
    meu = client.post("/posts", json={"texto": "verso\n\noutro"}, headers=ana).json()["id"]
    falso.resposta.content[1].text = "line\n\nother"

    client.post(f"/posts/{meu}/traduzir", json={"para": "en"}, headers=ana)
    assert _traducoes() == 1
    client.patch(f"/posts/{meu}", json={"texto": "verso novo"}, headers=ana)
    assert _traducoes() == 0

    client.post(f"/posts/{meu}/traduzir", json={"para": "en"}, headers=ana)
    assert _traducoes() == 1
    assert client.delete(f"/posts/{meu}", headers=ana).status_code == 204
    assert _traducoes() == 0
