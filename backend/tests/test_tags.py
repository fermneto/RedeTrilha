from datetime import UTC, datetime, timedelta, timezone

from app.core.indice_tags import IndiceTags, extrair_tags

AGORA = datetime(2026, 11, 25, 12, 0, tzinfo=UTC)


def dias_atras(n: int) -> datetime:
    return AGORA - timedelta(days=n)


def test_extrai_hashtags_casefold_sem_acento_e_sem_duplicar():
    texto = "Chove em João Pessoa\n#Saudade #solidão\n#saudade de novo"
    assert extrair_tags(texto, None) == {"saudade", "solidao"}


def test_forma_entra_como_tag():
    assert extrair_tags("sem hashtag nenhuma", "haicai") == {"haicai"}


def test_posts_da_tag_mais_novo_primeiro_e_empate_pelo_maior_id():
    indice = IndiceTags()
    indice.indexar(1, {"amor"}, dias_atras(3))
    indice.indexar(2, {"amor", "mar"}, dias_atras(1))
    indice.indexar(3, {"amor"}, dias_atras(2))
    indice.indexar(4, {"amor"}, dias_atras(1))
    assert indice.posts_da_tag("amor") == [4, 2, 3, 1]
    assert indice.posts_da_tag("mar") == [2]
    assert indice.posts_da_tag("inexistente") == []


def test_editar_reindexa_e_a_tag_antiga_some():
    indice = IndiceTags()
    indice.indexar(1, {"saudade", "soneto"}, dias_atras(1))
    indice.indexar(1, {"soneto", "mar"}, dias_atras(1))
    assert indice.posts_da_tag("saudade") == []
    assert indice.posts_da_tag("soneto") == [1]
    assert indice.posts_da_tag("mar") == [1]
    assert ("saudade", 1) not in indice.trending(dias_atras(7))


def test_remover_tira_o_post_de_todas_as_tags_e_ignora_inexistente():
    indice = IndiceTags()
    indice.indexar(1, {"amor", "mar"}, dias_atras(2))
    indice.indexar(2, {"amor"}, dias_atras(1))
    indice.remover(1)
    indice.remover(99)
    assert indice.posts_da_tag("amor") == [2]
    assert indice.posts_da_tag("mar") == []
    assert indice.trending(dias_atras(7)) == [("amor", 1)]


def test_busca_ignora_acento_e_maiuscula():
    indice = IndiceTags()
    indice.indexar(1, {"Solidão"}, dias_atras(1))
    indice.indexar(2, extrair_tags("noite #solidão", "Haicai"), dias_atras(0))
    assert indice.posts_da_tag("solidao") == [2, 1]
    assert indice.posts_da_tag("SOLIDÃO") == [2, 1]
    assert indice.posts_da_tag("haicai") == [2]


def test_trending_respeita_a_janela_de_tempo():
    indice = IndiceTags()
    indice.indexar(1, {"velha"}, dias_atras(30))
    indice.indexar(2, {"velha"}, dias_atras(20))
    indice.indexar(3, {"nova"}, dias_atras(2))
    indice.indexar(4, {"limite"}, dias_atras(7))
    assert indice.trending(dias_atras(7)) == [("limite", 1), ("nova", 1)]


def test_trending_top_k_maior_contagem_e_empate_alfabetico():
    indice = IndiceTags()
    indice.indexar(1, {"mar", "amor", "noite"}, dias_atras(1))
    indice.indexar(2, {"mar", "amor"}, dias_atras(1))
    indice.indexar(3, {"mar", "chuva"}, dias_atras(1))
    indice.indexar(4, {"zumbido"}, dias_atras(1))
    assert indice.trending(dias_atras(7), k=3) == [
        ("mar", 3),
        ("amor", 2),
        ("chuva", 1),
    ]
    assert len(indice.trending(dias_atras(7))) == 5


def test_datas_naive_e_aware_comparam_como_utc():
    indice = IndiceTags()
    naive = datetime(2026, 11, 25, 10, 0)
    recife = timezone(timedelta(hours=-3))
    indice.indexar(1, {"mar"}, naive)
    indice.indexar(2, {"mar"}, datetime(2026, 11, 25, 8, 0, tzinfo=recife))
    assert indice.posts_da_tag("mar") == [2, 1]
    assert indice.trending(datetime(2026, 11, 25, 10, 30)) == [("mar", 1)]
    assert indice.trending(datetime(2026, 11, 25, 7, 0, tzinfo=recife)) == [("mar", 2)]


def test_reconstruir_zera_e_indexa_todos():
    indice = IndiceTags()
    indice.indexar(99, {"fantasma"}, dias_atras(1))
    indice.reconstruir(
        [
            (1, {"amor"}, dias_atras(2)),
            (2, {"amor", "mar"}, dias_atras(1)),
        ]
    )
    assert indice.posts_da_tag("fantasma") == []
    assert indice.posts_da_tag("amor") == [2, 1]
    assert indice.trending(dias_atras(7)) == [("amor", 2), ("mar", 1)]
