"""core/marcas.py: negrito, itálico, sublinhado e tachado dentro do texto do poema.

Os casos de `casos_marcas.json` são os mesmos de frontend/tests/marcas.test.mjs:
o front e o back leem o formato do mesmo jeito.
"""

import json
from pathlib import Path

import pytest

from app.core.marcas import (
    ITALICO,
    NEGRITO,
    SUBLINHADO,
    TACHADO,
    analisar_linha,
    escapar,
    escrever_linha,
    marcas_quebradas,
    sem_marcas_quebradas,
    tem_marcas,
    texto_sem_marcas,
)

CASOS = json.loads((Path(__file__).parent / "casos_marcas.json").read_text(encoding="utf-8"))


def _linhas(texto: str):
    return [[[t, sorted(m)] for t, m in analisar_linha(linha)] for linha in texto.split("\n")]


def _escrever(texto: str) -> str:
    return "\n".join(escrever_linha(analisar_linha(linha)) for linha in texto.split("\n"))


@pytest.mark.parametrize("caso", CASOS, ids=[c["texto"][:30] for c in CASOS])
def test_casos_compartilhados_com_o_front(caso):
    assert _linhas(caso["texto"]) == caso["linhas"]
    assert texto_sem_marcas(caso["texto"]) == caso["sem_marcas"]


@pytest.mark.parametrize("caso", CASOS, ids=[c["texto"][:30] for c in CASOS])
def test_ida_e_volta_identica(caso):
    assert _escrever(caso["texto"]) == caso["texto"]


def test_mesmo_numero_de_linhas_sem_strip():
    texto = "  **um**\n\n\t*dois*  \n"
    assert texto_sem_marcas(texto) == "  um\n\n\tdois  \n"
    assert texto_sem_marcas(texto).count("\n") == texto.count("\n")


def test_marca_nunca_atravessa_a_linha():
    assert _linhas("**começa\nacaba**") == [[["**começa", []]], [["acaba**", []]]]


def test_asterisco_literal_e_escapado_quando_precisa():
    # Um "*" escrito no editor ao lado de um itálico precisa de escape para não virar marca.
    segmentos = [("a", frozenset({ITALICO})), ("*b*", frozenset())]
    salvo = escrever_linha(segmentos)
    assert salvo == "*a*\\*b\\*"
    assert analisar_linha(salvo) == segmentos


def test_espaco_nas_pontas_sai_da_marca():
    salvo = escrever_linha([(" palavra ", frozenset({NEGRITO}))])
    assert salvo == " **palavra** "
    assert escrever_linha([("   ", frozenset({SUBLINHADO}))]) == "   "


def test_varias_marcas_e_trocas_no_meio():
    segmentos = [
        ("a", frozenset({NEGRITO, TACHADO})),
        ("b", frozenset({ITALICO})),
        ("c", frozenset({ITALICO, SUBLINHADO})),
    ]
    assert analisar_linha(escrever_linha(segmentos)) == segmentos


def test_escapar_texto_puro():
    assert escapar("**não é negrito**\n2 * 3") == "\\*\\*não é negrito\\*\\*\n2 * 3"
    assert texto_sem_marcas(escapar("**não é negrito**")) == "**não é negrito**"


def test_marcas_quebradas_e_limpeza():
    assert not marcas_quebradas("**ok** e nota de rodapé*")
    assert marcas_quebradas("**não fecha\ne ~~nem este")
    assert tem_marcas("um **dois**") and not tem_marcas("* * *")
    limpo = sem_marcas_quebradas("**não fecha** ~~solto\n*a*b*")
    assert not tem_marcas(limpo)
    assert texto_sem_marcas(limpo) == "não fecha solto\nab*"


def test_escape_desnecessario_sai():
    # "2*3" já é literal sem a barra: o editor salva sem ela, e o leitor vê o mesmo.
    assert _escrever("2\\*3") == "2*3"
    assert texto_sem_marcas("2\\*3") == texto_sem_marcas("2*3") == "2*3"


def test_aleatorio_editor_para_texto_e_de_volta():
    """Qualquer conteúdo do editor volta igual (sem espaço nas pontas das marcas)."""
    import random

    from app.core.marcas import _sem_marca_nas_pontas

    sorteio = random.Random(137)
    marcas = [NEGRITO, ITALICO, SUBLINHADO, TACHADO]
    for _ in range(3000):
        segmentos = [
            (
                "".join(sorteio.choice("ab *+~\\\t") for _ in range(sorteio.randint(1, 4))),
                frozenset(m for m in marcas if sorteio.random() < 0.4),
            )
            for _ in range(sorteio.randint(1, 5))
        ]
        salvo = escrever_linha(segmentos)
        assert analisar_linha(salvo) == _sem_marca_nas_pontas(segmentos), (segmentos, salvo)


def test_aleatorio_texto_qualquer_e_estavel():
    """Texto digitado à mão: reescrever não muda o que o leitor vê nem as marcas."""
    import random

    sorteio = random.Random(27)
    for _ in range(3000):
        linha = "".join(sorteio.choice("ab *+~\\") for _ in range(sorteio.randint(0, 12)))
        reescrita = escrever_linha(analisar_linha(linha))
        assert analisar_linha(reescrita) == analisar_linha(linha), (linha, reescrita)
