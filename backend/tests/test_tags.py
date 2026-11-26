from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.core.indice_tags import extrair_tags, mais_recente, representantes, top_k

AGORA = datetime(2026, 11, 25, 12, 0, tzinfo=UTC)


def dias_atras(n: int) -> datetime:
    return AGORA - timedelta(days=n)


@pytest.fixture()
def indice(client, criar_usuario):
    """O índice persistido (services/indice_tags.py) numa sessão do banco de teste.

    `indice.indexar(id, tags, criado_em)` grava (ou regrava) um poema com essas
    tags e o indexa, como o `posts.criar` faz.
    """
    from app.db import SessionLocal
    from app.models.post import Post
    from app.services import indice_tags

    autor_id = criar_usuario("ana")
    with SessionLocal() as db:

        class Indice:
            def indexar(self, post_id: int, tags: set[str], criado_em: datetime) -> None:
                post = db.get(Post, post_id) or Post(id=post_id, autor_id=autor_id)
                post.tags_extras, post.created_at = sorted(tags), criado_em
                db.add(post)
                db.flush()
                indice_tags.indexar(db, post)

            def remover(self, post_id: int) -> None:
                indice_tags.remover(db, [post_id])

            def posts_da_tag(self, tag: str) -> list[int]:
                return indice_tags.posts_da_tag(db, tag, 0, 100)[0]

            def total_da_tag(self, tag: str) -> int:
                return indice_tags.posts_da_tag(db, tag, 0, 100)[1]

            def trending(self, desde: datetime, k: int = 5) -> list[tuple[str, int]]:
                return indice_tags.trending(db, desde, k)

            def representantes(self, tags: list[str]) -> dict[str, int | None]:
                return indice_tags.representantes(db, tags)

            def buscar(self, prefixo: str, k: int = 5) -> list[tuple[str, int]]:
                return indice_tags.buscar(db, prefixo, k)

        yield Indice()


def test_extrai_hashtags_casefold_sem_acento_e_sem_duplicar():
    texto = "Chove em João Pessoa\n#Saudade #solidão\n#saudade de novo"
    assert extrair_tags(texto, None) == {"saudade", "solidao"}


def test_forma_entra_como_tag():
    assert extrair_tags("sem hashtag nenhuma", "haicai") == {"haicai"}


def test_forma_outro_nao_vira_tag_mas_a_hashtag_outro_sim():
    assert extrair_tags("sem hashtag nenhuma", "outro") == set()
    assert extrair_tags("um verso #outro", "outro") == {"outro"}
    assert extrair_tags("#mar", "soneto") == {"mar", "soneto"}


def test_top_k_maior_contagem_e_empate_alfabetico():
    contagens = [("noite", 1), ("mar", 3), ("chuva", 1), ("amor", 2), ("zumbido", 1)]
    assert top_k(contagens, 3) == [("mar", 3), ("amor", 2), ("chuva", 1)]
    assert top_k([], 5) == []


def test_mais_recente_e_representantes_puros():
    mar = [(1, dias_atras(1)), (5, dias_atras(3)), (3, dias_atras(1))]
    assert mais_recente(mar) == 3
    assert mais_recente(mar, frozenset({3})) == 1
    assert mais_recente(mar, frozenset({1, 3, 5})) == 3
    assert mais_recente([]) is None
    assert representantes({"mar": mar, "sal": [(3, dias_atras(1))]}, ["mar", "sal", "nada"]) == {
        "mar": 3, "sal": 3, "nada": None,
    }


def test_posts_da_tag_mais_novo_primeiro_e_empate_pelo_maior_id(indice):
    indice.indexar(1, {"amor"}, dias_atras(3))
    indice.indexar(2, {"amor", "mar"}, dias_atras(1))
    indice.indexar(3, {"amor"}, dias_atras(2))
    indice.indexar(4, {"amor"}, dias_atras(1))
    assert indice.posts_da_tag("amor") == [4, 2, 3, 1]
    assert indice.posts_da_tag("mar") == [2]
    assert indice.posts_da_tag("inexistente") == []


def test_editar_reindexa_e_a_tag_antiga_some(indice):
    indice.indexar(1, {"saudade", "soneto"}, dias_atras(1))
    indice.indexar(1, {"soneto", "mar"}, dias_atras(1))
    assert indice.posts_da_tag("saudade") == []
    assert indice.posts_da_tag("soneto") == [1]
    assert indice.posts_da_tag("mar") == [1]
    assert ("saudade", 1) not in indice.trending(dias_atras(7))


def test_remover_tira_o_post_de_todas_as_tags_e_ignora_inexistente(indice):
    indice.indexar(1, {"amor", "mar"}, dias_atras(2))
    indice.indexar(2, {"amor"}, dias_atras(1))
    indice.remover(1)
    indice.remover(99)
    assert indice.posts_da_tag("amor") == [2]
    assert indice.posts_da_tag("mar") == []
    assert indice.trending(dias_atras(7)) == [("amor", 1)]


def test_busca_ignora_acento_e_maiuscula(indice):
    indice.indexar(1, {"Solidão"}, dias_atras(1))
    indice.indexar(2, extrair_tags("noite #solidão", "Haicai"), dias_atras(0))
    assert indice.posts_da_tag("solidao") == [2, 1]
    assert indice.posts_da_tag("SOLIDÃO") == [2, 1]
    assert indice.posts_da_tag("haicai") == [2]


def test_trending_respeita_a_janela_de_tempo(indice):
    indice.indexar(1, {"velha"}, dias_atras(30))
    indice.indexar(2, {"velha"}, dias_atras(20))
    indice.indexar(3, {"nova"}, dias_atras(2))
    indice.indexar(4, {"limite"}, dias_atras(7))
    assert indice.trending(dias_atras(7)) == [("limite", 1), ("nova", 1)]


def test_trending_top_k_maior_contagem_e_empate_alfabetico(indice):
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


def test_datas_naive_e_aware_comparam_como_utc(indice):
    naive = datetime(2026, 11, 25, 10, 0)
    recife = timezone(timedelta(hours=-3))
    indice.indexar(1, {"mar"}, naive)
    indice.indexar(2, {"mar"}, datetime(2026, 11, 25, 8, 0, tzinfo=recife))
    assert indice.posts_da_tag("mar") == [2, 1]
    assert indice.trending(datetime(2026, 11, 25, 10, 30)) == [("mar", 1)]
    assert indice.trending(datetime(2026, 11, 25, 7, 0, tzinfo=recife)) == [("mar", 2)]


def test_representantes_um_poema_diferente_por_tag(indice):
    indice.indexar(1, {"mar", "sal"}, dias_atras(3))
    indice.indexar(2, {"mar", "chuva"}, dias_atras(2))
    indice.indexar(3, {"mar", "sal", "chuva"}, dias_atras(1))
    indice.indexar(4, {"lua"}, dias_atras(1))
    assert indice.representantes(["mar", "chuva", "sal", "lua", "nada"]) == {
        "mar": 3, "chuva": 2, "sal": 1, "lua": 4, "nada": None,
    }
    # sem poema livre, repete o mais novo
    assert indice.representantes(["lua", "lua"]) == {"lua": 4}


def test_representantes_acha_o_livre_mesmo_com_muitos_poemas_por_tag(indice):
    for post_id in range(1, 9):
        indice.indexar(post_id, {"mar", "sal", "lua"}, dias_atras(post_id))
    assert indice.representantes(["mar", "sal", "lua"]) == {"mar": 1, "sal": 2, "lua": 3}


def test_buscar_por_prefixo_mais_usada_primeiro(indice):
    indice.indexar(1, {"saudade", "sal"}, dias_atras(1))
    indice.indexar(2, {"saudade"}, dias_atras(200))
    indice.indexar(3, {"sabia", "mar"}, dias_atras(1))
    assert indice.buscar("#Sa") == [("saudade", 2), ("sabia", 1), ("sal", 1)]
    assert indice.buscar("sa", k=1) == [("saudade", 2)]
    assert indice.buscar("SAÚ") == [("saudade", 2)]
    assert indice.buscar("dade") == []


def test_buscar_ignora_o_sublinhado(indice):
    # A tela mostra #versolivre; digitar com ou sem o "_" acha a mesma tag.
    indice.indexar(1, {"verso_livre"}, dias_atras(1))
    indice.indexar(2, {"versoxlivre"}, dias_atras(1))
    assert indice.buscar("#versolivre") == [("verso_livre", 1)]
    assert indice.buscar("verso_l") == [("verso_livre", 1)]
    assert indice.buscar("verso_") == [("verso_livre", 1), ("versoxlivre", 1)]


def test_buscar_o_sublinhado_nao_e_curinga(indice):
    indice.indexar(1, {"verso_livre"}, dias_atras(1))
    indice.indexar(2, {"versoxlivre"}, dias_atras(1))
    assert indice.buscar("versoxl") == [("versoxlivre", 1)]


def test_posts_da_tag_ignora_o_sublinhado(indice):
    indice.indexar(1, {"noite_fria"}, dias_atras(2))
    indice.indexar(2, {"noite_fria"}, dias_atras(1))
    assert indice.posts_da_tag("noitefria") == [2, 1]
    assert indice.posts_da_tag("#NoiteFria") == [2, 1]
    assert indice.posts_da_tag("noite_fria") == [2, 1]
    assert indice.posts_da_tag("noite") == []


def test_tags_que_so_diferem_pelo_sublinhado_vem_juntas_e_o_poema_uma_vez(indice):
    indice.indexar(1, {"noite_fria"}, dias_atras(3))
    indice.indexar(2, {"noitefria"}, dias_atras(2))
    indice.indexar(3, {"noite_fria", "noitefria"}, dias_atras(1))
    assert indice.posts_da_tag("noitefria") == [3, 2, 1]
    assert indice.total_da_tag("noite_fria") == 3
    assert indice.buscar("noitef") == [("noite_fria", 2), ("noitefria", 2)]


def test_buscar_vazio_ou_so_simbolos_nao_acha_nada(indice):
    indice.indexar(1, {"mar"}, dias_atras(1))
    assert indice.buscar("") == []
    assert indice.buscar("#") == []
    assert indice.buscar("  !") == []
