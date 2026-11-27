"""Sílabas poéticas e rimas (core/metrica.py) com versos de domínio público.

Camões (1580), Gonçalves Dias (1864), Bilac (1918), Augusto dos Anjos (1914),
Castro Alves (1871) e Garrett (1854). Os xfail são os limites conhecidos da
heurística, explicados em cada caso.
"""

import pytest

from app.core.metrica import analisar, aviso_de_forma

AMOR_E_FOGO = """Amor é fogo que arde sem se ver;
É ferida que dói, e não se sente;
É um contentamento descontente;
É dor que desatina sem doer.

É um não querer mais que bem querer;
É solitário andar por entre a gente;
É nunca contentar-se de contente;
É cuidar que se ganha em se perder.

É querer estar preso por vontade;
É servir a quem vence, o vencedor;
É ter com quem nos mata lealdade.

Mas como causar pode seu favor
Nos corações humanos amizade,
Se tão contrário a si é o mesmo Amor?"""

CANCAO_DO_EXILIO = """Minha terra tem palmeiras,
Onde canta o Sabiá;
As aves, que aqui gorjeiam,
Não gorjeiam como lá.

Nosso céu tem mais estrelas,
Nossas várzeas têm mais flores,
Nossos bosques têm mais vida,
Nossa vida mais amores."""

DECASSILABOS = [
    # Camões: hiato depois de vogal tônica ("dói, e", "É um") e sinalefa com "que arde".
    *AMOR_E_FOGO.replace("\n\n", "\n").split("\n"),
    "Alma minha gentil, que te partiste",
    "Tão cedo desta vida descontente,",
    "Repousa lá no Céu eternamente,",
    "E viva eu cá na terra sempre triste.",
    "As armas e os barões assinalados",
    "Que da ocidental praia Lusitana",
    "Por mares nunca de antes navegados",
    "Cesse tudo o que a Musa antiga canta,",
    "Dai-me uma fúria grande e sonorosa,",
    "Transforma-se o amador na cousa amada",
    "Sete anos de pastor Jacob servia",
    # Bilac: sinalefa tripla ("senso! E eu", "la. E, ao") e sinérese pós-tônica ("Láctea", "pálio").
    "Ora (direis) ouvir estrelas! Certo",
    'Perdeste o senso!" E eu vos direi, no entanto,',
    "Que, para ouvi-las, muita vez desperto",
    "E abro as janelas, pálido de espanto...",
    "E conversamos toda a noite, enquanto",
    "A Via Láctea, como um pálio aberto,",
    "Cintila. E, ao vir o sol, saudoso e em pranto,",
    "Inda as procuro pelo céu deserto.",
    "Última flor do Lácio, inculta e bela,",
    "És, a um tempo, esplendor e sepultura:",
    "Ouro nativo, que na ganga impura",
    "A bruta mina entre os cascalhos vela...",
    # Augusto dos Anjos: "ao" num núcleo, "tua última", enclítico "Acostuma-te".
    "Vês?! Ninguém assistiu ao formidável",
    "Enterro de tua última quimera.",
    "Somente a Ingratidão — esta pantera —",
    "Foi tua companheira inseparável!",
    "Acostuma-te à lama que te espera!",
    "O Homem, que, nesta terra miserável,",
    "Mora, entre feras, sente inevitável",
    "Necessidade de também ser fera.",
    "Eu, filho do carbono e do amoníaco,",
    "Monstro de escuridão e rutilância,",
    "Sofro, desde a epigênesis da infância,",
    # Castro Alves e Garrett.
    "Auriverde pendão de minha terra,",
    "Que a brisa do Brasil beija e balança,",
    "Deus! ó Deus! onde estás que não respondes?",
    "Saudade! gosto amargo de infelizes,",
]

def silabas(verso):
    return analisar(verso)[0][0].silabas


def rimam(a, b):
    """Os dois versos ganham a mesma letra no esquema."""
    return analisar(f"{a}\n{b}")[1] == "AA"


REDONDILHAS_MAIORES = [
    *CANCAO_DO_EXILIO.replace("\n\n", "\n").split("\n"),
    "Em cismar, sozinho, à noite,",
    "Mais prazer encontro eu lá;",
]


@pytest.mark.parametrize("verso", DECASSILABOS)
def test_decassilabos_classicos(verso):
    assert silabas(verso) == 10


@pytest.mark.parametrize("verso", REDONDILHAS_MAIORES)
def test_redondilhas_de_goncalves_dias(verso):
    assert silabas(verso) == 7


@pytest.mark.xfail(
    reason='Camões lê "ain-da" como ditongo; a heurística segue a gramática (a-in-da, hiato antes de n + consoante) e conta 11',
    strict=True,
)
def test_lusiadas_ainda_com_sinerese():
    assert silabas("Passaram ainda além da Taprobana") == 10


@pytest.mark.xfail(
    reason='Augusto dos Anjos lê "in-fluên-cia"; antes da tônica a heurística mantém o hiato (flu-ên) e conta 11',
    strict=True,
)
def test_sinerese_pretonica_de_augusto():
    assert silabas("A influência má dos signos do zodíaco.") == 10


def test_ditongo_hiato_e_q_mudo():
    assert silabas("muito") == 1  # mui-to: conta até a tônica
    assert silabas("saúde") == 2  # sa-ú
    assert silabas("rainha") == 2  # ra-i
    assert silabas("quando") == 1  # o u de "qu" não conta
    assert silabas("coração") == 3


def test_enclitico_depois_do_hifen_nao_leva_a_tonica():
    assert silabas("ouvi-los") == 2


def test_linha_sem_palavras():
    assert silabas("") is None
    assert silabas("* * *") is None
    assert analisar("—")[0][0].rima is None


def test_rima_pelo_som():
    assert rimam("Onde canta o Sabiá;", "Não gorjeiam como lá.")
    assert rimam("nasce", "passe")
    assert rimam("paz", "atrás")
    # O til fica: "lã" não rima com "lá".
    assert not rimam("lã", "lá")


def test_esquema_do_soneto_de_camoes():
    assert analisar(AMOR_E_FOGO)[1] == "ABBA ABBA CDC DCD"


def test_um_verso_por_linha_com_as_linhas_em_branco():
    versos, _ = analisar(AMOR_E_FOGO)
    assert len(versos) == len(AMOR_E_FOGO.split("\n"))
    assert versos[4].silabas is None and versos[4].rima is None
    assert [v.silabas for v in versos if v.silabas is not None] == [10] * 14


def test_rima_toante_so_para_quem_nao_tem_consoante():
    versos, esquema = analisar(CANCAO_DO_EXILIO)
    # palmeiras/gorjeiam/estrelas: mesmas vogais (e...a), consoantes diferentes.
    assert esquema == "ABAB ACDC"
    assert [v.tipo_rima for v in versos[:4]] == ["toante", "consoante", "toante", "consoante"]
    # "vida" não rima com nada.
    assert versos[7].rima == "D" and versos[7].tipo_rima is None


def test_texto_crlf_e_linhas_so_de_espaco():
    versos, esquema = analisar("o mar\r\n   \r\na amar\r\n")
    assert [v.silabas for v in versos] == [2, None, 2, None]
    assert esquema == "A A"


def test_aviso_de_soneto_e_haicai():
    soneto, _ = analisar(AMOR_E_FOGO)
    assert aviso_de_forma("soneto", soneto) is None
    assert aviso_de_forma("soneto", soneto[:4]) == "Um soneto costuma ter 14 versos; este tem 4."
    haicai, _ = analisar("o sol se levanta\nna serra fria de junho\na garça acordada")
    assert [v.silabas for v in haicai] == [5, 7, 5]
    assert aviso_de_forma("haicai", haicai) is None
    curto, _ = analisar("o sol\nna serra\nfria")
    assert aviso_de_forma("haicai", curto) == (
        "Um haicai costuma ter 5, 7 e 5 sílabas poéticas; este tem 2, 2 e 1."
    )
    assert aviso_de_forma("haicai", curto[:2]) == "Um haicai costuma ter 3 versos; este tem 2."


def test_sem_aviso_em_outras_formas_ou_no_poema_vazio():
    versos, _ = analisar("um verso só")
    assert aviso_de_forma("quadra", versos) is None
    assert aviso_de_forma(None, versos) is None
    assert aviso_de_forma("soneto", analisar("")[0]) is None
