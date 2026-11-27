from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.limites import POEMA_TITULO_MAX
from app.schemas.entrada import Entrada, IdDeEntrada
from app.schemas.idioma import IDIOMA_PADRAO, validar_idioma
from app.schemas.pagina import Pagina
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut

# As formas, na ordem dos seletores, com o rótulo de cada uma (o código guardado
# não tem acento). GET /preferencias/opcoes entrega os dois ao front.
ROTULOS_DAS_FORMAS = {
    "soneto": "soneto",
    "haicai": "haicai",
    "trova": "trova",
    "quadra": "quadra",
    "cordel": "cordel",
    "verso_livre": "verso livre",
    "prosa_poetica": "prosa poética",
    "outro": "outro",
}
FORMAS = list(ROTULOS_DAS_FORMAS)


def _validar_texto(texto: str | None) -> str:
    """Recusa poema em branco sem alterar o texto: as quebras de linha são sagradas."""
    if texto is None or not texto.strip():
        raise ValueError("o poema não pode ficar vazio")
    return texto


def _validar_forma(forma: str | None) -> str | None:
    if forma is not None and forma not in FORMAS:
        raise ValueError(f"forma deve ser uma de: {', '.join(FORMAS)}")
    return forma


class PostCreate(Entrada):
    titulo: str | None = Field(default=None, max_length=POEMA_TITULO_MAX)
    texto: str
    forma: str | None = None
    # ISO 639-1; null = língua desconhecida (o "outra" do compositor).
    idioma: str | None = IDIOMA_PADRAO
    # Com texto, é citação do poema `repost_de_id` (repost puro é POST /posts/{id}/repostar).
    repost_de_id: IdDeEntrada | None = None
    # Com texto, é citação da renga `renga_citada_id`. Um poema cita um poema ou uma renga.
    renga_citada_id: IdDeEntrada | None = None

    _texto = field_validator("texto")(_validar_texto)
    _forma = field_validator("forma")(_validar_forma)
    _idioma = field_validator("idioma")(validar_idioma)

    @model_validator(mode="after")
    def _cita_uma_coisa_so(self) -> "PostCreate":
        if self.repost_de_id is not None and self.renga_citada_id is not None:
            raise ValueError("o poema cita um poema ou uma renga, não os dois")
        return self


class PostOut(BaseModel):
    id: int
    autor_id: int
    titulo: str | None
    texto: str
    forma: str | None
    obra: str | None
    ano: int | None
    fonte: str | None
    idioma: str | None
    repost_de_id: int | None
    created_at: datetime
    updated_at: datetime
    autor: UserOut
    curtidas: int = 0
    comentarios: int = 0
    reposts: int = 0
    curti: bool = False
    repostei: bool = False
    repost_de: "PostOut | None" = None
    # Citação de um poema que o autor apagou: `repost_de` vem None.
    repost_removido: bool = False
    # Citação de um poema (ou de uma renga) de quem bloqueou quem vê: `repost_de`
    # (ou `renga_citada`) vem None ("poema indisponível").
    repost_indisponivel: bool = False
    # Citação de uma renga: o id e a renga, com as estrofes (um nível, como o `repost_de`).
    renga_citada_id: int | None = None
    renga_citada: RengaDetalhe | None = None
    tags: list[str] = []
    # Só no feed: quem repostou o poema (repost puro), quem repostou por último primeiro.
    repostado_por: list[UserOut] = []


class PostPage(Pagina[PostOut]):
    """Página de poemas (ver schemas/pagina.py)."""
