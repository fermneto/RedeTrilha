"""Perfil do poeta (P4): GET /usuarios/{username}, PATCH /usuarios/eu e
GET /usuarios/{username}/posts, com a auth real (fixture `logar`)."""

import pytest
from pydantic import ValidationError


def _poema(client, quem: dict, texto: str, **extra) -> int:
    r = client.post("/posts", json={"texto": texto, **extra}, headers=quem)
    assert r.status_code == 201
    return r.json()["id"]


def test_perfil_traz_contagens_e_se_eu_sigo(client, logar):
    ana = logar("ana", "Ana")
    bia = logar("bia", "Bia")
    original = _poema(client, bia, "verso da bia")
    _poema(client, ana, "verso da ana")
    _poema(client, ana, "citando a bia", repost_de_id=original)
    client.post(f"/posts/{original}/repostar", headers=ana)
    client.post("/usuarios/bia/follow", headers=ana)

    perfil = client.get("/usuarios/ana", headers=bia).json()
    assert perfil["username"] == "ana"
    assert perfil["name"] == "Ana"
    # o poema e a citação contam; o repost puro, não
    assert perfil["poemas"] == 2
    assert (perfil["seguidores"], perfil["seguindo"]) == (0, 1)
    assert perfil["sigo"] is False

    assert client.get("/usuarios/bia", headers=ana).json()["sigo"] is True
    # o próprio perfil: ninguém segue a si mesmo
    assert client.get("/usuarios/ana", headers=ana).json()["sigo"] is False


def test_perfil_inexistente_da_404_e_exige_login(client, logar):
    ana = logar("ana")
    assert client.get("/usuarios/ninguem", headers=ana).status_code == 404
    assert client.get("/usuarios/ninguem/posts", headers=ana).status_code == 404
    assert client.get("/usuarios/ana").status_code == 401
    assert client.patch("/usuarios/eu", json={"bio": "x"}).status_code == 401


def test_rotas_fixas_nao_sao_capturadas_pelo_username(client, logar):
    ana = logar("ana")
    assert "usuarios_por_inicial" in client.get("/usuarios/stats").json()
    assert client.patch("/usuarios/eu", json={"name": "Ana"}, headers=ana).status_code == 200


def test_perfil_de_consagrado_traz_selo_e_anos(client, logar):
    from app.db import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        db.add(User(username="cruz_e_sousa", name="Cruz e Sousa", consagrado=True,
                    nascimento=1861, morte=1898))
        db.commit()
    ana = logar("ana")

    perfil = client.get("/usuarios/cruz_e_sousa", headers=ana).json()
    assert perfil["consagrado"] is True
    assert (perfil["nascimento"], perfil["morte"]) == (1861, 1898)


def test_editar_perfil_muda_so_o_enviado_e_guarda_as_quebras(client, logar):
    ana = logar("ana", "Ana")
    bio = "estudante de Letras\n\n  verso livre e  haicai\n"

    r = client.patch("/usuarios/eu", json={"bio": bio}, headers=ana)
    assert r.status_code == 200
    assert r.json()["bio"] == bio
    assert r.json()["name"] == "Ana"
    assert r.json()["poemas"] == 0

    r = client.patch("/usuarios/eu", json={"name": "Ana Lima", "avatar_url": ""}, headers=ana)
    assert r.json()["name"] == "Ana Lima"
    assert r.json()["bio"] == bio
    assert client.get("/usuarios/ana", headers=ana).json()["name"] == "Ana Lima"


def test_editar_perfil_valida_os_campos(client, logar):
    ana = logar("ana")
    for corpo in (
        {"name": ""},
        {"name": "x" * 81},
        {"bio": "x" * 1001},
        {"avatar_url": "x" * 301},
        {"name": None},
        {"bio": None},
    ):
        assert client.patch("/usuarios/eu", json=corpo, headers=ana).status_code == 422, corpo
    # a bio de 1000 caracteres (a dos consagrados) cabe
    assert client.patch("/usuarios/eu", json={"bio": "x" * 1000}, headers=ana).status_code == 200


def test_poemas_do_perfil_como_no_x(client, logar):
    ana = logar("ana")
    bia = logar("bia")
    original = _poema(client, bia, "verso da bia")
    _poema(client, ana, "primeiro da ana")
    client.post(f"/posts/{original}/repostar", headers=ana)
    _poema(client, ana, "citando a bia", repost_de_id=original)
    _poema(client, bia, "outro da bia")

    pagina = client.get("/usuarios/ana/posts", headers=bia).json()
    assert pagina["total"] == 3
    assert [p["texto"] for p in pagina["items"]] == [
        "citando a bia",
        "verso da bia",
        "primeiro da ana",
    ]
    citacao, repost, proprio = pagina["items"]
    # o repost puro aparece como o original, com a ana em "repostado por"
    assert repost["id"] == original
    assert repost["autor"]["username"] == "bia"
    assert [u["username"] for u in repost["repostado_por"]] == ["ana"]
    assert citacao["repost_de"]["id"] == original
    assert citacao["repostado_por"] == []
    assert proprio["repostado_por"] == []


def test_poemas_do_perfil_paginam_por_cursor(client, logar):
    ana = logar("ana")
    for i in range(5):
        _poema(client, ana, f"poema {i}")

    vistos = []
    cursor = None
    while True:
        url = "/usuarios/ana/posts?limit=2" + (f"&cursor={cursor}" if cursor else "")
        pagina = client.get(url, headers=ana).json()
        vistos += [p["texto"] for p in pagina["items"]]
        cursor = pagina["proximo_cursor"]
        if cursor is None:
            break

    assert vistos == [f"poema {i}" for i in reversed(range(5))]
    assert client.get("/usuarios/ana/posts?cursor=lixo", headers=ana).status_code == 422


@pytest.mark.parametrize(
    ("corpo", "mensagem"),
    [
        ({"name": ""}, "o nome é obrigatório e tem até 80 caracteres"),
        ({"name": "x" * 81}, "o nome é obrigatório e tem até 80 caracteres"),
        ({"bio": "x" * 1001}, "a bio tem até 1000 caracteres"),
        ({"avatar_url": "https://exemplo.com/" + "a" * 300}, "a avatar_url tem até 300 caracteres"),
        ({"avatar_url": "exemplo.com/a.png"}, "avatar_url deve ser vazia ou uma URL http(s) válida"),
        ({"name": None}, "o nome não pode ser null"),
        ({"bio": None}, "a bio não pode ser null"),
    ],
)
def test_editar_perfil_explica_o_erro_em_portugues(client, logar, corpo, mensagem):
    ana = logar("ana")
    r = client.patch("/usuarios/eu", json=corpo, headers=ana)
    assert r.status_code == 422
    assert r.json()["detail"][0]["msg"] == mensagem


AVATARES_INVALIDOS = [
    "ftp://exemplo.com/a.png",
    "javascript:alert(1)",
    "exemplo.com/a.png",
    "https://",
    " ",
]


def test_avatar_url_aceita_vazio_ou_http_s_e_guarda_como_veio(client, logar):
    ana = logar("ana")
    for url in ("https://exemplo.com/a.png?tam=200", "http://exemplo.com/a.png", ""):
        r = client.patch("/usuarios/eu", json={"avatar_url": url}, headers=ana)
        assert r.status_code == 200, url
        assert r.json()["avatar_url"] == url


def test_avatar_url_invalida_da_422_no_patch(client, logar):
    ana = logar("ana")
    for url in AVATARES_INVALIDOS:
        r = client.patch("/usuarios/eu", json={"avatar_url": url}, headers=ana)
        assert r.status_code == 422, url
        assert "http(s)" in r.json()["detail"][0]["msg"]


def test_avatar_url_invalida_da_422_no_post_usuarios(client):
    for url in AVATARES_INVALIDOS:
        r = client.post("/usuarios", json={"username": "ana", "name": "Ana", "avatar_url": url})
        assert r.status_code == 422, url
    r = client.post(
        "/usuarios",
        json={"username": "ana", "name": "Ana", "avatar_url": "https://exemplo.com/a.png"},
    )
    assert r.status_code == 201


def test_avatar_url_invalida_recusada_no_json_de_consagrado():
    from app.schemas.consagrado import Consagrado

    poema = {"texto": "um verso", "fonte": "https://pt.wikisource.org/wiki/Poema"}
    dados = {"username": "poeta_teste", "name": "Poeta", "morte": 1914, "poemas": [poema]}
    assert Consagrado.model_validate({**dados, "avatar_url": ""}).avatar_url == ""
    with pytest.raises(ValidationError, match="http"):
        Consagrado.model_validate({**dados, "avatar_url": "javascript:alert(1)"})
