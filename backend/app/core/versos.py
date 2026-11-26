"""A numeração dos versos de um poema (ou do texto de uma renga).

Duas contagens convivem, e cada uma tem o seu lugar:

- a **linha**: a posição em `texto.split("\\n")`, a partir de 1, com as linhas
  em branco incluídas. É o que a âncora da crítica guarda no banco
  (`ancoras_comentario`, `comentarios_renga`), o que a API recebe e devolve em
  `verso_inicio`/`verso_fim` e o que as marcas por verso contam. Não muda: as
  âncoras já gravadas continuam valendo sem migração;
- o **número do verso**: o que o leitor vê. Conta só as linhas com texto, em
  sequência (1 a 6 num poema de seis versos, qualquer que seja o número de
  estrofes). Vale na tela, no `?versos=` das URLs e na frase dos avisos.

Linha em branco é a vazia ou só com espaços (Gregório de Matos tem estrofes
separadas por "  "): separa estrofes, não é verso, não se numera nem se critica
sozinha. As marcas de formatação nunca deixam uma linha em branco com texto
(nem o contrário), então a regra vale igual no texto com ou sem elas. O front
segue a mesma regra em `lib/api.ts` (`linhaEmBranco`, `numerosDosVersos`).
"""


def em_branco(linha: str) -> bool:
    return linha.strip() == ""


def numeros_dos_versos(texto: str) -> list[int | None]:
    """Para cada linha do texto, o número do verso dela; None na linha em branco. O(n)."""
    numeros: list[int | None] = []
    n = 0
    for linha in texto.split("\n"):
        if em_branco(linha):
            numeros.append(None)
        else:
            n += 1
            numeros.append(n)
    return numeros


def intervalo_exibido(texto: str, inicio: int, fim: int) -> tuple[int, int] | None:
    """Os números de verso das linhas `inicio` a `fim` (base 1), sem as linhas em
    branco das pontas; None se o intervalo não tem verso ou sai do texto."""
    numeros = numeros_dos_versos(texto)[max(inicio, 1) - 1 : fim]
    versos = [n for n in numeros if n is not None]
    if not versos:
        return None
    return versos[0], versos[-1]
