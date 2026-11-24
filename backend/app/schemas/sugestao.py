from app.schemas.acervo import PoetaDoAcervo
from app.schemas.pagina import Pagina


class SugestaoOut(PoetaDoAcervo):
    """Um cartão de quem seguir: o mesmo do Acervo (contagens e `sigo`, sempre
    False aqui) mais as escolas da conta (as do JSON do consagrado, ou as que o
    poeta comum marcou nas preferências)."""

    escolas: list[str]


class SugestaoPage(Pagina[SugestaoOut]):
    pass
