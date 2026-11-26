"""A numeração que o leitor vê: só os versos, sem as linhas em branco (core/versos.py)."""

from app.core.versos import em_branco, intervalo_exibido, numeros_dos_versos

# "A gaveta": seis versos em duas estrofes.
GAVETA = "abro a gaveta\ne o cheiro\nde papel\nvolta\n\nnada mudou\nsó eu"


def test_numeracao_continua_so_dos_versos():
    assert numeros_dos_versos(GAVETA) == [1, 2, 3, 4, None, 5, 6]
    assert intervalo_exibido(GAVETA, 6, 7) == (5, 6)


def test_linha_so_com_espacos_e_em_branco():
    assert em_branco("") and em_branco("  ") and em_branco("\t ")
    assert not em_branco("  verso")
    assert numeros_dos_versos("Triste Bahia!\n  \nA ti tocou-te") == [1, None, 2]


def test_varias_linhas_em_branco_seguidas():
    texto = "um\n\n  \n\ndois\n"
    assert numeros_dos_versos(texto) == [1, None, None, None, 2, None]
    # As pontas em branco não entram: o intervalo é o dos versos dentro dele.
    assert intervalo_exibido(texto, 1, 5) == (1, 2)
    assert intervalo_exibido(texto, 2, 5) == (2, 2)
    assert intervalo_exibido(texto, 2, 4) is None


def test_poema_sem_linhas_em_branco():
    assert numeros_dos_versos("um\ndois\ntrês") == [1, 2, 3]
    assert intervalo_exibido("um\ndois\ntrês", 2, 3) == (2, 3)
