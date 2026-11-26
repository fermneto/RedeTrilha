"""core/duplicados.py: o mesmo poema duas vezes no acervo de um consagrado."""

from app.core.duplicados import grupos_de_duplicados, mesmo_poema, normalizar

INTEIRO = (
    "Minha terra tem palmeiras,\nOnde canta o Sabiá;\n"
    "As aves, que aqui gorjeiam,\nNão gorjeiam como lá.\n\n"
    "Nosso céu tem mais estrelas,\nNossas várzeas têm mais flores,\n"
    "Nossos bosques têm mais vida,\nNossa vida mais amores."
)
TRECHO = "Nosso céu tem mais estrelas,\nNossas várzeas têm mais flores,"
# Como nas edições antigas: "ceo", "aonde" e "estrellas".
GRAFIA_ANTIGA = INTEIRO.replace("céu", "ceo").replace("Onde", "Aonde").replace("estrelas", "estrellas")
OUTRO = "No meio do caminho tinha uma pedra\ntinha uma pedra no meio do caminho"


def _resumo(poemas):
    return [(g.mantido, g.removidos) for g in grupos_de_duplicados(list(enumerate(poemas)))]


def test_normalizar_tira_marcas_acentos_e_pontuacao():
    assert normalizar("**Allucinação!**\n  ó  Céu,") == "allucinacao o ceu"


def test_trecho_sai_e_fica_o_inteiro_mesmo_vindo_antes():
    assert _resumo([TRECHO, OUTRO, INTEIRO]) == [(2, [0])]


def test_o_mesmo_texto_em_outra_grafia_e_repetido():
    assert mesmo_poema(normalizar(GRAFIA_ANTIGA), normalizar(INTEIRO))
    # Iguais no tamanho normalizado e no bruto: fica o que veio primeiro.
    assert _resumo([INTEIRO, INTEIRO]) == [(0, [1])]


def test_poema_reescrito_nao_e_repetido():
    variante = INTEIRO.replace("estrelas", "luzeiros").replace("flores", "rosas").replace(
        "palmeiras", "coqueiros"
    ).replace("gorjeiam", "trinam").replace("amores", "fervores").replace("vida", "seiva")
    assert _resumo([INTEIRO, variante]) == []


def test_poemas_diferentes_nao_se_juntam():
    assert _resumo([INTEIRO, OUTRO, "um verso só"]) == []


def test_trecho_que_cabe_em_dois_poemas_vai_para_o_mais_completo():
    """Os dois poemas que contêm o trecho continuam separados."""
    maior = INTEIRO + "\n\n" + "\n".join(f"estrofe nova numero {i} de muitas" for i in range(9))
    outro_com_o_trecho = OUTRO + "\n" + TRECHO
    grupos = _resumo([outro_com_o_trecho, TRECHO, maior])
    assert grupos == [(2, [1])]


def test_cadeia_de_trechos_vai_para_a_raiz():
    primeira = INTEIRO.split("\n\n")[0]
    verso = primeira.split("\n")[0] + "\n" + primeira.split("\n")[1]
    assert _resumo([verso, primeira, INTEIRO]) == [(2, [0, 1])]


def test_lista_vazia_e_poema_vazio():
    assert _resumo([]) == []
    assert _resumo(["", INTEIRO]) == []
