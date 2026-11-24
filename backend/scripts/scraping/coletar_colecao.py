"""Importa, de uma categoria do Wikisource, todos os poemas transcritos de um autor.

Não altera username nem (titulo, obra) dos poemas que já estão no JSON: só
acrescenta. Epopeia entra em excerto de abertura. O texto vem da página; não
se completa de memória.

Uso (a partir de backend/):

    uv run python scripts/scraping/coletar_colecao.py
    uv run python scripts/scraping/coletar_colecao.py --somente bocage --limite 5
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pydantic import ValidationError

from app.schemas.consagrado import Consagrado, PoemaConsagrado
from app.schemas.user import USERNAMES_RESERVADOS
from scripts.scraping.catalogo_pt import EXISTENTES, NOVOS, Alvo
from scripts.scraping.cliente_wiki import ClienteWiki, ErroWiki
from scripts.scraping.datas import confirmar
from scripts.scraping.extrair_poema import (
    excerto_inicial,
    extrair_textos,
    forma_do_poema,
    linhas_nao_vazias,
)
from scripts.seed_conteudo import POETAS

PASTA = Path(__file__).resolve().parents[2] / "data" / "consagrados"
RELATORIO = PASTA / "_relatorio_expansao.md"
LIMITE_VERSO = 500
_EPICO = re.compile(
    r"(?i)lus[ií]adas|uraguai|uraguay|caramuru|vila rica|"
    r"confedera[cç][aã]o dos tamo|guesa|cartas chilenas|"
    r"divina commedia|commedia|orlando furioso|gerusalemme liberata|"
    r"chansons? de roland|os lusíadas|atlàntida|atlantida|"
    r"paradise lost|faerie queene|beowulf|don juan|"
    r"hiawatha|kalevala|aeneid|aeneis|eneida|metamorphoses|"
    r"rerum natura|ilíada|iliad|odisseia|odyssey|"
    r"онегин|onegin|"
    r"shahnameh|mah[aā]bh[aā]rata|ramayana"
)
_ABERTURA = re.compile(
    r"(?i)^(?:canto|chant|cant|càntic|book|livro|parte|part|chapter|kapitel|liber|глава)?\s*(?:i|1|primeiro|primero|premier|primer|primo)$"
)
_EDICAO = re.compile(r"(?i)grafia original|ortografia atualizada")
_REDIRECT = re.compile(
    r"#\s*(?:REDIRECTION|REDIRECT|RINVIA|REDIRECCI[ÓO]N)\s*\[\[([^\]|#]+)",
    re.IGNORECASE,
)
_TEMAS = (
    ("amor", ("amor", "amada", "amado", "beijo", "namoro", "paixao", "ciume")),
    ("morte", ("morte", "morto", "tumulo", "sepulcro", "cadaver")),
    ("natureza", ("flor", "flores", "mar", "rio", "monte", "bosque", "arvore", "natureza")),
    ("saudade", ("saudade", "adeus", "ausencia", "exilio")),
    ("religiao", ("deus", "cristo", "alma", "anjo", "oracao")),
    ("patria", ("patria", "brasil", "liberdade", "escrav")),
    ("noite", ("noite", "lua", "trevas", "sombra")),
    ("tempo", ("tempo", "memoria", "passado", "infancia")),
)


def _sem_acento(texto: str) -> str:
    nfkd = unicodedata.normalize("NFD", texto.lower())
    return "".join(caractere for caractere in nfkd if not unicodedata.combining(caractere))


def _tokens(texto: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", _sem_acento(texto))


def _parecido(um: list[str], outro: list[str]) -> bool:
    if not um or not outro:
        return False
    if abs(len(um) - len(outro)) / max(len(um), len(outro)) > 0.25:
        return False
    conta_um, conta_outro = Counter(um), Counter(outro)
    comum = sum((conta_um & conta_outro).values())
    return comum / max(len(um), len(outro)) >= 0.88


class Dedup:
    """Reconhece poema já guardado, inclusive noutra ortografia com o mesmo início."""

    def __init__(self) -> None:
        self.exatos: set[str] = set()
        self.prefixos: dict[tuple[str, ...], list[list[str]]] = {}

    def adicionar(self, texto: str) -> None:
        tokens = _tokens(texto)
        self.exatos.add(" ".join(tokens))
        if len(tokens) >= 8:
            self.prefixos.setdefault(tuple(tokens[:8]), []).append(tokens)

    def ja_tem(self, texto: str) -> bool:
        tokens = _tokens(texto)
        chave = " ".join(tokens)
        if chave in self.exatos:
            return True
        if len(tokens) < 8:
            return False
        for outro in self.prefixos.get(tuple(tokens[:8]), []):
            if _parecido(tokens, outro):
                return True
        return False


def _tags(titulo: str, texto: str) -> list[str]:
    palavras = set(_tokens(f"{titulo}\n{texto}"))
    achados: list[tuple[int, str]] = []
    for tag, chaves in _TEMAS:
        acertos = 0
        for chave in chaves:
            if chave in palavras or (
                len(chave) >= 5 and any(palavra.startswith(chave) for palavra in palavras)
            ):
                acertos += 1
        if acertos:
            achados.append((acertos, tag))
    achados.sort(key=lambda item: (-item[0], item[1]))
    return [tag for _, tag in achados[:4]]


def _motivo_de_pular(titulo: str) -> str | None:
    if titulo.startswith(
        ("Autor:", "Anexo:", "Usuário:", "Utilizador:", "User:", "Predefinição:", "Categoria:")
    ):
        return "namespace"
    if "Contos Tradicionaes" in titulo or "Contos Tradicionais" in titulo:
        return "fora_da_colecao"
    if _EDICAO.search(titulo):
        return "edicao_alternativa"
    return None


def _epico(titulo: str) -> bool:
    return bool(_EPICO.search(titulo))


def _abertura(titulo: str) -> bool:
    if "/" not in titulo:
        return True
    return bool(_ABERTURA.match(titulo.split("/")[-1].strip()))


def _url(wiki: str, titulo: str) -> str:
    caminho = quote(titulo.replace(" ", "_"), safe="/")
    return f"https://{wiki}.wikisource.org/wiki/{caminho}"


def _obra(wiki: str, categoria: str) -> str:
    obra = f"{wiki}.wikisource: {categoria}"
    return obra[:200]


def _escolher_categoria(
    cliente: ClienteWiki, wiki: str, categorias: tuple[str, ...]
) -> tuple[str, list[str]]:
    melhor = ("", [])
    for categoria in categorias:
        titulos = cliente.membros_da_categoria(wiki, categoria)
        if len(titulos) > len(melhor[1]):
            melhor = (categoria, titulos)
    return melhor


def _titulo_unico(titulo: str, obra: str, chaves: set[tuple[str | None, str | None]]) -> str:
    base = titulo[:200] if titulo else "Sem título"
    candidato = base
    indice = 2
    while (candidato, obra) in chaves:
        sufixo = f" ({indice})"
        candidato = base[: 200 - len(sufixo)] + sufixo
        indice += 1
    return candidato


def _gravar(caminho: Path, dados: dict) -> None:
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _processar(cliente: ClienteWiki, alvo: Alvo, limite: int | None) -> dict:
    caminho = PASTA / f"{alvo.username}.json"
    novo = alvo.name is not None
    resumo: dict = {
        "username": alvo.username,
        "name": alvo.name,
        "novo": novo,
        "categoria": "",
        "paginas": 0,
        "importados": 0,
        "existentes": 0,
        "pulados": Counter(),
        "morte": None,
        "fontes_data": "",
        "nota_data": "",
        "sitelinks": None,
        "estado": "ok",
        "motivo": "",
        "wiki": alvo.wiki,
    }
    if novo:
        if not caminho.exists() and alvo.username in _usernames_ocupados():
            resumo["estado"] = "descartado"
            resumo["motivo"] = "username já usado por conta do seed ou reservado"
            return resumo
        datas, motivo = confirmar(
            cliente, alvo.busca or alvo.name or alvo.username, qid=alvo.qid
        )
        if datas is None:
            resumo["estado"] = "descartado" if "1955" in motivo else "duvida"
            resumo["motivo"] = motivo
            return resumo
        resumo["morte"] = datas.morte
        resumo["fontes_data"] = datas.fontes
        resumo["nota_data"] = datas.nota
        resumo["sitelinks"] = datas.sitelinks
        resumo["name"] = alvo.name
    elif not caminho.exists():
        resumo["estado"] = "erro"
        resumo["motivo"] = "JSON existente não encontrado"
        return resumo

    if alvo.prefixo:
        categoria = alvo.prefixo.rstrip("/")
        titulos = cliente.paginas_com_prefixo(alvo.wiki, alvo.prefixo)
    else:
        categoria, titulos = _escolher_categoria(cliente, alvo.wiki, alvo.categorias)
    resumo["categoria"] = categoria
    resumo["paginas"] = len(titulos)
    if not titulos:
        onde = ", ".join(alvo.categorias) or (alvo.prefixo or "")
        resumo["estado"] = "descartado"
        resumo["motivo"] = f"sem coleção transcrita no {alvo.wiki}.wikisource ({onde})"
        return resumo

    if caminho.exists():
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    else:
        dados = {
            "username": alvo.username,
            "name": alvo.name,
            "bio": alvo.bio or "",
            "avatar_url": datas.avatar_url,
            "morte": datas.morte,
            "poemas": [],
        }
        if datas.nascimento is not None:
            dados["nascimento"] = datas.nascimento
    resumo["name"] = dados.get("name")
    resumo["morte"] = dados.get("morte")
    resumo["existentes"] = len(dados["poemas"])
    obra = _obra(alvo.wiki, categoria)
    dedup = Dedup()
    chaves = set()
    for poema in dados["poemas"]:
        dedup.adicionar(poema["texto"])
        chaves.add((poema.get("titulo"), poema.get("obra")))

    vistos = 0
    for titulo_pagina in titulos:
        if limite is not None and vistos >= limite:
            resumo["pulados"]["limite_do_ensaio"] += len(titulos) - vistos
            break
        motivo = _motivo_de_pular(titulo_pagina)
        if motivo:
            resumo["pulados"][motivo] += 1
            continue
        vistos += 1
        try:
            pagina = cliente.parse(alvo.wiki, titulo_pagina)
        except ErroWiki as erro:
            resumo["pulados"]["erro_api"] += 1
            resumo.setdefault("erros", []).append(str(erro))
            continue
        salto = _REDIRECT.match((pagina.get("wikitext") or "").lstrip())
        if salto:
            try:
                pagina = cliente.parse(alvo.wiki, salto.group(1).strip())
            except ErroWiki as erro:
                resumo["pulados"]["erro_api"] += 1
                resumo.setdefault("erros", []).append(str(erro))
                continue
        titulo_final = pagina["title"] or titulo_pagina
        textos = extrair_textos(pagina["html"])
        if not textos:
            testo = re.search(r"\{\{Testo\|([^|}]+)", pagina.get("wikitext") or "")
            if testo:
                try:
                    pagina = cliente.parse(alvo.wiki, testo.group(1).strip())
                    titulo_final = pagina["title"] or titolo_final
                    textos = extrair_textos(pagina["html"])
                except ErroWiki:
                    textos = []
        if not textos:
            resumo["pulados"]["sem_poema"] += 1
            continue
        for indice, texto in enumerate(textos, start=1):
            if len(linhas_nao_vazias(texto)) < 2:
                resumo["pulados"]["curto"] += 1
                continue
            excerto = False
            if _epico(titulo_final):
                if not _abertura(titulo_final):
                    resumo["pulados"]["epico_seguinte"] += 1
                    continue
                texto = excerto_inicial(texto)
                excerto = True
            elif len(linhas_nao_vazias(texto)) > LIMITE_VERSO:
                texto = excerto_inicial(texto)
                excerto = True
            if len(linhas_nao_vazias(texto)) < 2:
                resumo["pulados"]["curto"] += 1
                continue
            if dedup.ja_tem(texto):
                resumo["pulados"]["duplicata"] += 1
                continue
            titulo = titulo_final
            if len(textos) > 1:
                primeiro = linhas_nao_vazias(texto)[0][:80]
                titulo = f"{titulo_final} — {primeiro}"
            if excerto:
                titulo = f"{titulo} (estrofes iniciais)"
            fonte = _url(alvo.wiki, titulo_final)
            if len(fonte) > 500 or len(titulo) > 240:
                resumo["pulados"]["url_ou_titulo_longo"] += 1
                continue
            titulo = _titulo_unico(titulo, obra, chaves)
            forma = forma_do_poema(texto, cordel=alvo.cordel, excerto=excerto)
            poema = {
                "titulo": titulo,
                "texto": texto,
                "forma": forma,
                "obra": obra,
                "ano": None,
                "fonte": fonte,
                "tags": _tags(titulo, texto),
            }
            try:
                PoemaConsagrado.model_validate(poema)
            except ValidationError:
                resumo["pulados"]["schema"] += 1
                continue
            dados["poemas"].append(poema)
            chaves.add((poema["titulo"], poema["obra"]))
            dedup.adicionar(texto)
            resumo["importados"] += 1
            if excerto:
                resumo["pulados"]["excertos"] += 1

    if resumo["importados"] == 0 and novo:
        resumo["estado"] = "descartado"
        resumo["motivo"] = "coleção sem poema novo aproveitável"
        return resumo
    if resumo["importados"] == 0:
        resumo["estado"] = "inalterado"
        return resumo
    try:
        Consagrado.model_validate(dados)
    except ValidationError as erro:
        resumo["estado"] = "erro"
        resumo["motivo"] = str(erro)[:500]
        resumo["importados"] = 0
        return resumo
    _gravar(caminho, dados)
    return resumo


def _usernames_ocupados() -> set[str]:
    ocupados = {poeta.username for poeta in POETAS} | set(USERNAMES_RESERVADOS)
    ocupados.update(caminho.stem for caminho in PASTA.glob("*.json") if not caminho.name.startswith("_"))
    return ocupados


def _escrever_relatorio(resumos: list[dict], total_poetas: int, total_poemas: int) -> None:
    novos = [item for item in resumos if item["novo"] and item["estado"] == "ok"]
    aprofundados = [item for item in resumos if not item["novo"] and item["importados"]]
    descartados = [item for item in resumos if item["estado"] == "descartado"]
    duvidas = [item for item in resumos if item["estado"] == "duvida"]
    erros = [item for item in resumos if item["estado"] == "erro"]
    linhas = [
        "# Expansão dos consagrados — bloco em português",
        "",
        "Coleção única por autor: a categoria do pt.wikisource com os poemas já "
        "transcritos (ou o livro, quando a categoria do autor não lista as peças). "
        "O texto é o da página. Epopeia entra só com as estrofes iniciais do canto de abertura. "
        "Poemas que já estavam no JSON não mudam de título nem de obra; o que coincidia "
        "no texto foi contado como duplicata e não entrou de novo.",
        "",
        "Blocos ainda por fazer: línguas latinas e espanhol; inglês; germânico, eslavo e nórdico; "
        "antiguidade e Mediterrâneo; árabe, persa, turco e índico; Ásia oriental; "
        "Américas não hispânicas. Os 95 poetas de fora do bloco português continuam "
        "com a seleção curta que já tinham.",
        "",
        "## 1. Poetas acrescentados",
        "",
        "| username | nome | morte | idioma | poemas | fonte principal |",
        "|---|---|---:|---|---:|---|",
    ]
    if not novos:
        linhas.append("| — | nenhum neste bloco |  |  |  |  |")
    for item in sorted(novos, key=lambda entrada: entrada["username"]):
        linhas.append(
            f"| `{item['username']}` | {item['name']} | {item['morte']} | {item.get('wiki') or 'pt'} | "
            f"{item['importados']} | {item.get('wiki') or 'pt'}.wikisource: {item['categoria']} ({item['fontes_data']}) |"
        )
    linhas += [
        "",
        "## 1b. Poetas que já existiam — coleção aprofundada",
        "",
        "| username | coleção | páginas na coleção | já havia | importados | pulados |",
        "|---|---|---:|---:|---:|---|",
    ]
    for item in sorted(aprofundados, key=lambda entrada: entrada["username"]):
        pulados = ", ".join(f"{chave} {valor}" for chave, valor in sorted(item["pulados"].items()))
        linhas.append(
            f"| `{item['username']}` | Categoria:{item['categoria']} | {item['paginas']} | "
            f"{item['existentes']} | {item['importados']} | {pulados or '—'} |"
        )
    inalterados = [item for item in resumos if item["estado"] == "inalterado"]
    if inalterados:
        linhas += ["", "Sem poema novo (coleção vazia de inéditos ou só duplicata): "
                    + ", ".join(f"`{item['username']}`" for item in inalterados) + "."]
    linhas += [
        "",
        "## 2. Candidatos descartados",
        "",
        "| nome / username | motivo |",
        "|---|---|",
    ]
    if not descartados:
        linhas.append("| — | — |")
    for item in descartados:
        linhas.append(f"| {item.get('name') or item['username']} | {item['motivo']} |")
    linhas += [
        "",
        "## 3. Casos para decisão humana",
        "",
        "Não foram importados.",
        "",
        "| nome / username | porquê |",
        "|---|---|",
    ]
    if not duvidas:
        linhas.append("| — | — |")
    for item in duvidas:
        linhas.append(f"| {item.get('name') or item['username']} | {item['motivo']} |")
    if erros:
        linhas += ["", "## Erros de gravação", ""]
        for item in erros:
            linhas.append(f"- `{item['username']}`: {item['motivo']}")
    linhas += [
        "",
        "## Notas de data",
        "",
    ]
    notas = [item for item in resumos if item.get("nota_data")]
    if not notas:
        linhas.append("Nenhuma divergência entre Wikidata e Wikipédia nos poetas que entraram.")
    for item in notas:
        linhas.append(
            f"- `{item['username']}`: {item['nota_data']} ({item['fontes_data']})."
        )
    linhas += [
        "",
        "## 4. Contagem",
        "",
        f"JSON na pasta (exceto ficheiros `_`): {total_poetas} poetas, {total_poemas} poemas.",
        "",
        "A contagem do importador (`make reset`) fica no fim deste ficheiro quando a carga correr.",
        "",
    ]
    RELATORIO.write_text("\n".join(linhas), encoding="utf-8")


def _totais() -> tuple[int, int]:
    poetas = poemas = 0
    for caminho in PASTA.glob("*.json"):
        if caminho.name.startswith("_"):
            continue
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        poetas += 1
        poemas += len(dados["poemas"])
    return poetas, poemas


def _anexar_bloco(nome: str, resumos: list[dict], total_poetas: int, total_poemas: int) -> None:
    """Acrescenta um bloco ao relatório sem apagar o que os blocos anteriores gravaram."""
    novos = [item for item in resumos if item["novo"] and item["estado"] == "ok"]
    aprofundados = [item for item in resumos if not item["novo"] and item["importados"]]
    descartados = [item for item in resumos if item["estado"] == "descartado"]
    duvidas = [item for item in resumos if item["estado"] == "duvida"]
    linhas = [
        f"## Bloco: {nome}",
        "",
        "Coleção única por autor, no Wikisource da língua. Epopeia: só a abertura.",
        "",
        "### Poetas acrescentados",
        "",
        "| username | nome | morte | idioma | poemas | fonte principal |",
        "|---|---|---:|---|---:|---|",
    ]
    if not novos:
        linhas.append("| — | nenhum |  |  |  |  |")
    for item in sorted(novos, key=lambda entrada: entrada["username"]):
        linhas.append(
            f"| `{item['username']}` | {item['name']} | {item['morte']} | {item.get('wiki')} | "
            f"{item['importados']} | {item.get('wiki')}.wikisource: {item['categoria']} |"
        )
    linhas += [
        "",
        "### Coleções aprofundadas",
        "",
        "| username | coleção | páginas | já havia | importados | pulados |",
        "|---|---|---:|---:|---:|---|",
    ]
    if not aprofundados:
        linhas.append("| — | — |  |  |  |  |")
    for item in sorted(aprofundados, key=lambda entrada: entrada["username"]):
        pulados = ", ".join(f"{chave} {valor}" for chave, valor in sorted(item["pulados"].items()))
        linhas.append(
            f"| `{item['username']}` | {item.get('wiki')}.wikisource: {item['categoria']} | "
            f"{item['paginas']} | {item['existentes']} | {item['importados']} | {pulados or '—'} |"
        )
    linhas += ["", "### Descartados", "", "| nome | motivo |", "|---|---|"]
    if not descartados:
        linhas.append("| — | — |")
    for item in descartados:
        linhas.append(f"| {item.get('name') or item['username']} | {item['motivo']} |")
    linhas += ["", "### Para decisão humana", "", "| nome | porquê |", "|---|---|"]
    if not duvidas:
        linhas.append("| — | — |")
    for item in duvidas:
        linhas.append(f"| {item.get('name') or item['username']} | {item['motivo']} |")
    linhas.append("")
    texto = RELATORIO.read_text(encoding="utf-8") if RELATORIO.exists() else ""
    marca = f"## Bloco: {nome}"
    if marca in texto:
        antes, _, resto = texto.partition(marca)
        proximo = resto.find("\n## ")
        resto = resto[proximo + 1 :] if proximo != -1 else ""
        texto = antes + resto
    contagem = "\n## 4. Contagem\n"
    bloco = "\n".join(linhas)
    if contagem in texto:
        texto = texto.replace(contagem, "\n" + bloco + contagem, 1)
    else:
        texto = texto.rstrip() + "\n\n" + bloco + "\n"
    texto = re.sub(
        r"JSON na pasta \(exceto ficheiros `_`\): \d+ poetas, \d+ poemas\.",
        f"JSON na pasta (exceto ficheiros `_`): {total_poetas} poetas, {total_poemas} poemas.",
        texto,
        count=1,
    )
    RELATORIO.write_text(texto, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--somente", nargs="*", default=None, help="usernames a processar")
    parser.add_argument("--limite", type=int, default=None, help="máximo de páginas lidas por autor")
    parser.add_argument("--so-novos", action="store_true")
    parser.add_argument("--so-existentes", action="store_true")
    parser.add_argument(
        "--bloco",
        default="pt",
        help="pt (catálogo português, reescreve o relatório) ou latinos",
    )
    args = parser.parse_args()
    if args.bloco == "pt":
        EXISTENTES_BLOCO, NOVOS_BLOCO = EXISTENTES, NOVOS
    else:
        import importlib

        modulo = importlib.import_module(f"scripts.scraping.catalogo_{args.bloco}")
        EXISTENTES_BLOCO, NOVOS_BLOCO = modulo.EXISTENTES, modulo.NOVOS
    alvos = []
    if not args.so_novos:
        alvos.extend(EXISTENTES_BLOCO)
    if not args.so_existentes:
        alvos.extend(NOVOS_BLOCO)
    if args.somente:
        queridos = set(args.somente)
        alvos = [alvo for alvo in alvos if alvo.username in queridos]
    cliente = ClienteWiki(intervalo=0.2)
    resumos = []
    for indice, alvo in enumerate(alvos, start=1):
        print(f"[{indice}/{len(alvos)}] {alvo.username}", flush=True)
        resumo = _processar(cliente, alvo, args.limite)
        resumos.append(resumo)
        print(
            f"    {resumo['estado']} cat={resumo['categoria']!r} "
            f"paginas={resumo['paginas']} novos={resumo['importados']} "
            f"pulados={dict(resumo['pulados'])} {resumo['motivo']}",
            flush=True,
        )
    poetas, poemas = _totais()
    nome_saida = "resultado_pt.json" if args.bloco == "pt" else f"resultado_{args.bloco}.json"
    saida = Path(__file__).resolve().parent / nome_saida
    gravavel = []
    for resumo in resumos:
        copia = dict(resumo)
        copia["pulados"] = dict(copia["pulados"])
        gravavel.append(copia)
    if args.somente and saida.exists():
        anteriores = json.loads(saida.read_text(encoding="utf-8"))
        por_nome = {item["username"]: item for item in anteriores}
        for item in gravavel:
            por_nome[item["username"]] = item
        gravavel = list(por_nome.values())
    saida.write_text(json.dumps(gravavel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.bloco == "pt":
        _escrever_relatorio(gravavel, poetas, poemas)
    else:
        titulos_bloco = {
            "latinos": "Línguas latinas e espanhol",
            "ingles": "Inglês",
            "germanico": "Germânico, eslavo e nórdico",
            "antiguidade": "Antiguidade e Mediterrâneo",
            "oriente": "Árabe, persa, turco e índico",
            "asia": "Ásia oriental",
            "americas": "Américas não hispânicas",
        }
        _anexar_bloco(titulos_bloco.get(args.bloco, args.bloco), gravavel, poetas, poemas)
    print(f"poetas={poetas} poemas={poemas} relatorio={RELATORIO}", flush=True)


if __name__ == "__main__":
    main()
