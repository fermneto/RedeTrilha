"""Bloco germânico, eslavo e nórdico. Uma categoria ou um livro por poeta."""

from __future__ import annotations

from scripts.scraping.catalogo_pt import Alvo

EXISTENTES: tuple[Alvo, ...] = (
    Alvo("heine", ("Heinrich Heine",), wiki="de"),
    Alvo("holderlin", ("Friedrich Hölderlin",), wiki="de"),
    Alvo("pushkin", (), wiki="ru", prefixo="Евгений Онегин (Пушкин)/1837 (ДО)/"),
    Alvo("maiakovski", ("Владимир Маяковский",), wiki="ru"),
)

NOVOS: tuple[Alvo, ...] = (
    Alvo(
        "goethe",
        ("Johann Wolfgang von Goethe",),
        "Johann Wolfgang von Goethe",
        "Johann Wolfgang von Goethe",
        "Poeta alemão do classicismo de Weimar. A lírica, do período de Estrasburgo "
        "ao Divã ocidento-oriental, é o centro da poesia alemã moderna.",
        wiki="de",
        qid="Q5879",
    ),
    Alvo(
        "schiller",
        ("Friedrich Schiller",),
        "Friedrich Schiller",
        "Friedrich Schiller",
        "Poeta e dramaturgo alemão. Os poemas, entre eles a Ode à Alegria, "
        "acompanham o teatro e o ensaio e entram no cânone do classicismo.",
        wiki="de",
        qid="Q22670",
    ),
    Alvo(
        "eichendorff",
        ("Joseph von Eichendorff",),
        "Joseph von Eichendorff",
        "Joseph von Eichendorff",
        "Poeta alemão do romantismo. As canções de noite, viagem e floresta "
        "foram musicadas e ficaram na memória popular alemã.",
        wiki="de",
    ),
    Alvo(
        "morike",
        ("Eduard Mörike",),
        "Eduard Mörike",
        "Eduard Mörike",
        "Poeta suábio do romantismo tardio. A lírica amorosa e a balada, "
        "de dicção clara, ficam entre Goethe e o realismo.",
        wiki="de",
    ),
    Alvo(
        "rilke",
        ("Neue Gedichte",),
        "Rainer Maria Rilke",
        "Rainer Maria Rilke",
        "Poeta de língua alemã, de Praga. Neue Gedichte é o livro das "
        "coisas contempladas, anterior às Elegias de Duíno.",
        wiki="de",
        qid="Q76483",
    ),
    Alvo(
        "trakl",
        ("Georg Trakl",),
        "Georg Trakl",
        "Georg Trakl",
        "Poeta austríaco do expressionismo. Os poemas de outono, guerra e "
        "decadência, em imagens fechadas, marcam a lírica de 1914.",
        wiki="de",
        qid="Q78491",
    ),
    Alvo(
        "morgenstern",
        ("Christian Morgenstern",),
        "Christian Morgenstern",
        "Christian Morgenstern",
        "Poeta alemão. Os Galgenlieder e a lírica séria misturam o nonsense "
        "e a mística, e entraram na leitura alemã do início do século XX.",
        wiki="de",
    ),
    Alvo(
        "mickiewicz",
        ("Sonety krymskie",),
        "Adam Mickiewicz",
        "Adam Mickiewicz",
        "Poeta polaco do romantismo, figura nacional. Os Sonetos da Crimeia "
        "são o ciclo do exílio, do mar Negro e da paisagem tártara.",
        wiki="pl",
        qid="Q79822",
    ),
    Alvo(
        "bellman",
        ("Carl Michael Bellman",),
        "Carl Michael Bellman",
        "Carl Michael Bellman",
        "Poeta e músico sueco do século XVIII. As epístolas de Fredman "
        "cantam a taverna, a morte e Estocolmo, e fundam a canção sueca.",
        wiki="sv",
    ),
    Alvo(
        "tegner",
        ("Esaias Tegnér",),
        "Esaias Tegnér",
        "Esaias Tegnér",
        "Poeta sueco do romantismo nacional. A lírica e a Frithiofs saga "
        "tornaram-no o nome escolar da poesia sueca do século XIX.",
        wiki="sv",
    ),
    Alvo("novalis", ("Novalis",), "Novalis", "Novalis",
         "Poeta alemão do primeiro romantismo. Os Hinos à noite são o ciclo "
         "da morte da noiva e da noite como revelação.", wiki="de"),
    Alvo("lermontov", ("Михаил Лермонтов",), "Mikhail Lermontov", "Mikhail Lermontov",
         "Poeta russo do romantismo, depois de Pushkin. A lírica e o poema "
         "do Cáucaso definem a geração seguinte.", wiki="ru"),
)
