"""core/titulos.py: o título do consagrado sem o caminho do Wikisource."""

from app.core.titulos import Poema, TituloNormalizado, normalizar_poemas, normalizar_titulo
from scripts.importar_consagrados import (
    PASTA_CONSAGRADOS,
    ler_consagrados,
    ler_versoes_distintas,
    poemas_a_importar,
)

AUGUSTO = "Augusto dos Anjos"


def test_caminho_do_livro_da_o_livro_e_o_ano():
    assert normalizar_titulo("Eu (Augusto dos Anjos, 1912)/Vozes de um Tumulo", AUGUSTO) == (
        TituloNormalizado("Vozes de um Tumulo", obra="Eu", ano=1912, secao="Eu")
    )


def test_autor_entre_parenteses_sai():
    assert normalizar_titulo("O Mar (Augusto dos Anjos)", AUGUSTO) == TituloNormalizado("O Mar")
    assert normalizar_titulo("Der Kampf (Friedrich Schiller)", "Friedrich Schiller").titulo == (
        "Der Kampf"
    )


def test_autor_pelo_ultimo_nome_por_outro_do_meio_e_no_meio_do_titulo():
    assert normalizar_titulo("Lied (Eichendorff)", "Joseph von Eichendorff").titulo == "Lied"
    leonor = normalizar_titulo("Na fonte está Leonor (Luís Vaz de Camões)", "Luís de Camões")
    assert leonor.titulo == "Na fonte está Leonor"
    vida = "Vida (Álvares de Azevedo) — E as páginas do amor sobre meu peito"
    assert normalizar_titulo(vida, "Álvares de Azevedo").titulo == (
        "Vida — E as páginas do amor sobre meu peito"
    )


def test_ano_junto_do_autor_vai_para_o_ano():
    assert normalizar_titulo("Der Sänger (Goethe 1827)", "Johann Wolfgang von Goethe") == (
        TituloNormalizado("Der Sänger", ano=1827)
    )


def test_secoes_do_meio_saem_e_barra_entre_parenteses_nao_separa():
    calamus = normalizar_titulo("Leaves of Grass (1882)/Calamus/Scented Herbage", "Walt Whitman")
    assert calamus == TituloNormalizado("Scented Herbage", "Leaves of Grass", 1882, "Calamus")
    faerie = normalizar_titulo("The Faerie Queene (1590/1596)/Canto I", "Edmund Spenser")
    assert (faerie.titulo, faerie.obra, faerie.ano) == ("Canto I", "The Faerie Queene", None)


def test_parenteses_que_nao_sao_o_autor_ficam():
    for titulo in ["Boêmios (estrofes iniciais)", "To a Poet (2)", "Ode (1864)", "Rime (Dante)"]:
        assert normalizar_titulo(titulo, "Fulano de Tal") == TituloNormalizado(titulo)
    assert normalizar_titulo(None, AUGUSTO) == TituloNormalizado(None)
    # "éd." não é autor: o ano da edição não vira ano do poema.
    fable = normalizar_titulo("Fables de La Fontaine (éd. 1874)/Le Loup", "La Fontaine")
    assert (fable.obra, fable.ano) == ("Fables de La Fontaine", None)


def test_obra_e_ano_do_poema_ficam():
    [poema] = normalizar_poemas(
        [Poema("Les Fleurs du mal (1861)/Au lecteur", "Les Fleurs du mal", 1857)], "Baudelaire"
    )
    assert poema == Poema("Au lecteur", "Les Fleurs du mal", 1857)


def test_obra_nao_e_preenchida_e_o_ano_do_livro_entra_com_a_obra_vazia():
    morcego = Poema("Eu (Augusto dos Anjos, 1912)/O Morcego", None, None)
    [poema] = normalizar_poemas([morcego], AUGUSTO)
    assert poema == Poema("O Morcego", None, 1912)


def test_ano_do_caminho_so_entra_se_a_obra_e_vazia_ou_o_livro_do_caminho():
    lamartine = "Œuvres complètes de Lamartine (1860)/Tome 1/Le Lac"
    [poema] = normalizar_poemas([Poema(lamartine, "Méditations poétiques", None)], "Lamartine")
    assert poema == Poema("Le Lac", "Méditations poétiques", None)


def test_mesma_chave_leva_a_secao_e_se_nem_assim_volta_ao_original():
    horacio = normalizar_poemas(
        [
            Poema("Carmina (Horatius)/Liber I/Carmen I", "Carmina", None),
            Poema("Carmina (Horatius)/Liber II/Carmen I", "Carmina", None),
            Poema("Carmina (Horatius)/Liber II/Carmen II", "Carmina", None),
        ],
        "Horácio",
    )
    assert [p.titulo for p in horacio] == ["Carmen I (Liber I)", "Carmen I (Liber II)", "Carmen II"]

    eichendorff = normalizar_poemas(
        [Poema("Abendlandschaft", None, None), Poema("Abendlandschaft (Eichendorff)", None, None)],
        "Joseph von Eichendorff",
    )
    assert [p.titulo for p in eichendorff] == ["Abendlandschaft", "Abendlandschaft (Eichendorff)"]

    # A obra não é preenchida: o mesmo título em dois livros do caminho leva o livro.
    sem_obra = normalizar_poemas(
        [
            Poema("Nos maîtres/Stéphane Mallarmé", None, None),
            Poema("Vus du dehors/Stéphane Mallarmé", None, None),
        ],
        "Stéphane Mallarmé",
    )
    assert [p.titulo for p in sem_obra] == [
        "Stéphane Mallarmé (Nos maîtres)",
        "Stéphane Mallarmé (Vus du dehors)",
    ]


def test_jsons_dos_consagrados_ficam_com_chave_unica_e_sem_caminho():
    """Todos os JSONs, como o importador os grava (sem os repetidos): nenhum título
    com barra, e (titulo, obra) único por autor."""
    distintos = ler_versoes_distintas()
    for consagrado in ler_consagrados(PASTA_CONSAGRADOS):
        finais = poemas_a_importar(consagrado, distintos.get(consagrado.username, set()))
        chaves = [(p.titulo, p.obra) for p in finais]
        assert len(set(chaves)) == len(chaves), consagrado.username
        assert not [p.titulo for p in finais if p.titulo and "/" in p.titulo], consagrado.username
