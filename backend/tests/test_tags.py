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


def test_forma_outro_nao_vira_tag_mas_a_hashtag_outro_sim():
    assert extrair_tags("sem hashtag nenhuma", "outro") == set()
    assert extrair_tags("um verso #outro", "outro") == {"outro"}
    assert extrair_tags("#mar", "soneto") == {"mar", "soneto"}


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


def test_mais_recente_pega_o_poema_mais_novo_da_tag():
    indice = IndiceTags()
    indice.indexar(1, {"mar"}, dias_atras(1))
    indice.indexar(5, {"mar"}, dias_atras(3))
    indice.indexar(3, {"mar"}, dias_atras(1))
    assert indice.mais_recente("Mar") == 3
    assert indice.mais_recente("mar", frozenset({3})) == 1
    assert indice.mais_recente("mar", frozenset({1, 3, 5})) == 3
    assert indice.mais_recente("inexistente") is None


def test_representantes_um_poema_diferente_por_tag():
    indice = IndiceTags()
    indice.indexar(1, {"mar", "sal"}, dias_atras(3))
    indice.indexar(2, {"mar", "chuva"}, dias_atras(2))
    indice.indexar(3, {"mar", "sal", "chuva"}, dias_atras(1))
    indice.indexar(4, {"lua"}, dias_atras(1))
    assert indice.representantes(["mar", "chuva", "sal", "lua", "nada"]) == {
        "mar": 3, "chuva": 2, "sal": 1, "lua": 4, "nada": None,
    }
    # sem poema livre, repete o mais novo
    assert indice.representantes(["lua", "lua"]) == {"lua": 4}


def test_buscar_por_prefixo_mais_usada_primeiro():
    indice = IndiceTags()
    indice.indexar(1, {"saudade", "sal"}, dias_atras(1))
    indice.indexar(2, {"saudade"}, dias_atras(200))
    indice.indexar(3, {"sabia", "mar"}, dias_atras(1))
    assert indice.buscar("#Sa") == [("saudade", 2), ("sabia", 1), ("sal", 1)]
    assert indice.buscar("sa", k=1) == [("saudade", 2)]
    assert indice.buscar("SAÚ") == [("saudade", 2)]
    assert indice.buscar("dade") == []


def test_buscar_vazio_ou_so_simbolos_nao_acha_nada():
    indice = IndiceTags()
    indice.indexar(1, {"mar"}, dias_atras(1))
    assert indice.buscar("") == []
    assert indice.buscar("#") == []
    assert indice.buscar("  !") == []
