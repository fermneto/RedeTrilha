"""O feed infinito, como no X: o Seguindo e o "Para você" nunca têm última folha.

Depois do inédito, a continuação mistura consagrados que a sessão não viu (os das
preferências primeiro) com os mais curtidos da comunidade, que podem repetir."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.continuacao import PASSO, Candidato, Estado, intercalar
from app.db import SessionLocal
from app.models.atributos_consagrado import AtributosConsagrado
from app.models.post import Post
from app.models.user import User

BASE = datetime(2026, 11, 20, tzinfo=UTC)
DIA = datetime(2026, 11, 20)
# Os únicos itens que podem repetir: os mais curtidos e os consagrados reciclados.
REPETEM = ("curtidas", "releitura")


# ---- core/continuacao.py ----


def _fila(*ids: int, rodada: int = 0) -> list[Candidato]:
    return [Candidato(i, rodada, (0, 0, DIA + timedelta(minutes=i), i)) for i in ids]


def test_intercala_um_curtido_a_cada_passo():
    saida, _ = intercalar(Estado(), 2 * PASSO, _fila(*range(19, 0, -1)), [100, 101])
    fontes = [fonte for fonte, _ in saida]
    assert fontes == (["consagrado"] * (PASSO - 1) + ["curtido"]) * 2
    assert [i for f, i in saida if f == "curtido"] == [100, 101]


def test_o_estado_guarda_a_rodada_e_a_posicao_do_ultimo_consagrado_usado():
    fila = [*_fila(3, 2), *_fila(9, rodada=1)]
    saida, estado = intercalar(Estado(), 3, fila, [])
    assert saida == [("consagrado", 3), ("consagrado", 2), ("releitura", 9)]
    assert (estado.rodada, estado.ultimo_consagrado[3], estado.entregues) == (1, 9, 3)


def test_sem_consagrados_os_curtidos_dao_a_volta():
    saida, estado = intercalar(Estado(entregues=3), 4, [], [9, 8])
    assert saida == [("curtido", 9), ("curtido", 8), ("curtido", 9), ("curtido", 8)]
    assert (estado.entregues, estado.curtidos) == (7, 4)


def test_sem_curtidos_os_consagrados_ocupam_a_vez():
    saida, _ = intercalar(Estado(), PASSO, _fila(4, 3, 2, 1), [])
    assert [i for _, i in saida] == [4, 3, 2, 1]


def test_so_acaba_sem_nenhuma_das_fontes():
    assert intercalar(Estado(), 5, [], []) == ([], Estado())


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


def _poemas_de_consagrado(
    autor_id: int, quantos: int, forma: str | None = None, idioma: str | None = None
) -> list[int]:
    """Poemas de hora em hora, para cada um cair numa janela de 3 h diferente só às vezes."""
    with SessionLocal() as db:
        posts = [
            Post(
                autor_id=autor_id,
                texto=f"{autor_id}-{i}\nverso",
                forma=forma,
                idioma=idioma,
                created_at=BASE - timedelta(hours=i),
            )
            for i in range(quantos)
        ]
        db.add_all(posts)
        db.commit()
        return [p.id for p in posts]


def _get(
    client, como, rota: str, cursor: str | None = None, limit: int = 5, **extra
) -> dict:
    params = {"limit": limit, **extra, **({"cursor": cursor} if cursor else {})}
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

    unicos = [_chave(i) for i in itens if i.get("subiu_por") not in REPETEM]
    assert len(unicos) == len(set(unicos))
    # Todos os consagrados saem, no inédito (rareados) ou na continuação, uma vez
    # só, antes de a fila reciclar ("releitura").
    primeira_releitura = next(n for n, i in enumerate(itens) if i.get("subiu_por") == "releitura")
    assert consagrados <= {i["id"] for i in itens[:primeira_releitura]}


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
    continuacao = [i["id"] for i in segunda["items"] if i.get("subiu_por") not in REPETEM]

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


def _continuacao(client, como, limit: int = 20, **extra) -> list[dict]:
    """A primeira página da continuação do "Para você" (a seguinte à virada)."""
    primeira = _get(client, como, "/feed/para-voce", limit=100, **extra)
    assert primeira["fim_em"] == len(primeira["items"])
    return _get(client, como, "/feed/para-voce", primeira["proximo_cursor"], limit, **extra)["items"]


def _marcar(client, como, *ids: int, tipo: str = "poema") -> None:
    corpo = {"itens": [{"tipo": tipo, "id": i} for i in ids]}
    r = client.post("/feed/vistos", json=corpo, headers=como("ana"))
    assert r.status_code == 204, r.text


# ---- a virada do "Para você" (a folha "você está em dia" do front) ----


def test_para_voce_marca_a_virada_e_enche_a_pagina_com_a_continuacao(client, como):
    _poema(client, como, "bia", "bia 0")
    _poema(client, como, "bia", "bia 1")
    _poemas_de_consagrado(_consagrado("bilac"), 6)

    primeira = _get(client, como, "/feed/para-voce", limit=1)
    corpo = primeira
    while corpo["fim_em"] is None:
        corpo = _get(client, como, "/feed/para-voce", corpo["proximo_cursor"], limit=3)
    # Com cursor, a página da virada continua depois dela, já na continuação.
    assert len(corpo["items"]) == 3 and corpo["fim_em"] < 3
    assert corpo["proximo_cursor"]


def test_para_voce_sem_nada_inedito_vira_na_primeira_folha(client, como):
    ids = _poemas_de_consagrado(_consagrado("bilac"), 2)
    _marcar(client, como, *ids)
    corpo = _get(client, como, "/feed/para-voce")
    assert (corpo["items"], corpo["fim_em"]) == ([], 0)


# ---- a fila recicla os consagrados ----


def test_consagrados_reciclam_em_vez_de_repetir_o_mesmo_poema(client, como):
    consagrados = _poemas_de_consagrado(_consagrado("bilac"), 3)
    _poema(client, como, "bia", "o único da comunidade")

    itens = _ler(client, como, "/feed/para-voce", paginas=8, limit=4)

    # Nunca o mesmo poema em duas folhas seguidas, e o da comunidade só na vez dele.
    ids = [i["id"] for i in itens]
    assert all(a != b for a, b in zip(ids, ids[1:]))
    assert sum(i["texto"] == "o único da comunidade" for i in itens) <= len(itens) // 3
    releituras = [i["id"] for i in itens if i.get("subiu_por") == "releitura"]
    assert releituras and set(releituras) <= set(consagrados)


def test_releitura_volta_ao_topo_da_ordem(client, como):
    consagrados = _poemas_de_consagrado(_consagrado("bilac"), 4)
    _marcar(client, como, *consagrados)

    itens = _continuacao(client, como, limit=6)

    # Tudo já visto: a fila recicla na ordem (o mais recente primeiro) e, no fim,
    # volta ao topo. A 4ª folha é a vez do mais curtido.
    fila = [i["id"] for i in itens if i.get("subiu_por") == "releitura"]
    assert fila == [*consagrados, consagrados[0]]


# ---- a língua de quem lê, 3º critério ----


def test_lingua_de_quem_le_vem_depois_das_preferencias(client, como):
    bilac = _consagrado("bilac")
    em_ingles = _poemas_de_consagrado(bilac, 2, idioma="en")
    em_portugues = _poemas_de_consagrado(bilac, 2, idioma="pt")
    soneto_em_ingles = _poemas_de_consagrado(bilac, 1, forma="soneto", idioma="en")
    client.put("/preferencias", json={"formas": ["soneto"]}, headers=como("ana"))
    _marcar(client, como, *em_ingles, *em_portugues, *soneto_em_ingles)

    # Tudo visto: a releitura mostra a ordem inteira da fila.
    itens = _continuacao(client, como, limit=3, lingua="pt")

    assert [i["id"] for i in itens] == [*soneto_em_ingles, *em_portugues]


# ---- o que a pessoa já viu, entre sessões ----


def test_o_ja_visto_fica_fora_do_inedito_numa_sessao_nova(client, como):
    visto = _poema(client, como, "bia", "já visto")
    novo = _poema(client, como, "bia", "novo")
    _marcar(client, como, visto)

    corpo = _get(client, como, "/feed/para-voce", limit=10)

    assert [i["id"] for i in corpo["items"][: corpo["fim_em"]]] == [novo]


def test_o_ja_visto_fica_fora_dos_consagrados_ineditos(client, como):
    consagrados = _poemas_de_consagrado(_consagrado("bilac"), 30)
    _marcar(client, como, *consagrados[:20])

    itens = _continuacao(client, como, limit=12)

    ineditos = [i["id"] for i in itens if i.get("subiu_por") is None]
    assert ineditos and not set(ineditos) & set(consagrados[:20])


def test_marcar_de_novo_nao_duplica_e_vale_para_renga(client, como):
    _marcar(client, como, 1, 1, 2)
    _marcar(client, como, 1)
    _marcar(client, como, 7, tipo="renga")
    with SessionLocal() as db:
        from app.services.vistos_no_feed import do_usuario

        ana = db.query(User).filter_by(username="ana").one()
        assert do_usuario(db, ana.id) == {("poema", 1), ("poema", 2), ("renga", 7)}


@pytest.mark.parametrize(
    "corpo",
    [
        {"itens": []},
        {"itens": [{"tipo": "conto", "id": 1}]},
        {"itens": [{"tipo": "poema", "id": 0}]},
        {"itens": [{"tipo": "poema", "id": i} for i in range(1, 102)]},
    ],
)
def test_vistos_invalidos_dao_422(client, como, corpo):
    assert client.post("/feed/vistos", json=corpo, headers=como("ana")).status_code == 422


def test_vistos_exigem_login(client):
    assert client.post("/feed/vistos", json={"itens": [{"tipo": "poema", "id": 1}]}).status_code == 401


def test_seguindo_continua_cronologico_com_o_ja_visto(client, como):
    """O trecho de quem a pessoa segue não pula o já visto (lacuna de produto)."""
    client.post("/usuarios/bia/follow", headers=como("ana"))
    visto = _poema(client, como, "bia", "já visto")
    _marcar(client, como, visto)
    corpo = _get(client, como, "/feed", limit=10)
    assert corpo["items"][0]["id"] == visto
