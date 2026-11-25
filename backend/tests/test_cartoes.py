"""Cartão de compartilhamento: GET /cartoes/... sem login, só com o mínimo do cartão."""

from app.db import SessionLocal
from app.models.user import User

SONETO = "\n**Vês?!** Ninguém assistiu ao *formidável*\n  Enterro de tua última quimera.\n\n" + "\n".join(
    f"verso {n}" for n in range(3, 15)
)


def _poema(client, autor: dict, texto: str = SONETO, **extra) -> int:
    r = client.post("/posts", json={"texto": texto, **extra}, headers=autor)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _sem_login(client, caminho: str):
    """O GET sem nenhum header: nem token, nem o X-Teste-Usuario do `como`."""
    return client.get(caminho)


def test_poema_sem_login_traz_so_o_minimo(client, como):
    post_id = _poema(client, como("ana"), titulo="*Versos* íntimos", forma="soneto")
    client.post(f"/posts/{post_id}/curtir", headers=como("bia"))

    r = _sem_login(client, f"/cartoes/poema/{post_id}")

    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=300"
    cartao = r.json()
    assert set(cartao) == {"id", "titulo", "versos", "continua", "idioma", "autor"}
    assert set(cartao["autor"]) == {"username", "name", "consagrado", "nascimento", "morte"}
    assert cartao["titulo"] == "Versos íntimos"
    # Sem marcas, a partir do primeiro verso não vazio, com recuo e estrofe.
    assert cartao["versos"][:4] == [
        "Vês?! Ninguém assistiu ao formidável",
        "  Enterro de tua última quimera.",
        "",
        "verso 3",
    ]
    assert len(cartao["versos"]) == 12
    assert cartao["continua"] is True
    assert cartao["autor"]["username"] == "ana"


def test_poema_curto_nao_continua(client, como):
    post_id = _poema(client, como("ana"), texto="um verso só")
    cartao = _sem_login(client, f"/cartoes/poema/{post_id}").json()
    assert (cartao["titulo"], cartao["versos"], cartao["continua"]) == (None, ["um verso só"], False)


def test_repost_puro_mostra_o_original_e_a_citacao_o_proprio_texto(client, como):
    original = _poema(client, como("ana"))
    assert client.post(f"/posts/{original}/repostar", headers=como("bia")).status_code == 204
    citacao = _poema(client, como("caio"), texto="que verso", repost_de_id=original)
    repost = max(p["id"] for p in client.get("/usuarios/bia/posts", headers=como("bia")).json()["items"])

    assert _sem_login(client, f"/cartoes/poema/{repost}").json()["autor"]["username"] == "ana"
    assert _sem_login(client, f"/cartoes/poema/{citacao}").json()["versos"] == ["que verso"]


def test_poema_apagado_ou_inexistente_da_404(client, como):
    post_id = _poema(client, como("ana"))
    assert client.delete(f"/posts/{post_id}", headers=como("ana")).status_code == 204
    assert _sem_login(client, f"/cartoes/poema/{post_id}").status_code == 404
    assert _sem_login(client, "/cartoes/poema/999").status_code == 404


def test_rascunho_nunca_vira_cartao(client, como):
    r = client.post("/rascunhos", json={"texto": "segredo da gaveta"}, headers=como("ana"))
    assert r.status_code == 201
    rascunho_id = r.json()["id"]

    resposta = _sem_login(client, f"/cartoes/poema/{rascunho_id}")
    assert resposta.status_code == 404
    assert "segredo" not in resposta.text


def test_usuario_sem_seguidores_nem_dado_de_quem_pede(client, como):
    with SessionLocal() as db:
        ana = db.query(User).filter_by(username="ana").one()
        ana.bio, ana.avatar_url = "escrevo no ônibus", "https://exemplo.com/ana.png"
        db.commit()
    _poema(client, como("ana"))
    _poema(client, como("ana"), texto="outro")
    client.post("/usuarios/ana/seguir", headers=como("bia"))

    r = _sem_login(client, "/cartoes/usuario/ana")

    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=300"
    assert r.json() == {
        "username": "ana",
        "name": "Ana",
        "consagrado": False,
        "nascimento": None,
        "morte": None,
        "bio": "escrevo no ônibus",
        "avatar_url": "https://exemplo.com/ana.png",
        "poemas": 2,
    }
    assert _sem_login(client, "/cartoes/usuario/ninguem").status_code == 404


def test_renga_de_convidados_tambem_tem_cartao(client, como):
    r = client.post(
        "/rengas",
        json={
            "titulo": "Renga do sarau",
            "primeira_estrofe": "na varanda\n  a chuva",
            "modo": "convidados",
            "convidados": ["bia"],
        },
        headers=como("ana"),
    )
    assert r.status_code == 201, r.text
    renga_id = r.json()["id"]
    assert (
        client.post(f"/rengas/{renga_id}/estrofes", json={"texto": "e o **mar**"}, headers=como("bia")).status_code
        == 201
    )

    cartao = _sem_login(client, f"/cartoes/renga/{renga_id}").json()

    assert set(cartao) == {"id", "titulo", "autores", "versos", "continua"}
    assert cartao["titulo"] == "Renga do sarau"
    assert [a["username"] for a in cartao["autores"]] == ["ana", "bia"]
    assert cartao["versos"] == ["na varanda", "  a chuva", "", "e o mar"]
    assert _sem_login(client, "/cartoes/renga/999").status_code == 404


def test_antologia_publica_tem_cartao_e_a_privada_da_404(client, como):
    poema = _poema(client, como("bia"), titulo="Chuva")
    sem_titulo = _poema(client, como("caio"), texto="\nônibus lotado —\no calor")
    publica = client.post(
        "/antologias", json={"nome": "Poemas de chuva", "descricao": "para dias cinzas"}, headers=como("ana")
    ).json()["id"]
    privada = client.post(
        "/antologias", json={"nome": "Diário", "publica": False}, headers=como("ana")
    ).json()["id"]
    for antologia in (publica, privada):
        for post_id in (poema, sem_titulo):
            assert (
                client.post(
                    f"/antologias/{antologia}/poemas", json={"post_id": post_id}, headers=como("ana")
                ).status_code
                == 204
            )

    cartao = _sem_login(client, f"/cartoes/antologia/{publica}").json()
    assert set(cartao) == {"id", "nome", "descricao", "dono", "qtd", "poemas"}
    assert (cartao["nome"], cartao["descricao"], cartao["qtd"]) == ("Poemas de chuva", "para dias cinzas", 2)
    assert cartao["dono"]["username"] == "ana"
    assert [(p["titulo"], p["primeiro_verso"], p["autor"]["username"]) for p in cartao["poemas"]] == [
        ("Chuva", "Vês?! Ninguém assistiu ao formidável", "bia"),
        (None, "ônibus lotado —", "caio"),
    ]

    resposta = _sem_login(client, f"/cartoes/antologia/{privada}")
    assert resposta.status_code == 404
    assert "Diário" not in resposta.text
    assert "cache-control" not in resposta.headers
    assert _sem_login(client, "/cartoes/antologia/999").status_code == 404


def test_as_rotas_de_sempre_continuam_pedindo_login(client):
    for caminho in ("/posts/1", "/usuarios/ana", "/rengas/1", "/antologias/1"):
        assert client.get(caminho).status_code == 401, caminho
