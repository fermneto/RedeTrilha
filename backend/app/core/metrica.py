"""Oficina do compositor: sílabas poéticas e esquema de rimas de versos em português.

Python puro e sem estado, como todo o core/: nada é guardado entre chamadas.
Cada chamada é O(n) no tamanho do texto.

## Sílabas poéticas

Conta-se até a última sílaba tônica do verso, à moda da metrificação em
língua portuguesa (Castilho):

1. Cada palavra vira uma sequência de núcleos vocálicos. Ditongo decrescente
   (vogal + i/u sem acento: "pai", "meu", "muito") e nasal ("mão", "mãe",
   "põe") contam um núcleo; i/u com acento ("saúde", "país") é hiato. O i/u
   seguido de "nh" ou de l, m, n, r, z em fim de sílaba ("rainha", "cair",
   "Raul", "ruim", "juiz", "ainda") também é hiato, menos o "ou", sempre ditongo.
   O u de "qu"/"gu" antes de vogal não conta ("quando", "guerra"). "ao(s)" é
   um núcleo.
2. A tônica da palavra é a vogal com acento agudo ou circunflexo; sem ele, a do
   til; sem nenhum, a penúltima nas terminadas em a, e, o (com ou sem s), em,
   ens, am, e a última nas demais.
3. Depois da tônica, vogais em contato se fundem (sinérese pós-tônica:
   "so-li-tá-rio", "Lá-cio", "vár-zeas"). Antes da tônica fica o hiato da
   gramática ("pi-e-da-de", "glo-ri-o-sas").
4. Sinalefa na fronteira das palavras: a vogal final átona se funde com a
   vogal inicial da palavra seguinte, mesmo tônica ("que ar-de" → "quear-",
   "senso! E eu" → um núcleo só). Vogal final tônica não se funde ("dói, e",
   "céu e-"), salvo antes de artigo ou "e" átonos ("é o mesmo").
   O h inicial é mudo.
5. Pronomes depois de hífen ("ouvi-las", "transforma-se") são átonos: a
   tônica do verso fica na palavra antes deles.

Limites conhecidos (os testes marcam com xfail): o poeta escolhe entre hiato e
sinérese conforme o metro, e a heurística não lê a intenção. "ain-da" e
"glo-rio-sas" contados como ditongo pelo poeta saem com uma sílaba a mais; a
pronúncia que a grafia não mostra (o "x" de "sexta") também escapa.

## Rimas

A terminação rímica vai da vogal tônica da última palavra ao fim do verso,
normalizada pelo som (sem acento agudo/circunflexo, "ç"/"ss"/"c" antes de e, i
viram "s", "z" final vira "s", h mudo cai; o til fica, porque "lã" não rima
com "lá"). Rima consoante: terminações iguais. Rima toante: só para versos sem
par consoante, a mesma vogal tônica e a mesma última vogal ("pedra"/"terra").
As letras do esquema valem para o poema inteiro (ABBA ABBA CDC DCD); linha em
branco separa estrofes.
"""

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

_VOGAIS = frozenset("aeiouyáéíóúâêôãõàü")
# Sem acento, i e u podem ser semivogais de ditongo decrescente.
_SEMIVOGAIS = frozenset("iuy")
_ACENTO_TONICO = frozenset("áéíóúâêô")
_NASAIS = frozenset("ãõ")
# Consoantes que, em fim de sílaba depois de i/u, fazem hiato: ca-ir, Ra-ul, ju-iz.
_FECHAM_HIATO = frozenset("lmnrz")
_PAROXITONA = re.compile(r"(?:[aeo]s?|em|ens|am)$")
# Pronomes oblíquos depois de hífen: átonos, a tônica fica na palavra anterior.
_ENCLITICOS = frozenset(
    {"me", "te", "se", "lhe", "lhes", "nos", "vos", "o", "a", "os", "as", "lo", "la", "los", "las"}
    | {"no", "na", "nas", "mo", "ma", "mos", "mas", "to", "ta", "tos", "tas"}
)
# Monossílabos átonos que se fundem até com uma vogal tônica antes ("é o mesmo").
_ATONOS_DE_LIGACAO = frozenset({"o", "a", "os", "as", "e", "à", "às", "ao", "aos"})
_PALAVRA = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*")
_APOSTROFOS = re.compile(r"['’]")
_TIL = "\u0303"  # o til combinante da forma NFD

# Avisos de forma: versos esperados e, no haicai, sílabas poéticas por verso.
VERSOS_DO_SONETO = 14
SILABAS_DO_HAICAI = (5, 7, 5)


@dataclass(frozen=True)
class _Palavra:
    letras: str
    # (início, fim) de cada núcleo vocálico em `letras`.
    nucleos: tuple[tuple[int, int], ...]
    tonica: int
    enclitica: bool

    @property
    def monossilabo(self) -> bool:
        return len(self.nucleos) == 1

    @property
    def comeca_com_vogal(self) -> bool:
        inicio = self.letras[1:] if self.letras[0] == "h" else self.letras
        return bool(inicio) and inicio[0] in _VOGAIS

    def funde_com(self, seguinte: "_Palavra") -> bool:
        """Sinalefa: a última vogal desta palavra e a primeira da seguinte viram um núcleo."""
        ultima = self.letras[-1]
        if not seguinte.comeca_com_vogal or ultima not in _VOGAIS or ultima in _NASAIS:
            return False
        if self.monossilabo:
            final_atono = ultima in "aeoà"
        else:
            final_atono = self.tonica < len(self.nucleos) - 1
        if final_atono:
            return True
        inicio, fim = self.nucleos[-1]
        vogal_simples = fim - inicio == 1
        return vogal_simples and seguinte.letras in _ATONOS_DE_LIGACAO


@dataclass(frozen=True)
class Verso:
    """Uma linha do texto. Linha em branco ou sem palavras: tudo None."""

    silabas: int | None
    rima: str | None
    tipo_rima: str | None  # "consoante", "toante" ou None (verso sem par)


def _semivogal(letras: str, k: int, anterior: str) -> bool:
    """A vogal em `k`, depois de `anterior`, fecha um ditongo decrescente?"""
    vogal = letras[k]
    if vogal not in _SEMIVOGAIS or vogal == anterior:
        return False
    if anterior == "o" and vogal == "u":
        return True
    resto = letras[k + 1 :]
    if resto.startswith("nh"):
        return False
    fecha_silaba = len(resto) == 1 or (len(resto) > 1 and resto[1] not in _VOGAIS)
    return not (resto and resto[0] in _FECHAM_HIATO and fecha_silaba)


def _nucleos(letras: str) -> tuple[tuple[int, int], ...]:
    if letras in ("ao", "aos"):
        return ((0, 2),)
    nucleos = []
    i, n = 0, len(letras)
    while i < n:
        c = letras[i]
        if c not in _VOGAIS:
            i += 1
            continue
        if c in "uü" and i > 0 and letras[i - 1] in "qg" and i + 1 < n and letras[i + 1] in _VOGAIS:
            i += 1
            continue
        fim = i + 1
        if fim < n and (
            (c in _NASAIS and letras[fim] in "eo") or _semivogal(letras, fim, c)
        ):
            fim += 1
        nucleos.append((i, fim))
        i = fim
    return tuple(nucleos)


def _tonica(letras: str, nucleos: tuple[tuple[int, int], ...]) -> int:
    if len(nucleos) == 1:
        return 0
    for marcas in (_ACENTO_TONICO, _NASAIS):
        for k, (inicio, fim) in enumerate(nucleos):
            if any(c in marcas for c in letras[inicio:fim]):
                return k
    return len(nucleos) - (2 if _PAROXITONA.search(letras) else 1)


def _sinerese_postonica(nucleos: tuple[tuple[int, int], ...], tonica: int) -> tuple[tuple[int, int], ...]:
    """Depois da tônica, vogais em contato contam juntas: tá-rio, Lá-cio, má-goa."""
    unidos = list(nucleos[: tonica + 1])
    for inicio, fim in nucleos[tonica + 1 :]:
        if len(unidos) - 1 > tonica and unidos[-1][1] == inicio:
            unidos[-1] = (unidos[-1][0], fim)
        else:
            unidos.append((inicio, fim))
    return tuple(unidos)


def _palavras(verso: str) -> list[_Palavra]:
    texto = _APOSTROFOS.sub("", unicodedata.normalize("NFC", verso).casefold())
    palavras = []
    for bloco in _PALAVRA.findall(texto):
        for k, parte in enumerate(bloco.split("-")):
            nucleos = _nucleos(parte)
            if not nucleos:
                continue
            tonica = _tonica(parte, nucleos)
            palavras.append(
                _Palavra(parte, _sinerese_postonica(nucleos, tonica), tonica, k > 0 and parte in _ENCLITICOS)
            )
    return palavras


def _palavra_tonica_final(palavras: list[_Palavra]) -> int:
    for k in range(len(palavras) - 1, -1, -1):
        if not palavras[k].enclitica:
            return k
    return len(palavras) - 1


def _medir(verso: str) -> tuple[int, str] | None:
    """(sílabas poéticas, terminação rímica crua) do verso, ou None sem palavras."""
    palavras = _palavras(verso)
    if not palavras:
        return None
    alvo = _palavra_tonica_final(palavras)
    silabas = 0
    for k, palavra in enumerate(palavras[: alvo + 1]):
        nucleos = palavra.tonica + 1 if k == alvo else len(palavra.nucleos)
        fundiu = k > 0 and palavras[k - 1].funde_com(palavra)
        silabas += nucleos - fundiu
    final = palavras[alvo]
    inicio = final.nucleos[final.tonica][0]
    terminacao = final.letras[inicio:] + "".join(p.letras for p in palavras[alvo + 1 :])
    return silabas, terminacao


def _pelo_som(terminacao: str) -> str:
    sem_acento = "".join(
        c
        for c in unicodedata.normalize("NFD", terminacao.replace("ç", "s"))
        if not unicodedata.combining(c) or c == _TIL
    )
    som = unicodedata.normalize("NFC", sem_acento)
    for padrao, troca in (
        (r"sc(?=[ei])", "s"),
        (r"c(?=[ei])", "s"),
        (r"ss", "s"),
        (r"g(?=[ei])", "j"),
        (r"gu(?=[ei])", "g"),
        (r"qu(?=[ei])", "k"),
        (r"(?<![cln])h", ""),
        (r"z$", "s"),
    ):
        som = re.sub(padrao, troca, som)
    return som


def _toante(som: str) -> str:
    vogais = [c for c in som if c in "aeiouyãõ"]
    return vogais[0] + vogais[-1] if len(vogais) > 1 else "".join(vogais)


def silabas_poeticas(verso: str) -> int | None:
    """Sílabas poéticas do verso, contadas até a última tônica. None se não há palavras."""
    medida = _medir(verso)
    return medida[0] if medida else None


def terminacao_rimica(verso: str) -> str | None:
    """Terminação do verso a partir da vogal tônica da última palavra, normalizada pelo som."""
    medida = _medir(verso)
    return _pelo_som(medida[1]) if medida else None


def _letra(indice: int) -> str:
    """A, B, ..., Z, AA, AB...: como as colunas de uma planilha."""
    letra = ""
    indice += 1
    while indice:
        indice, resto = divmod(indice - 1, 26)
        letra = chr(ord("A") + resto) + letra
    return letra


def analisar(texto: str) -> tuple[list[Verso], str]:
    """Um `Verso` por linha de `texto.split("\\n")` e o esquema de rimas ("ABBA ABBA CDC DCD")."""
    linhas = texto.split("\n")
    medidas = [_medir(linha) for linha in linhas]
    sons = [_pelo_som(m[1]) if m else None for m in medidas]
    consoantes = Counter(s for s in sons if s is not None)
    toantes = Counter(_toante(s) for s in sons if s is not None and consoantes[s] == 1)

    letras: dict[tuple[str, str | int], str] = {}
    versos: list[Verso] = []
    estrofes: list[list[str]] = [[]]
    for k, (linha, medida, som) in enumerate(zip(linhas, medidas, sons)):
        if not linha or linha.isspace():
            if estrofes[-1]:
                estrofes.append([])
            versos.append(Verso(None, None, None))
            continue
        if medida is None or som is None:
            versos.append(Verso(None, None, None))
            continue
        if consoantes[som] > 1:
            grupo, tipo = ("consoante", som), "consoante"
        elif toantes[_toante(som)] > 1:
            grupo, tipo = ("toante", _toante(som)), "toante"
        else:
            grupo, tipo = ("sozinho", k), None
        letra = letras.setdefault(grupo, _letra(len(letras)))
        estrofes[-1].append(letra)
        versos.append(Verso(medida[0], letra, tipo))
    esquema = " ".join("".join(estrofe) for estrofe in estrofes if estrofe)
    return versos, esquema


def esquema_de_rimas(texto: str) -> str:
    """Só o esquema: uma letra por verso, estrofes separadas por espaço."""
    return analisar(texto)[1]


def aviso_de_forma(forma: str | None, versos: list[Verso]) -> str | None:
    """Aviso leve quando o poema foge da forma escolhida. Nunca bloqueia a publicação."""
    silabas = [v.silabas for v in versos if v.silabas is not None]
    if not silabas:
        return None
    total = len(silabas)
    if forma == "soneto" and total != VERSOS_DO_SONETO:
        return f"Um soneto costuma ter {VERSOS_DO_SONETO} versos; este tem {total}."
    if forma == "haicai":
        esperado = len(SILABAS_DO_HAICAI)
        if total != esperado:
            return f"Um haicai costuma ter {esperado} versos; este tem {total}."
        if tuple(silabas) != SILABAS_DO_HAICAI:
            return (
                f"Um haicai costuma ter {_em_lista(SILABAS_DO_HAICAI)} sílabas poéticas; "
                f"este tem {_em_lista(silabas)}."
            )
    return None


def _em_lista(numeros) -> str:
    *inicio, ultimo = [str(n) for n in numeros]
    return f"{', '.join(inicio)} e {ultimo}" if inicio else ultimo
