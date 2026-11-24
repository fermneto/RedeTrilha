"""O extrator copia o verso do HTML do Wikisource e não inventa estrofe."""

from scripts.scraping.extrair_poema import (
    excerto_inicial,
    extrair_textos,
    forma_do_poema,
    linhas_nao_vazias,
)

SONETO = """
<div class="poem">
<p>Um<br />
Dois<br />
Tres<br />
Quatro<br />
<br />
Cinco<br />
Seis<br />
Sete<br />
Oito<br />
<br />
Nove<br />
Dez<br />
Onze<br />
<br />
Doze<br />
Treze<br />
Catorze
</p>
</div>
"""

PROSA = "<p>Honório olhou para o chão e viu uma carteira. Abaixar-se foi obra de um instante.</p>"

WS = """
<div class="ws-poem ws-poem-hi">
<div class="ws-poem-stanza">
<span class="ws-poem-line">Oh minha infancia!</span>
<span class="ws-poem-line"><span class="ws-poem-indent">  </span>Inda hoje</span>
</div>
<div class="ws-poem-stanza">
<span class="ws-poem-line">Segunda estrofe</span>
<span class="pagenum ws-pagenum">64</span>
</div>
</div>
"""


def test_soneto_preserva_estrofe_e_nao_a_quebra_do_html():
    texto = extrair_textos(SONETO)[0]
    assert linhas_nao_vazias(texto) == [
        "Um", "Dois", "Tres", "Quatro",
        "Cinco", "Seis", "Sete", "Oito",
        "Nove", "Dez", "Onze",
        "Doze", "Treze", "Catorze",
    ]
    assert "\n\n" in texto
    assert forma_do_poema(texto) == "soneto"


def test_prosa_sem_bloco_de_poema_nao_entra():
    assert extrair_textos(PROSA) == []


def test_excerto_de_canto_sem_estrofe_nao_traz_o_poema_inteiro():
    canto = "\n".join(f"verso {indice}" for indice in range(1, 201))
    trecho = excerto_inicial(canto)
    assert len(linhas_nao_vazias(trecho)) == 24
    assert trecho.startswith("verso 1\nverso 2")


def test_ws_poem_separa_estrofe_e_ignora_numero_de_pagina():
    texto = extrair_textos(WS)[0]
    assert texto.startswith("Oh minha infancia!\n  Inda hoje\n\nSegunda estrofe")
    assert "64" not in texto
    assert forma_do_poema(texto) == "outro"
