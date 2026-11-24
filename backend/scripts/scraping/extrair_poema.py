"""Tira o texto do poema do HTML renderizado pelo Wikisource.

Há dois formatos na página: a extensão `<poem>` (`div.poem`, com `<br>`) e a
transcrição de fac-símile (`ws-poem-line` / `ws-poem-stanza`). Cabeçalho, notas,
números de página e referências ficam de fora. O verso em si não é reescrito.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser

from app.schemas.consagrado import CABECALHO_DE_SONETO

_SALTAR = {
    "ws-noexport",
    "noprint",
    "reference",
    "reflist",
    "mw-references",
    "pagenum",
    "ws-pagenum",
    "mw-editsection",
    "error",
    "mw-empty-elt",
    "ws-poem-linenum",
    "ws-poem-versenum",
    "nop",
    "mw-cite-backlink",
}
_LIXO_LINHA = re.compile(r"^(\[editar\]|↑|\[\d+\])$")
_MARGEM = re.compile(r"margin-left:\s*([0-9.]+)em")


def _termina_em_quebra(partes: list[str]) -> bool:
    for parte in reversed(partes):
        if parte:
            return parte.endswith("\n")
    return False


def _classes(valor: str) -> set[str]:
    return set(valor.split())


def _salta(tag: str, classes: set[str]) -> bool:
    if tag in {"script", "style", "sup"}:
        return True
    if classes & _SALTAR:
        return True
    return any("reference" in classe or classe.startswith("mw-ref") for classe in classes)


def normalizar(texto: str) -> str:
    """Junta quebras vindas da paginação e tira lixo de interface, sem strip por verso."""
    texto = texto.replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " ")
    texto = texto.replace("\u200b", "").replace("\ufeff", "")
    linhas = []
    for linha in texto.split("\n"):
        if _LIXO_LINHA.match(linha.strip()):
            continue
        # Número de página colado ao verso nas transcrições ("6Su del", "    4dalle").
        linha = re.sub(r"^(\s*)\d{1,3}(?=[A-Za-zÀ-ÿ])", r"\1", linha)
        linhas.append(linha)
    texto = "\n".join(linhas)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip("\n")


def linhas_nao_vazias(texto: str) -> list[str]:
    linhas = [linha for linha in texto.split("\n") if linha.strip()]
    if linhas and CABECALHO_DE_SONETO.match(linhas[0]):
        linhas = linhas[1:]
    return linhas


def forma_do_poema(texto: str, *, cordel: bool = False, excerto: bool = False) -> str:
    if excerto:
        return "outro"
    quantidade = len(linhas_nao_vazias(texto))
    if quantidade == 14:
        return "soneto"
    if cordel:
        return "cordel"
    if quantidade == 4:
        return "quadra"
    return "outro"


def blocos_separados(blocos: list[str]) -> bool:
    """Vários `<poem>` na mesma página são poemas distintos; um poema partido não.

    A quebra de página parte um poema em dois blocos que não fecham sozinhos.
    Dois ou mais blocos, cada um com verso completo (e, se forem dois, os dois
    com 14 versos), são poemas lado a lado.
    """
    if len(blocos) < 2:
        return False
    contagens = [len(linhas_nao_vazias(bloco)) for bloco in blocos]
    if any(contagem < 4 or contagem > 80 for contagem in contagens):
        return False
    for bloco in blocos[1:]:
        primeira = bloco.lstrip("\n")[:1]
        if primeira and primeira.islower():
            return False
    if len(blocos) == 2 and contagens != [14, 14]:
        return False
    return all(bloco.rstrip().endswith((".", "!", "?", "…", "»", ";")) for bloco in blocos)


class _Extrator(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[dict] = []
        self.poem_divs: list[str] = []
        self.ws_poemas: list[str] = []

    def _em_poema(self) -> bool:
        return any(
            nodo["is_poem_div"] or nodo["is_ws"] or nodo["is_stanza"] or nodo["is_line"]
            for nodo in self.stack
        )

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        atributos = {chave: valor or "" for chave, valor in attrs}
        classes = _classes(atributos.get("class", ""))
        pai_salta = self.stack[-1]["skip"] if self.stack else False
        nodo = {
            "tag": tag,
            "cls": classes,
            "skip": pai_salta or _salta(tag, classes),
            "parts": [],
            "lines": [],
            "stanzas": [],
            "is_line": "ws-poem-line" in classes,
            "is_stanza": "ws-poem-stanza" in classes,
            "is_ws": "ws-poem" in classes
            and not (classes & {"ws-poem-line", "ws-poem-stanza", "ws-poem-indent", "ws-poem-break"}),
            "is_poem_div": "poem" in classes and not any(classe.startswith("ws-poem") for classe in classes),
        }
        if not nodo["skip"] and self._em_poema() and tag == "span":
            margem = _MARGEM.search(atributos.get("style", ""))
            if margem:
                nodo["parts"].append(" " * int(float(margem.group(1))))
        if not nodo["skip"] and tag == "br" and self._em_poema() and self.stack:
            self.stack[-1]["parts"].append("\n")
        self.stack.append(nodo)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if not self.stack or self.stack[-1]["skip"] or not data:
            return
        # O HTML pretty-print põe uma quebra depois de <br>; o <br> já virou \n.
        if data.startswith("\n") and self._em_poema() and _termina_em_quebra(self.stack[-1]["parts"]):
            data = data[1:]
            if not data:
                return
        self.stack[-1]["parts"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if not self.stack:
            return
        indice = None
        for posicao in range(len(self.stack) - 1, -1, -1):
            if self.stack[posicao]["tag"] == tag:
                indice = posicao
                break
        if indice is None:
            return
        while len(self.stack) - 1 > indice:
            self._fechar(self.stack.pop())
        self._fechar(self.stack.pop())

    def _fechar(self, nodo: dict) -> None:
        texto = "".join(nodo["parts"])
        if nodo["skip"]:
            return
        if nodo["is_line"]:
            if self.stack:
                self.stack[-1]["lines"].append(texto)
            return
        if nodo["is_stanza"]:
            if nodo["lines"] and self.stack:
                self.stack[-1]["stanzas"].append("\n".join(nodo["lines"]))
            return
        if nodo["is_ws"]:
            if nodo["stanzas"]:
                self.ws_poemas.append("\n\n".join(estrofe for estrofe in nodo["stanzas"] if estrofe.strip()))
            elif nodo["lines"]:
                self.ws_poemas.append("\n".join(nodo["lines"]))
            return
        if nodo["is_poem_div"]:
            self.poem_divs.append(texto)
            return
        if self.stack and texto:
            self.stack[-1]["parts"].append(texto)

    def textos(self) -> list[str]:
        super().close()
        while self.stack:
            self._fechar(self.stack.pop())
        if self.ws_poemas and (
            not self.poem_divs or sum(len(p) for p in self.ws_poemas) >= sum(len(p) for p in self.poem_divs)
        ):
            blocos = self.ws_poemas
        else:
            blocos = self.poem_divs
        crus = [bloco for bloco in blocos if bloco.strip()]
        if not crus:
            return []
        blocos = [normalizar(bloco) for bloco in crus]
        if blocos_separados(blocos):
            return blocos
        # Junta as partes de uma página partida sem comer a estrofe que fecha o bloco.
        return [normalizar("\n".join(crus))]


def extrair_textos(html: str) -> list[str]:
    extrator = _Extrator()
    extrator.feed(html)
    return extrator.textos()


def _primeiras_linhas(texto: str, quantidade: int) -> str:
    saida: list[str] = []
    vistas = 0
    for linha in texto.split("\n"):
        saida.append(linha)
        if linha.strip():
            vistas += 1
        if vistas >= quantidade:
            break
    return "\n".join(saida)


def excerto_inicial(texto: str, estrofes: int = 3) -> str:
    """Abertura de epopeia ou de obra longa: as primeiras estrofes, não a obra inteira.

    Sem estrofe marcada, ou com estrofe que já é o canto inteiro, ficam as
    primeiras 24 linhas. Três estrofes não passam de 32 versos.
    """
    partes = [parte for parte in re.split(r"\n\s*\n", texto.strip("\n")) if parte.strip()]
    trecho = "\n\n".join(partes[:estrofes])
    versos = len(linhas_nao_vazias(trecho))
    if len(partes) < 2 or versos < 6 or versos > 32:
        trecho = _primeiras_linhas(texto, 24)
    return normalizar(trecho)
