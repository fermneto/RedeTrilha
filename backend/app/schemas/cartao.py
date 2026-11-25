"""Cartão de compartilhamento: o mínimo que o link do Verso mostra no WhatsApp, no X
ou no Telegram (o front desenha a imagem em lib/cartaoServidor.tsx).

São as únicas leituras sem login, então só levam o que o cartão mostra: nada de
contagens de curtidas, comentários ou seguidores, nada de quem pede, nada de
rascunho nem de antologia privada.
"""

from pydantic import BaseModel


class AutorDoCartao(BaseModel):
    username: str
    name: str
    consagrado: bool
    nascimento: int | None
    morte: int | None


class CartaoPoema(BaseModel):
    id: int
    # O título sem marcas de formatação; None quando o poema não tem.
    titulo: str | None
    # Os primeiros versos sem marcas, com as quebras e os recuos, a partir do
    # primeiro verso não vazio; `continua` diz se o poema segue depois deles.
    versos: list[str]
    continua: bool
    idioma: str | None
    autor: AutorDoCartao


class CartaoUsuario(AutorDoCartao):
    bio: str
    avatar_url: str
    # Poemas autorais, como no perfil (sem os reposts puros, mais uma por renga).
    poemas: int


class CartaoRenga(BaseModel):
    id: int
    titulo: str
    autores: list[AutorDoCartao]
    versos: list[str]
    continua: bool


class PoemaDaAntologia(BaseModel):
    titulo: str | None
    # O primeiro verso, para o poema sem título.
    primeiro_verso: str
    autor: AutorDoCartao


class CartaoAntologia(BaseModel):
    id: int
    nome: str
    descricao: str | None
    dono: AutorDoCartao
    qtd: int
    # Os primeiros poemas, na ordem da antologia.
    poemas: list[PoemaDaAntologia]
