from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.pagina import Pagina
from app.schemas.post import PostOut
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut


class PoemaNoFeed(PostOut):
    """Um poema no feed: o PostOut de sempre, com `tipo` para distinguir da renga.

    Só no "Para você", como o "repostado por" do X: `subiu_por` diz se o poema
    subiu por um comentário ("comentario") ou por uma crítica ancorada nos versos
    ("critica"), e `comentado_por` lista quem comentou ou criticou, quem fez por
    último primeiro. No feed Seguindo e no perfil, ficam None e vazio.

    Na continuação do feed infinito (`services/feed_infinito.py`, nas duas abas),
    `subiu_por` "curtidas" marca um dos mais curtidos da comunidade: o único item
    que pode repetir o que a sessão já recebeu.
    """

    tipo: Literal["poema"] = "poema"
    subiu_por: Literal["comentario", "critica", "curtidas"] | None = None
    comentado_por: list[UserOut] = []


class RengaNoFeed(BaseModel):
    """Uma renga no feed, como um repost no X: sobe com a atividade mais recente.

    `atividade` é a da ocorrência mais recente, e com `por` monta o rótulo:
    - "abriu": "fulano abriu uma renga" (`por` = [o criador]; qualquer estrofe
      do criador conta como abertura);
    - "escreveu": "fulano escreveu uma estrofe" (`por` = os seguidos, ou a
      própria pessoa, que escreveram estrofes, menos o criador, quem escreveu
      por último primeiro);
    - "encerrou": "fulano encerrou a renga" (`por` = [o criador]);
    - "repostou": "fulano repostou a renga" (`por` = os seguidos, ou a própria
      pessoa, que repostaram, quem repostou por último primeiro), como o
      `repostado_por` de um poema.
    """

    tipo: Literal["renga"] = "renga"
    renga: RengaDetalhe
    atividade: Literal["abriu", "escreveu", "encerrou", "repostou"]
    por: list[UserOut]


ItemDoFeed = Annotated[PoemaNoFeed | RengaNoFeed, Field(discriminator="tipo")]


class FeedPage(Pagina[ItemDoFeed]):
    """Página do feed: poemas e rengas, mais o cursor da próxima página (None no fim).

    Com `cursor`, o `total` vem None, como na timeline do X; por offset, é o real.

    O Seguindo e o "Para você" não têm fim (`services/feed_infinito.py`): o
    `proximo_cursor` só vem None com o banco sem poemas. `fim_em` é a posição,
    nesta página, onde acabou o que é do feed (no Seguindo, o de quem a pessoa
    segue; no "Para você", o inédito): dali em diante, e nas páginas seguintes,
    vem a continuação. Só na página da virada; nas outras, e no perfil, None.
    """

    total: int | None
    proximo_cursor: str | None = None
    fim_em: int | None = None
