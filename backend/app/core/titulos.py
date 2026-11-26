"""O título de um poema consagrado sem o caminho do Wikisource, em Python puro.

O scraper guardou como título o nome da página do Wikisource, que traz o
caminho até o poema e, às vezes, o nome do autor para desambiguar:

- "Eu (Augusto dos Anjos, 1912)/Vozes de um Tumulo": livro (autor, ano)/poema;
- "Leaves of Grass (1882)/Calamus/Poem": livro/seção/poema;
- "O Mar (Augusto dos Anjos)" e "Der Kampf (Friedrich Schiller)": poema (autor);
- "Vida (Álvares de Azevedo) — E as páginas do amor": poema (autor) — parte.

`normalizar_titulo` devolve só o nome do poema (o último trecho do caminho,
sem o autor entre parênteses) e a obra e o ano que o caminho trazia,
para quem não os tem preenchidos. O importador (`scripts/importar_consagrados.py`)
e o conserto dos bancos já importados (`scripts/corrigir_titulos_consagrados.py`)
usam a mesma função, então os dois chegam ao mesmo (titulo, obra, ano).

Os parênteses que não são o autor ficam: "(estrofes iniciais)", "(2)",
"(Gedicht, frühe Fassung)" distinguem poemas diferentes. Uma barra dentro de
parênteses, como em "The Faerie Queene (1590/1596)", não separa o caminho.
"""

import re
import unicodedata
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

# "(1912)", "(Augusto dos Anjos, 1912)" ou "(Goethe 1827)": o ano é o do livro (ou da
# edição). Quem vem antes do ano tem de ser o autor: "(éd. 1874)" não dá ano.
_ANO_NO_PARENTESE = re.compile(r"^(?:(?P<quem>[^()]*?)[,\s]\s*)?(?P<ano>\d{4})$")
_PARENTESE = re.compile(r"\s*\((?P<dentro>[^()]*)\)")
_PARENTESE_NO_FIM = re.compile(r"^(?P<antes>.*\S)\s*\((?P<dentro>[^()]*)\)$")


@dataclass(frozen=True)
class TituloNormalizado:
    titulo: str | None
    # A obra e o ano que o caminho trazia (None se não trazia).
    obra: str | None = None
    ano: int | None = None
    # O trecho do caminho logo antes do poema, quando há um entre ele e o livro
    # ("Liber II" em "Carmina (Horatius)/Liber II/Carmen I").
    secao: str | None = None


@dataclass(frozen=True)
class Poema:
    """O que identifica o poema na importação, além do autor."""

    titulo: str | None
    obra: str | None
    ano: int | None


def _sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c)).casefold().strip()


def _trechos_do_caminho(titulo: str) -> list[str]:
    """Separa nas barras que não estão dentro de parênteses."""
    trechos, atual, profundidade = [], [], 0
    for c in titulo:
        if c == "(":
            profundidade += 1
        elif c == ")":
            profundidade = max(profundidade - 1, 0)
        if c == "/" and profundidade == 0:
            trechos.append("".join(atual))
            atual = []
        else:
            atual.append(c)
    trechos.append("".join(atual))
    return [t.strip() for t in trechos]


def _e_o_autor(quem: str, autor: str) -> bool:
    """O nome do autor, o último nome ("Valéry" para "Paul Valéry") ou o nome com outro
    do meio ("Luís Vaz de Camões" para "Luís de Camões"): mesmo primeiro e último nome."""
    quem, autor = _sem_acento(quem).split(), _sem_acento(autor).split()
    if not quem or not autor:
        return False
    return quem == autor or quem == autor[-1:] or (quem[0], quem[-1]) == (autor[0], autor[-1])


def _livro(trecho: str, autor: str) -> tuple[str, int | None]:
    """'Eu (Augusto dos Anjos, 1912)' → ('Eu', 1912); 'Rime (Dante)' → ('Rime', None).

    O ano entra sozinho ou junto do autor; '(éd. 1874)' não dá ano."""
    achou = _PARENTESE_NO_FIM.match(trecho)
    if not achou:
        return trecho, None
    ano = _ANO_NO_PARENTESE.match(achou["dentro"].strip())
    if not ano or (ano["quem"] is not None and not _e_o_autor(ano["quem"], autor)):
        return achou["antes"], None
    return achou["antes"], int(ano["ano"])


def _sem_autor(titulo: str, autor: str) -> tuple[str, int | None]:
    """Tira os parênteses que são o autor, onde estiverem no nome do poema.

    'O Mar (Augusto dos Anjos)' → ('O Mar', None); 'Vida (Álvares de Azevedo) — E as
    páginas' → ('Vida — E as páginas', None); '(Machado de Assis, 1864)' leva o ano.
    """
    ano_do_autor = None

    def trocar(achou: re.Match) -> str:
        nonlocal ano_do_autor
        dentro = achou["dentro"].strip()
        ano = _ANO_NO_PARENTESE.match(dentro)
        quem = ano["quem"] if ano else dentro
        if quem is None or not _e_o_autor(quem, autor):
            return achou[0]
        if ano:
            ano_do_autor = int(ano["ano"])
        return ""

    sem = _PARENTESE.sub(trocar, titulo).strip()
    return (sem, ano_do_autor) if sem else (titulo, None)


def normalizar_titulo(titulo: str | None, autor: str) -> TituloNormalizado:
    """O nome do poema sem o caminho do Wikisource, e a obra e o ano do caminho.

    `autor` é o nome do consagrado (`name`). Um título sem caminho nem autor entre
    parênteses volta igual. A obra é o primeiro trecho do caminho (o livro), sem o
    parêntese; o ano é o do parêntese do livro ou, sem ele, o do autor
    ("(Machado de Assis, 1864)").
    """
    if titulo is None:
        return TituloNormalizado(None)
    trechos = _trechos_do_caminho(titulo)
    obra = ano_do_livro = secao = None
    if len(trechos) > 1 and trechos[-1]:
        obra, ano_do_livro = _livro(trechos[0], autor)
        poema = trechos[-1]
        secao = trechos[-2] if len(trechos) > 2 else None
    else:
        poema = titulo
    poema, ano_do_autor = _sem_autor(poema, autor)
    return TituloNormalizado(poema, obra or None, ano_do_livro or ano_do_autor, secao or None)


def _aplicar(poema: Poema, normalizado: TituloNormalizado, titulo: str | None) -> Poema:
    """O poema com o título novo; obra e ano do caminho só onde estavam vazios.

    O ano do caminho é o do livro do caminho: só entra se a obra do poema é esse livro.
    """
    obra = poema.obra or normalizado.obra
    ano = poema.ano
    if ano is None and normalizado.ano and (normalizado.obra is None or obra == normalizado.obra):
        ano = normalizado.ano
    return Poema(titulo, obra, ano)


def normalizar_poemas(poemas: Sequence[Poema], autor: str) -> list[Poema]:
    """Os poemas de um autor com o título normalizado, na mesma ordem.

    (titulo, obra) continua único entre eles, porque é a chave da importação:
    quando dois poemas chegariam à mesma chave ("Carmen I" nos quatro livros
    das Odes de Horácio), cada um leva a seção entre parênteses ("Carmen I
    (Liber II)"); o que nem assim fica único volta ao título original. Um
    título original não se repete (o schema garante), e nenhum título
    normalizado tem barra ou o autor entre parênteses, então os originais
    não colidem com os novos.
    """
    normalizados = [normalizar_titulo(p.titulo, autor) for p in poemas]
    finais = [_aplicar(p, n, n.titulo) for p, n in zip(poemas, normalizados, strict=True)]
    for tentativa in ("secao", "original"):
        chaves = Counter((p.titulo, p.obra) for p in finais)
        for i, (poema, normalizado) in enumerate(zip(poemas, normalizados, strict=True)):
            if chaves[(finais[i].titulo, finais[i].obra)] < 2 or finais[i].titulo == poema.titulo:
                continue
            if tentativa == "secao" and normalizado.secao:
                titulo = f"{normalizado.titulo} ({normalizado.secao})"
                finais[i] = _aplicar(poema, normalizado, titulo)
            elif tentativa == "original":
                finais[i] = poema
    return finais
