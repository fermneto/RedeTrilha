"""Negrito, itálico, sublinhado e tachado dentro do texto do poema, em Python puro.

O poema continua texto puro; a formatação é um subconjunto de Markdown:
`**negrito**`, `*itálico*`, `++sublinhado++` e `~~tachado~~`, com `\\` antes de
`*`, `+`, `~` ou `\\` para o caractere literal. Uma marca nunca atravessa a
quebra de linha (o compositor fecha e reabre em cada verso), então o número de
linhas, e com ele a numeração dos versos, é o mesmo com ou sem marcas.

As regras são as mesmas de `frontend/lib/marcas.ts`, que converte o texto para o
editor e para a tela (os testes dos dois lados usam os mesmos casos):

- Um delimitador abre se o caractere seguinte existe e não é espaço, e fecha
  se o anterior existe e não é espaço. Por isso `* * *` e `2 * 3` ficam literais.
- Uma sequência de `*` com 1, 2 ou 3 asteriscos alterna itálico, negrito ou os
  dois; com 4 ou mais, é literal. `++` e `~~` só valem com exatamente 2.
- Quem abre e não fecha até o fim do verso é literal: `shade*,` (nota de
  rodapé de um consagrado) continua com o asterisco.
"""

import re
from dataclasses import dataclass

NEGRITO = "negrito"
ITALICO = "italico"
SUBLINHADO = "sublinhado"
TACHADO = "tachado"

ESPECIAIS = "*+~\\"
# O mesmo conjunto do \s do JavaScript, para o front e o back concordarem.
_ESPACO = re.compile("[\t\n\v\f\r    -     　﻿]")
_ASTERISCOS = {1: frozenset({ITALICO}), 2: frozenset({NEGRITO}), 3: frozenset({NEGRITO, ITALICO})}

Segmento = tuple[str, frozenset[str]]


@dataclass
class _Token:
    texto: str  # o caractere literal (já sem o escape) ou o delimitador como está no texto
    marcas: frozenset[str] = frozenset()  # vazio = literal
    abre: bool = False
    fecha: bool = False
    aplicado: bool = False


def _espaco(c: str | None) -> bool:
    return c is None or bool(_ESPACO.fullmatch(c))


def _tokens(linha: str) -> list[_Token]:
    tokens: list[_Token] = []
    i, n = 0, len(linha)
    while i < n:
        c = linha[i]
        if c == "\\" and i + 1 < n and linha[i + 1] in ESPECIAIS:
            tokens.append(_Token(linha[i + 1]))
            i += 2
            continue
        if c in "*+~":
            fim = i
            while fim < n and linha[fim] == c:
                fim += 1
            corrida = fim - i
            if c == "*":
                marcas = _ASTERISCOS.get(corrida, frozenset())
            else:
                marcas = frozenset({SUBLINHADO if c == "+" else TACHADO}) if corrida == 2 else frozenset()
            anterior = linha[i - 1] if i > 0 else None
            seguinte = linha[fim] if fim < n else None
            tokens.append(
                _Token(linha[i:fim], marcas, abre=not _espaco(seguinte), fecha=not _espaco(anterior))
            )
            i = fim
            continue
        tokens.append(_Token(c))
        i += 1
    return tokens


def _resolver(linha: str) -> list[_Token]:
    """Os tokens do verso, com `aplicado` nos delimitadores que valem.

    Passa da esquerda para a direita alternando as marcas; um delimitador só vale
    se todas as marcas dele podem abrir (ou fechar) ali. O que abriu e não fechou
    vira literal e a passada recomeça: O(d²) no pior caso, d = delimitadores.
    """
    tokens = _tokens(linha)
    forcados: set[int] = set()
    while True:
        abertas: dict[str, int] = {}
        for i, token in enumerate(tokens):
            token.aplicado = False
            if not token.marcas or i in forcados:
                continue
            if all(token.fecha if m in abertas else token.abre for m in token.marcas):
                token.aplicado = True
                for m in token.marcas:
                    if m in abertas:
                        del abertas[m]
                    else:
                        abertas[m] = i
        if not abertas:
            return tokens
        forcados.update(abertas.values())


def _juntar(segmentos: list[Segmento]) -> list[Segmento]:
    """Sem segmentos vazios e sem dois seguidos com as mesmas marcas."""
    juntos: list[Segmento] = []
    for texto, marcas in segmentos:
        if not texto:
            continue
        if juntos and juntos[-1][1] == marcas:
            juntos[-1] = (juntos[-1][0] + texto, marcas)
        else:
            juntos.append((texto, marcas))
    return juntos


def analisar_linha(linha: str) -> list[Segmento]:
    """O verso em pedaços de texto com as marcas de cada um."""
    segmentos: list[Segmento] = []
    atuais: frozenset[str] = frozenset()
    for token in _resolver(linha):
        if token.aplicado:
            atuais = atuais ^ token.marcas
        else:
            segmentos.append((token.texto, atuais))
    return _juntar(segmentos)


def texto_sem_marcas(texto: str) -> str:
    """O texto como o leitor o vê, sem os delimitadores e os escapes.

    Mesmo número de linhas que `texto`, sem strip: é o que a oficina mede, de
    onde saem as #tags e o que se testa para "verso em branco".
    """
    return "\n".join(
        "".join(t for t, _ in analisar_linha(linha)) for linha in texto.split("\n")
    )


def tem_marcas(texto: str) -> bool:
    return any(m for linha in texto.split("\n") for _, m in analisar_linha(linha))


def _delimitadores(fecham: frozenset[str], abrem: frozenset[str]) -> str:
    """Fecha na ordem inversa da que abre: `~~++**tudo**++~~`."""
    def asteriscos(marcas: frozenset[str]) -> str:
        return "*" * ((2 if NEGRITO in marcas else 0) + (1 if ITALICO in marcas else 0))

    return (
        asteriscos(fecham)
        + ("++" if SUBLINHADO in fecham else "")
        + ("~~" if TACHADO in fecham else "")
        + ("~~" if TACHADO in abrem else "")
        + ("++" if SUBLINHADO in abrem else "")
        + asteriscos(abrem)
    )


def _sem_marca_nas_pontas(segmentos: list[Segmento]) -> list[Segmento]:
    """Espaço no começo ou no fim de uma marca sai dela (senão o delimitador não abre)."""
    letras = [(c, set(m)) for texto, m in segmentos for c in texto]
    for marca in (NEGRITO, ITALICO, SUBLINHADO, TACHADO):
        i = 0
        while i < len(letras):
            if marca not in letras[i][1]:
                i += 1
                continue
            fim = i
            while fim < len(letras) and marca in letras[fim][1]:
                fim += 1
            a, b = i, fim
            while a < b and _espaco(letras[a][0]):
                letras[a][1].discard(marca)
                a += 1
            while b > a and _espaco(letras[b - 1][0]):
                letras[b - 1][1].discard(marca)
                b -= 1
            i = fim
    return _juntar([(c, frozenset(m)) for c, m in letras])


def _escrever(segmentos: list[Segmento], escapar: bool) -> str:
    partes: list[str] = []
    anteriores: frozenset[str] = frozenset()
    for texto, marcas in segmentos:
        partes.append(_delimitadores(anteriores - marcas, marcas - anteriores))
        partes.append("".join("\\" + c if c in ESPECIAIS else c for c in texto) if escapar else texto)
        anteriores = marcas
    partes.append(_delimitadores(anteriores, frozenset()))
    return "".join(partes)


def escrever_linha(segmentos: list[Segmento]) -> str:
    """O verso no formato salvo. Só escapa quando precisa: um poema antigo, sem
    marcas, volta exatamente como estava. Se algum literal do verso precisa de
    escape, escapa todos os `*`, `+`, `~` e `\\` dele; um escape desnecessário
    (`2\\*3`, que sem a barra já é literal) sai.
    """
    normais = _sem_marca_nas_pontas(segmentos)
    simples = _escrever(normais, escapar=False)
    if analisar_linha(simples) == normais:
        return simples
    return _escrever(normais, escapar=True)


def escapar(texto: str) -> str:
    """Texto puro no formato salvo: o que parecer marca fica literal."""
    return "\n".join(escrever_linha([(linha, frozenset())]) for linha in texto.split("\n"))


def marcas_quebradas(texto: str) -> bool:
    """Algum `**`, `***`, `++` ou `~~` que não abre nem fecha (um `*` solto é nota de rodapé)."""
    return any(
        token.marcas and not token.aplicado and len(token.texto) > 1
        for linha in texto.split("\n")
        for token in _resolver(linha)
    )


def sem_marcas_quebradas(texto: str) -> str:
    """Tira toda a formatação, inclusive os delimitadores soltos, e escapa o resto."""
    linhas = []
    for linha in texto.split("\n"):
        visivel = "".join(
            token.texto
            for token in _resolver(linha)
            if not token.aplicado and not (token.marcas and len(token.texto) > 1)
        )
        linhas.append(visivel)
    return escapar("\n".join(linhas))
