"""Confere nascimento e morte em duas fontes: Wikidata e a Wikipédia.

Ano incerto entra só se todas as datas encontradas são até 1955. A morte
gravada é a estimativa mais tardia. Sem duas fontes, o poeta não entra.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from scripts.scraping.cliente_wiki import ClienteWiki

LIMITE = 1955


@dataclass
class DatasConfirmadas:
    qid: str
    morte: int
    nascimento: int | None
    sitelinks: int
    avatar_url: str
    fontes: str
    nota: str


def _ano_tempo(valor: dict) -> int | None:
    """Ano de um valor de tempo do Wikidata. Precisão abaixo de ano fica de fora."""
    # 9 = ano, 10 = mês, 11 = dia. Década (8) ainda traz um ano utilizável
    # quando a Wikipédia confirma; século (7) não.
    if valor.get("precision", 11) < 8:
        return None
    tempo = valor.get("time") or ""
    if len(tempo) < 5 or tempo[0] not in "+-":
        return None
    ano = int(tempo[1:5])
    return -ano if tempo[0] == "-" else ano


def _anos_da_propriedade(entidade: dict, propriedade: str) -> list[int]:
    anos = []
    for afirmacao in entidade.get("claims", {}).get(propriedade, []):
        snak = afirmacao.get("mainsnak") or {}
        if snak.get("snaktype") != "value":
            continue
        ano = _ano_tempo((snak.get("datavalue") or {}).get("value") or {})
        if ano is not None:
            anos.append(ano)
    return anos


def _anos_do_lead(wikitexto: str) -> tuple[int | None, int | None]:
    """Nascimento e morte no parêntese de abertura, não num ano perdido no artigo."""
    abertura = re.search(r"'''[^'\n]+'''\s*\(", wikitexto)
    if not abertura:
        return None, None
    profundidade = 1
    limite = abertura.end()
    caracteres: list[str] = []
    for caractere in wikitexto[limite : limite + 700]:
        if caractere == "(":
            profundidade += 1
        elif caractere == ")":
            profundidade -= 1
            if profundidade == 0:
                break
        caracteres.append(caractere)
    trecho = "".join(caracteres)
    anos = [int(ano) for ano in re.findall(r"\b(?:1[0-9]{3}|20[0-9]{2})\b", trecho)]
    if len(anos) >= 2:
        return anos[0], anos[-1]
    if len(anos) == 1 and re.search(r"\bm\.|\bmort[oa]|\bfalecid", trecho, re.I):
        return None, anos[0]
    if len(anos) == 1:
        return anos[0], None
    return None, None


def _ano_no_wikitexto(wikitexto: str, morte: bool) -> int | None:
    if not wikitexto:
        return None
    nascimento, morte_lead = _anos_do_lead(wikitexto)
    if morte and morte_lead is not None:
        return morte_lead
    if not morte and nascimento is not None:
        return nascimento
    if morte:
        casamento = re.search(r"\{\{\s*[Mm]orte\s*\|([^{}]*)\}\}", wikitexto)
        if casamento:
            anos = re.findall(r"\b(?:1[0-9]{3}|20[0-9]{2})\b", casamento.group(1))
            if anos:
                return int(anos[0])
        campo = re.search(
            r"\|\s*(?:morte|data_morte|data da morte)\s*=\s*([^\n|]+)", wikitexto, re.I
        )
    else:
        casamento = re.search(r"\{\{(?:dni|nascimento|nasc)\|([^}]*)\}\}", wikitexto, re.I)
        if casamento:
            numeros = re.findall(r"-?\d+", casamento.group(1))
            if len(numeros) >= 3:
                return int(numeros[2])
        campo = re.search(
            r"\|\s*(?:nascimento|data_nascimento|data de nascimento)\s*=\s*([^\n|]+)",
            wikitexto,
            re.I,
        )
    if campo:
        anos = re.findall(r"\b(?:1[0-9]{3}|20[0-9]{2})\b", campo.group(1))
        if anos:
            return int(anos[-1])
    return None


def _ficheiro(entidade: dict) -> str:
    for afirmacao in entidade.get("claims", {}).get("P18", []):
        snak = afirmacao.get("mainsnak") or {}
        if snak.get("snaktype") != "value":
            continue
        nome = (snak.get("datavalue") or {}).get("value")
        if isinstance(nome, str) and nome:
            return nome
    return ""


def _avatar(cliente: ClienteWiki, ficheiro: str) -> str:
    if not ficheiro:
        return ""
    dados = cliente.obter(
        "commons.wikimedia.org",
        {
            "action": "query",
            "titles": f"File:{ficheiro}",
            "prop": "imageinfo",
            "iiprop": "url",
        },
    )
    paginas = dados.get("query", {}).get("pages") or []
    if isinstance(paginas, dict):
        paginas = list(paginas.values())
    for pagina in paginas:
        info = (pagina.get("imageinfo") or [{}])[0]
        url = (info.get("url") or "").split("?", 1)[0]
        if url.startswith("http") and len(url) <= 300:
            return url
    return ""


def confirmar(cliente: ClienteWiki, nome: str) -> tuple[DatasConfirmadas | None, str]:
    """Devolve (datas, "") ou (None, motivo). O motivo já serve o relatório."""
    busca = cliente.obter(
        "www.wikidata.org",
        {
            "action": "wbsearchentities",
            "search": nome,
            "language": "pt",
            "uselang": "pt",
            "limit": "8",
        },
    )
    candidatos = busca.get("search") or []
    poetas = [
        item
        for item in candidatos
        if any(
            palavra in (item.get("description") or "").lower()
            for palavra in ("poet", "poeta", "escritor", "writer", "dramaturg")
        )
    ]
    if not poetas:
        return None, "Wikidata sem ficha de poeta entre os homônimos"
    qid = poetas[0]["id"]
    entidade = cliente.obter(
        "www.wikidata.org",
        {"action": "wbgetentities", "ids": qid, "props": "claims|sitelinks"},
    )
    ficha = (entidade.get("entities") or {}).get(qid) or {}
    if not ficha or ficha.get("missing"):
        return None, f"Wikidata {qid} sem ficha"
    mortes = _anos_da_propriedade(ficha, "P570")
    nascimentos = _anos_da_propriedade(ficha, "P569")
    sitelinks = ficha.get("sitelinks") or {}
    titulo_pt = (sitelinks.get("ptwiki") or {}).get("title") or nome
    wikitexto = cliente.wikitexto("pt.wikipedia.org", titulo_pt)
    if not wikitexto:
        titulo_en = (sitelinks.get("enwiki") or {}).get("title")
        if titulo_en:
            wikitexto = cliente.wikitexto("en.wikipedia.org", titulo_en)
            fonte_wp = "en.wikipedia"
        else:
            return None, f"sem artigo de Wikipédia para cruzar com {qid}"
    else:
        fonte_wp = "pt.wikipedia"
    morte_wp = _ano_no_wikitexto(wikitexto, morte=True)
    if morte_wp is None:
        return None, f"{fonte_wp} sem ano de morte (Wikidata {qid}: {mortes})"
    if not mortes:
        outra = "enwiki" if fonte_wp == "pt.wikipedia" else "ptwiki"
        titulo_outra = (sitelinks.get(outra) or {}).get("title")
        ano_outra = None
        if titulo_outra:
            host = "en.wikipedia.org" if outra == "enwiki" else "pt.wikipedia.org"
            ano_outra = _ano_no_wikitexto(cliente.wikitexto(host, titulo_outra), morte=True)
        if ano_outra is None:
            return None, f"só {fonte_wp} datou a morte ({morte_wp}); {qid} sem ano no Wikidata"
        mortes = [ano_outra]
        fonte_wp = f"{fonte_wp} e {outra}"
    todos = [*mortes, morte_wp]
    if any(ano > LIMITE for ano in todos):
        return None, f"morte depois de 1955 ({qid}: {sorted(set(todos))})"
    if max(todos) - min(todos) > 2:
        return None, (
            f"data de morte divergente demais para decidir "
            f"({qid}: Wikidata {sorted(set(mortes))}, {fonte_wp} {morte_wp})"
        )
    morte = max(todos)
    nota = ""
    if len(set(todos)) > 1:
        nota = f"fontes divergem {sorted(set(todos))}; fica a mais tardia"
    nascimento = None
    nasc_wp = _ano_no_wikitexto(wikitexto, morte=False)
    if nascimentos and nasc_wp is not None and min(nascimentos) == nasc_wp and nasc_wp < morte:
        nascimento = nasc_wp
    return (
        DatasConfirmadas(
            qid=qid,
            morte=morte,
            nascimento=nascimento,
            sitelinks=len(sitelinks),
            avatar_url=_avatar(cliente, _ficheiro(ficha)),
            fontes=f"Wikidata {qid} e {fonte_wp}",
            nota=nota,
        ),
        "",
    )
