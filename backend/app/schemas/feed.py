from app.schemas.post import PostPage


class FeedPage(PostPage):
    """Página do feed: a PostPage mais o cursor da próxima página (None no fim).

    Com `cursor`, o `total` vem None, como na timeline do X; por offset, é o real.
    """

    total: int | None
    proximo_cursor: str | None = None
