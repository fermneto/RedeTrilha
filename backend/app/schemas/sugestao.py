from app.schemas.pagina import Pagina
from app.schemas.user import UserOut


class SugestaoOut(UserOut):
    """Uma conta para seguir: o UserOut, quantos poemas a pessoa tem (a conta do
    perfil) e o começo do poema mais recente dela (None se só escreveu em rengas)."""

    poemas: int
    trecho: str | None


class SugestaoPage(Pagina[SugestaoOut]):
    pass
