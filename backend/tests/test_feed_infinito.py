"""O feed infinito, como no X: o Seguindo e o "Para você" nunca têm última folha.

Depois do inédito, a continuação mistura consagrados que a sessão não viu (os das
preferências primeiro) com os mais curtidos da comunidade, que podem repetir."""

from datetime import UTC, datetime, timedelta

from app.core.continuacao import PASSO, Consagrado, Estado, prioridade, proximos
from app.db import SessionLocal
from app.models.atributos_consagrado import AtributosConsagrado
from app.models.post import Post
from app.models.user import User

BASE = datetime(2026, 11, 20, tzinfo=UTC)
DIA = datetime(2026, 11, 20)


# ---- core/continuacao.py ----


def _fila(*ids_e_prioridades: tuple[int, int]) -> list[Consagrado]:
    return [Consagrado(i, DIA + timedelta(minutes=i), p) for i, p in ids_e_prioridades]


def test_prioridade_soma_forma_e_escolas():
    assert prioridade("soneto", ["barroco"], {"soneto"}, {"barroco"}) == 2
    assert prioridade("soneto", ["romantismo"], {"soneto"}, {"barroco"}) == 1
    assert prioridade(None, ["barroco"], set(), {"barroco"}) == 1
    assert prioridade(None, [], {"soneto"}, {"barroco"}) == 0


def test_intercala_um_curtido_a_cada_passo():
    consagrados = _fila(*((i, 0) for i in range(1, 20)))
    saida, _ = proximos(consagrados, [100, 101], set(), Estado(), 2 * PASSO)
    fontes = [fonte for fonte, _ in saida]
    assert fontes == (["consagrado"] * (PASSO - 1) + ["curtido"]) * 2
    assert [i for f, i in saida if f == "curtido"] == [100, 101]


def test_preferencias_primeiro_depois_os_mais_recentes_sem_os_vistos():
    consagrados = _fila((1, 0), (2, 2), (3, 1), (4, 2), (5, 0))
    saida, _ = proximos(consagrados, [], {4}, Estado(), 10)
    assert saida == [("consagrado", i) for i in (2, 3, 5, 1)]


def test_a_fila_anda_pelo_estado_e_os_curtidos_dao_a_volta():
    consagrados = _fila((1, 0), (2, 0), (3, 0))
    primeira, estado = proximos(consagrados, [9], set(), Estado(), 3)
    segunda, estado = proximos(consagrados, [9], set(), estado, 4)
    assert [i for _, i in primeira] == [3, 2, 1]
    # Os consagrados acabaram: os mais curtidos ocupam todas as vezes, repetindo.
    assert segunda == [("curtido", 9)] * 4
    assert (estado.entregues, estado.curtidos) == (7, 4)


def test_so_acaba_sem_nenhuma_das_fontes():
    assert proximos([], [], set(), Estado(), 5) == ([], Estado())


# ---- as rotas ----


def _poema(client, como, autor: str, texto: str) -> int:
    r = client.post("/posts", json={"texto": texto}, headers=como(autor))
    assert r.status_code == 201
    return r.json()["id"]


def _consagrado(username: str, escolas: list[str] | None = None) -> int:
    with SessionLocal() as db:
        user = User(username=username, name=username.title(), consagrado=True)
        db.add(user)
        db.flush()
        if escolas:
            db.add(AtributosConsagrado(user_id=user.id, escolas=escolas))
        db.commit()
        return user.id


def _poemas_de_consagrado(autor_id: int, quantos: int, forma: str | None = None) -> list[int]:
    """Poemas de hora em hora, para cada um cair numa janela de 3 h diferente só às vezes."""
    with SessionLocal() as db:
        posts = [
            Post(
                autor_id=autor_id,
                texto=f"{autor_id}-{i}\nverso",
                forma=forma,
                created_at=BASE - timedelta(hours=i),
            )
            for i in range(quantos)
        ]
        db.add_all(posts)
        db.commit()
        return [p.id for p in posts]


def _get(client, como, rota: str, cursor: str | None = None, limit: int = 5) -> dict:
    params = {"limit": limit, **({"cursor": cursor} if cursor else {})}
    r = client.get(rota, params=params, headers=como("ana"))
    assert r.status_code == 200, r.text
    return r.json()


def _ler(client, como, rota: str, paginas: int, limit: int = 5) -> list[dict]:
    """`paginas` páginas seguidas, conferindo que o cursor nunca vem None."""
    itens, cursor = [], None
    for _ in range(paginas):
        corpo = _get(client, como, rota, cursor, limit)
        itens += corpo["items"]
        cursor = corpo["proximo_cursor"]
        assert cursor is not None
    return itens


def _chave(item: dict) -> tuple[str, int]:
    return ("renga", item["renga"]["id"]) if item["tipo"] == "renga" else ("poema", item["id"])


def test_para_voce_nunca_devolve_cursor_nulo_com_o_banco_populado(client, como):
    _poemas_de_consagrado(_consagrado("bilac"), 12)
    _poema(client, como, "bia", "da bia")
    _poema(client, como, "caio", "do caio")

    # Muito além do que a rede tem: 2 poemas da comunidade e 12 consagrados.
    itens = _ler(client, como, "/feed/para-voce", paginas=8)

    assert len(itens) == 40
    curtidos = [i for i in itens if i.get("subiu_por") == "curtidas"]
    assert curtidos and {i["texto"] for i in curtidos} <= {"da bia", "do caio"}


def test_sem_repetidos_fora_dos_mais_curtidos(client, como):
    consagrados = set(_poemas_de_consagrado(_consagrado("bilac"), 15))
    for i in range(3):
        _poema(client, como, "bia", f"bia {i}")

    itens = _ler(client, como, "/feed/para-voce", paginas=10, limit=3)

    unicos = [_chave(i) for i in itens if i.get("subiu_por") != "curtidas"]
    assert len(unicos) == len(set(unicos))
    # Todos os consagrados saem, no inédito (rareados) ou na continuação, uma vez só.
    assert consagrados <= {id_ for _, id_ in unicos}


def test_continuacao_traz_primeiro_as_formas_e_escolas_preferidas(client, como):
    sonetos = _poemas_de_consagrado(_consagrado("camoes", ["renascimento_classicismo"]), 3, "soneto")
    outros = _poemas_de_consagrado(_consagrado("bilac"), 3)
    r = client.put(
        "/preferencias",
        json={"formas": ["soneto"], "escolas": ["renascimento_classicismo"]},
        headers=como("ana"),
    )
    assert r.status_code == 200, r.text

    # Por offset, a página para na virada; o cursor já é o da continuação.
    primeira = _get(client, como, "/feed/para-voce", limit=20)
    assert primeira["fim_em"] == len(primeira["items"])
    inedito = {_chave(i) for i in primeira["items"]}
    segunda = _get(client, como, "/feed/para-voce", primeira["proximo_cursor"], limit=20)
    continuacao = [i["id"] for i in segunda["items"] if i.get("subiu_por") != "curtidas"]

    esperados = [i for i in sonetos if ("poema", i) not in inedito]
    assert continuacao[: len(esperados)] == esperados
    assert set(continuacao) == {i for i in sonetos + outros if ("poema", i) not in inedito}


def test_seguindo_continua_com_o_para_voce_depois_do_fim(client, como):
    client.post("/usuarios/bia/follow", headers=como("ana"))
    da_bia = [_poema(client, como, "bia", f"bia {i}") for i in range(2)]
    do_caio = _poema(client, como, "caio", "do caio, que ana não segue")
    _poemas_de_consagrado(_consagrado("bilac"), 4)

    primeira = _get(client, como, "/feed", limit=1)
    segunda = _get(client, como, "/feed", primeira["proximo_cursor"], limit=5)

    # A página da virada: o último da bia, e dali em diante o "Para você".
    assert (primeira["fim_em"], segunda["fim_em"]) == (None, 1)
    assert segunda["items"][0]["id"] == da_bia[0]
    depois = [_chave(i) for i in segunda["items"][1:]]
    assert depois[0] == ("poema", do_caio)
    # O que a sessão já viu no Seguindo não volta no "Para você".
    assert ("poema", da_bia[1]) not in depois and ("poema", da_bia[0]) not in depois
    # E o feed segue, já na continuação, sem fim.
    _ler(client, como, "/feed", paginas=4)


def test_seguindo_por_offset_para_na_virada_com_o_cursor_do_para_voce(client, como):
    client.post("/usuarios/bia/follow", headers=como("ana"))
    _poema(client, como, "bia", "bia 0")
    do_caio = _poema(client, como, "caio", "do caio")

    primeira = _get(client, como, "/feed", limit=10)
    assert ([i["texto"] for i in primeira["items"]], primeira["fim_em"]) == (["bia 0"], 1)
    segunda = _get(client, como, "/feed", primeira["proximo_cursor"], limit=10)
    assert segunda["fim_em"] is None
    assert _chave(segunda["items"][0]) == ("poema", do_caio)


def test_banco_vazio_acaba(client, como):
    primeira = _get(client, como, "/feed/para-voce")
    assert (primeira["items"], primeira["fim_em"]) == ([], 0)
    segunda = _get(client, como, "/feed/para-voce", primeira["proximo_cursor"])
    assert (segunda["items"], segunda["proximo_cursor"]) == ([], None)


def test_perfil_continua_finito(client, como):
    _poema(client, como, "ana", "meu")
    r = client.get("/usuarios/ana/posts", headers=como("ana")).json()
    assert (r["proximo_cursor"], r["fim_em"]) == (None, None)


def test_cursor_da_continuacao_no_perfil_da_422(client, como):
    _poema(client, como, "bia", "da bia")
    cursor = _get(client, como, "/feed/para-voce", limit=5)["proximo_cursor"]
    r = client.get("/usuarios/ana/posts", params={"cursor": cursor}, headers=como("ana"))
    assert r.status_code == 422
