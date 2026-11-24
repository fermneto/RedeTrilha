from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.pagina import Pagina
from app.schemas.post import PostOut
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut


class PoemaNoFeed(PostOut):
    """Um poema no feed: o PostOut de sempre, com `tipo` para distinguir da renga."""

    tipo: Literal["poema"] = "poema"


class RengaNoFeed(BaseModel):
    """Uma renga no feed, como um repost no X: sobe com a atividade mais recente.

    `atividade` é a da ocorrência mais recente, e com `por` monta o rótulo:
    - "abriu": "fulano abriu uma renga" (`por` = [o criador]; qualquer estrofe
      do criador conta como abertura);
    - "escreveu": "fulano escreveu uma estrofe" (`por` = os seguidos, ou a
      própria pessoa, que escreveram estrofes, menos o criador, quem escreveu
      por último primeiro);
    - "encerrou": "fulano encerrou a renga" (`por` = [o criador]).
    """

    tipo: Literal["renga"] = "renga"
    renga: RengaDetalhe
    atividade: Literal["abriu", "escreveu", "encerrou"]
    por: list[UserOut]


ItemDoFeed = Annotated[PoemaNoFeed | RengaNoFeed, Field(discriminator="tipo")]


class FeedPage(Pagina[ItemDoFeed]):
    """Página do feed: poemas e rengas, mais o cursor da próxima página (None no fim).

    Com `cursor`, o `total` vem None, como na timeline do X; por offset, é o real.
    """

    total: int | None
    proximo_cursor: str | None = None
