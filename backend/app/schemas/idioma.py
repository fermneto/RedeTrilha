"""Língua de um poema: código ISO 639-1 de duas letras ("pt", "en", "zh")."""

# Padrão do compositor (que tem um seletor) e de quem não manda `idioma` no POST /posts.
# Os consagrados recebem o idioma da `fonte` no importador.
IDIOMA_PADRAO = "pt"

# Os 183 códigos da ISO 639-1.
IDIOMAS = frozenset(
    """
    aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv
    cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho
    hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku
    kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn
    no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm
    sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi
    vo wa wo xh yi yo za zh zu
    """.split()
)


def validar_idioma(idioma: str | None) -> str | None:
    """None = língua desconhecida; senão, um código da ISO 639-1 em minúsculas."""
    if idioma is not None and idioma not in IDIOMAS:
        raise ValueError(
            "idioma deve ser um código ISO 639-1 de duas letras em minúsculas, como pt ou en"
        )
    return idioma
