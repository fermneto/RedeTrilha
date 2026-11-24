"""Cliente da API do MediaWiki, com cache em disco e ritmo contido.

O robots.txt dos projetos Wikimedia barra `/w/` para crawlers genéricos e só
abre uma ação `mobileview` que o Wikisource já não reconhece. A tarefa pede a
API (MediaWiki e Wikidata): é por ela que se lê categoria e página, com
User-Agent identificado, cache e pausa. Não se varre `Special:` nem
`index.php`.
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "cache"
USER_AGENT = (
    "VersoConsagrados/1.0 "
    "(projeto universitario RedeTrilha; poesia em dominio publico; "
    "+https://github.com/fermneto/RedeTrilha)"
)
INTERVALO = 0.35


class ErroWiki(RuntimeError):
    """A API não devolveu a página depois das tentativas."""


class ClienteWiki:
    def __init__(self, intervalo: float = INTERVALO) -> None:
        self.intervalo = intervalo
        self._ultimo = 0.0

    def _esperar(self) -> None:
        falta = self.intervalo - (time.monotonic() - self._ultimo)
        if falta > 0:
            time.sleep(falta)
        self._ultimo = time.monotonic()

    def _ler_cache(self, chave: str) -> dict | None:
        caminho = self._caminho(chave)
        if not caminho.exists():
            return None
        return json.loads(caminho.read_text(encoding="utf-8"))

    def _gravar_cache(self, chave: str, dados: dict) -> None:
        caminho = self._caminho(chave)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")

    def _caminho(self, chave: str) -> Path:
        nome = hashlib.sha1(chave.encode("utf-8")).hexdigest()
        return CACHE / nome[:2] / f"{nome}.json"

    def obter(self, base: str, params: dict, *, cache: bool = True) -> dict:
        """GET na API. `base` é o host (`pt.wikisource.org`, `www.wikidata.org`)."""
        consulta = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
        chave = f"https://{base}/w/api.php?{consulta}"
        if cache:
            guardado = self._ler_cache(chave)
            if guardado is not None and "error" not in guardado:
                return guardado
        url = chave
        espera = 2.0
        ultimo_erro = "sem resposta"
        for _ in range(6):
            self._esperar()
            pedido = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(pedido, timeout=90) as resposta:
                    dados = json.loads(resposta.read().decode("utf-8"))
            except urllib.error.HTTPError as erro:
                ultimo_erro = f"HTTP {erro.code}"
                if erro.code in {429, 503, 502, 504}:
                    time.sleep(espera)
                    espera = min(espera * 2, 60)
                    continue
                raise ErroWiki(f"{base}: {ultimo_erro} em {params.get('action')}") from erro
            except urllib.error.URLError as erro:
                ultimo_erro = str(erro.reason)
                time.sleep(espera)
                espera = min(espera * 2, 60)
                continue
            codigo = (dados.get("error") or {}).get("code") if isinstance(dados, dict) else None
            if codigo in {"maxlag", "ratelimited", "readonly", "internal_api_error"}:
                time.sleep(espera)
                espera = min(espera * 2, 30)
                continue
            if codigo:
                return dados
            if cache:
                self._gravar_cache(chave, dados)
            return dados
        raise ErroWiki(f"{base}: {ultimo_erro}")

    def parse(self, wiki: str, titulo: str) -> dict:
        """HTML renderizado e wikitexto de uma página (a transcrição, não a memória)."""
        dados = self.obter(
            f"{wiki}.wikisource.org",
            {
                "action": "parse",
                "page": titulo,
                "prop": "text|wikitext",
                "disableeditsection": "1",
                "disabletoc": "1",
            },
        )
        if "error" in dados:
            raise ErroWiki(f"{wiki}:{titulo}: {dados['error'].get('code')}")
        parse = dados["parse"]
        texto = parse.get("text") or ""
        if isinstance(texto, dict):
            texto = texto.get("*") or ""
        wikitexto = parse.get("wikitext") or ""
        if isinstance(wikitexto, dict):
            wikitexto = wikitexto.get("*") or ""
        return {
            "title": parse.get("title") or titulo,
            "html": texto,
            "wikitext": wikitexto,
        }

    def membros_da_categoria(self, wiki: str, categoria: str) -> list[str]:
        """Títulos do domínio principal (ns 0) de uma categoria, página a página.

        `Category:` é o nome canónico e vale em qualquer Wikisource. Em português
        continua `Categoria:`, para reaproveitar o cache já gravado.
        """
        namespace = "Categoria" if wiki == "pt" else "Category"
        titulos: list[str] = []
        continuar: str | None = None
        guarda = 0
        while guarda < 40:
            guarda += 1
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": f"{namespace}:{categoria}",
                "cmlimit": "500",
                "cmtype": "page",
            }
            if continuar:
                params["cmcontinue"] = continuar
            dados = self.obter(f"{wiki}.wikisource.org", params)
            if dados.get("error", {}).get("code") == "missingtitle":
                return []
            for membro in dados.get("query", {}).get("categorymembers", []):
                if membro.get("ns") == 0:
                    titulos.append(membro["title"])
            continuar = (dados.get("continue") or {}).get("cmcontinue")
            if not continuar:
                break
        return titulos

    def paginas_com_prefixo(self, wiki: str, prefixo: str) -> list[str]:
        """Subpáginas de um livro (`Obra/`), no domínio principal."""
        titulos: list[str] = []
        continuar: str | None = None
        guarda = 0
        while guarda < 20:
            guarda += 1
            params = {
                "action": "query",
                "list": "allpages",
                "apprefix": prefixo,
                "apnamespace": "0",
                "aplimit": "500",
            }
            if continuar:
                params["apcontinue"] = continuar
            dados = self.obter(f"{wiki}.wikisource.org", params)
            if dados.get("error"):
                return titulos
            for pagina in dados.get("query", {}).get("allpages", []):
                titulos.append(pagina["title"])
            continuar = (dados.get("continue") or {}).get("apcontinue")
            if not continuar:
                break
        return titulos

    def wikitexto(self, wiki_host: str, titulo: str) -> str:
        dados = self.obter(
            wiki_host,
            {
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "titles": titulo,
                "redirects": "1",
            },
        )
        paginas = dados.get("query", {}).get("pages", [])
        if not paginas or paginas[0].get("missing"):
            return ""
        revisoes = paginas[0].get("revisions") or []
        if not revisoes:
            return ""
        slots = revisoes[0].get("slots") or {}
        main = slots.get("main") or {}
        return main.get("content") or ""
