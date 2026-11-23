from app.core.indice_tags import extrair_tags


def test_extrai_hashtags_casefold_sem_acento_e_sem_duplicar():
    texto = "Chove em João Pessoa\n#Saudade #solidão\n#saudade de novo"
    assert extrair_tags(texto, None) == {"saudade", "solidao"}


def test_forma_entra_como_tag():
    assert extrair_tags("sem hashtag nenhuma", "haicai") == {"haicai"}
