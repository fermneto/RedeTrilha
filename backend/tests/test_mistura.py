"""core/mistura.py sem servidor: rarear consagrados e misturar."""

from datetime import UTC, datetime, timedelta

from app.core.mistura import Atividade, misturar, rarear_consagrados

BASE = datetime(2026, 11, 20, tzinfo=UTC)
TRES_HORAS = 3 * 3600


def _poema(
    id_: int, minutos: int, consagrado: bool = False, em_portugues: bool = False
) -> Atividade:
    data = BASE + timedelta(minutes=minutos)
    return Atividade("poema", "publicou", id_, id_, 1, data, consagrado, em_portugues)


def test_rarear_deixa_um_consagrado_por_janela_e_todos_os_outros():
    atividades = [
        _poema(1, 0, True),
        _poema(2, 30, True),
        _poema(3, 200, True),
        _poema(4, 10),
        _poema(5, 20),
    ]
    assert [a.origem_id for a in rarear_consagrados(atividades, TRES_HORAS)] == [2, 3, 4, 5]


def test_rarear_prefere_o_mais_recente_em_portugues_da_janela():
    atividades = [
        _poema(1, 0, True, em_portugues=True),
        _poema(2, 30, True, em_portugues=True),
        _poema(3, 50, True),
        _poema(4, 200, True),
        _poema(5, 230, True, em_portugues=True),
        _poema(6, 250, True),
    ]
    assert [a.origem_id for a in rarear_consagrados(atividades, TRES_HORAS)] == [2, 5]


def test_rarear_sem_portugues_na_janela_fica_o_mais_recente():
    atividades = [_poema(1, 0, True), _poema(2, 30, True), _poema(3, 200, True, em_portugues=True)]
    assert [a.origem_id for a in rarear_consagrados(atividades, TRES_HORAS)] == [2, 3]


def test_misturar_deduplica_na_atividade_mais_recente_com_o_rotulo():
    atividades = [
        _poema(1, 0),
        Atividade("poema", "comentou", 7, 1, 2, BASE + timedelta(minutes=5)),
        Atividade("poema", "criticou", 8, 1, 3, BASE + timedelta(minutes=9)),
        Atividade("poema", "comentou", 9, 1, 2, BASE + timedelta(minutes=8)),
        _poema(2, 7),
    ]
    itens = misturar(atividades)
    assert [(i.atividade.alvo_id, i.atividade.acao, i.por) for i in itens] == [
        (1, "criticou", [3, 2]),
        (2, "publicou", []),
    ]


def test_mesma_data_desempata_pela_chave():
    itens = misturar(
        [
            Atividade("poema", "publicou", 1, 1, 1, BASE),
            Atividade("renga", "abriu", 1, 1, 1, BASE),
            Atividade("poema", "comentou", 1, 5, 1, BASE),
        ]
    )
    assert [(i.atividade.tipo, i.atividade.alvo_id) for i in itens] == [
        ("poema", 1),
        ("renga", 1),
        ("poema", 5),
    ]



def test_repost_sobe_o_poema_com_todos_que_repostaram():
    itens = misturar(
        [
            _poema(1, 0),
            Atividade("poema", "repostou", 5, 1, 7, BASE + timedelta(minutes=3)),
            Atividade("poema", "repostou", 6, 1, 8, BASE + timedelta(minutes=4)),
        ]
    )
    assert [(i.atividade.acao, i.por) for i in itens] == [("repostou", [8, 7])]


def test_repost_de_consagrado_nao_e_rareado():
    atividades = [
        _poema(1, 0, True),
        _poema(2, 10, True),
        Atividade("poema", "repostou", 3, 1, 7, BASE + timedelta(minutes=20)),
    ]
    assert [a.origem_id for a in rarear_consagrados(atividades, TRES_HORAS)] == [2, 3]
