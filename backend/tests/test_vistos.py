"""core/vistos.py: o conjunto do que a sessão do feed já viu, dentro do cursor."""

import random

import pytest

from app.core.vistos import VistosInvalidos, codificar, decodificar


def test_ida_e_volta():
    vistos = {("poema", 3), ("poema", 9), ("poema", 4), ("renga", 2), ("renga", 1)}
    assert decodificar(codificar(vistos)) == vistos


def test_vazio():
    assert decodificar(codificar([])) == frozenset()
    assert decodificar("") == frozenset()


def test_repetido_conta_uma_vez():
    assert decodificar(codificar([("poema", 5), ("poema", 5)])) == {("poema", 5)}


def test_sem_caracteres_que_quebrem_a_url_nem_o_cursor():
    texto = codificar({("poema", i) for i in range(1, 50)})
    assert set(texto) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")


def test_vinte_paginas_cabem_em_menos_de_1kb():
    rng = random.Random(7)
    vistos = {("poema", i) for i in rng.sample(range(1, 12_000), 380)}
    vistos |= {("renga", i) for i in range(1, 21)}
    assert len(codificar(vistos)) < 1024


@pytest.mark.parametrize("texto", ["nao-e-zlib", "!!", "eJwLAQ"])
def test_texto_que_nao_veio_de_codificar(texto):
    with pytest.raises(VistosInvalidos):
        decodificar(texto)
