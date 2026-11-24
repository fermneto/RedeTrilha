"""core/pontuacao_sugestoes.py sem servidor: cada peso muda a ordem como esperado."""

from datetime import UTC, datetime, timedelta

from app.core import pontuacao_sugestoes as p
from app.core.pontuacao_sugestoes import Perfil, nota, ordenar

BASE = datetime(2026, 11, 20, tzinfo=UTC)
EU = Perfil(
    id=99,
    escolas=frozenset({"romantismo"}),
    formas=frozenset({"soneto"}),
    lingua="pt",
    pais="BR",
    uf="PB",
)


def _ids(contas: list[Perfil]) -> list[int]:
    return [c.id for c in ordenar(contas, EU)]


def test_sem_nada_em_comum_desempata_pelo_poema_mais_recente_e_pelo_id():
    a = Perfil(id=1, ultimo_poema=BASE)
    b = Perfil(id=2, ultimo_poema=BASE + timedelta(hours=1))
    c = Perfil(id=3)
    d = Perfil(id=4)
    assert _ids([a, b, c, d]) == [2, 1, 4, 3]


def test_seguidores_pesam_mas_com_log():
    assert _ids([Perfil(id=1, seguidores=1), Perfil(id=2, seguidores=50)]) == [2, 1]
    # 30 seguidores (log ≈ 3,4) perdem para uma escola e uma forma em comum (2 × PESO_GOSTO = 4).
    famoso = Perfil(id=1, seguidores=30)
    afinado = Perfil(id=2, escolas=frozenset({"romantismo"}), formas=frozenset({"soneto"}))
    assert _ids([famoso, afinado]) == [2, 1]


def test_gosto_conta_escolas_e_formas_em_comum():
    uma = Perfil(id=1, escolas=frozenset({"romantismo", "barroco"}))
    duas = Perfil(id=2, escolas=frozenset({"romantismo"}), formas=frozenset({"soneto"}))
    nenhuma = Perfil(id=3, escolas=frozenset({"barroco"}))
    assert _ids([uma, duas, nenhuma]) == [2, 1, 3]
    assert nota(duas, EU) == 2 * p.PESO_GOSTO


def test_mesma_lingua_sobe():
    assert _ids([Perfil(id=1, lingua="en"), Perfil(id=2, lingua="pt"), Perfil(id=3)]) == [2, 3, 1]
    assert nota(Perfil(lingua="pt"), EU) == p.PESO_LINGUA


def test_mesmo_estado_vale_mais_que_so_o_pais():
    estado = Perfil(id=1, pais="BR", uf="PB")
    pais = Perfil(id=2, pais="BR", uf="SP")
    fora = Perfil(id=3, pais="PT")
    assert _ids([fora, pais, estado]) == [1, 2, 3]
    assert nota(estado, EU) == p.PESO_PAIS + p.PESO_UF
    assert nota(pais, EU) == p.PESO_PAIS
    # Estado igual sem o mesmo país não conta.
    assert nota(Perfil(pais="PT", uf="PB"), EU) == 0


def test_trocar_um_peso_muda_a_ordem(monkeypatch):
    seguida = Perfil(id=1, seguidores=1000)
    vizinha = Perfil(id=2, pais="BR", uf="PB")
    assert _ids([seguida, vizinha]) == [1, 2]
    monkeypatch.setattr(p, "PESO_UF", 10.0)
    assert _ids([seguida, vizinha]) == [2, 1]
