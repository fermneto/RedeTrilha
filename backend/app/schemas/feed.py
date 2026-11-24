from app.schemas.post import PostPage


class FeedPage(PostPage):
    """Página do feed: a PostPage mais o cursor da próxima página (None no fim)."""

    proximo_cursor: str | None = None
