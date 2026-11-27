from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from app.core.limites import MENSAGEM_MAX_CARACTERES
from app.schemas.entrada import IdDeEntrada, Int4
from app.schemas.post import PostOut
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut

# Anti-spam: mensagens por pessoa no último minuto, contadas no banco.
MENSAGENS_POR_MINUTO = 30

Situacao = Literal["caixa", "pedido", "recusada"]
Aba = Literal["conversas", "pedidos"]


class ConversaCreate(BaseModel):
    """Abrir (ou achar) a conversa com alguém."""

    username: str


class MensagemCreate(BaseModel):
    """Texto, um poema (`post_id`) ou uma renga (`renga_id`), com ou sem texto. O
    texto é gravado como veio. Uma mensagem leva um poema ou uma renga, não os dois."""

    texto: str = ""
    post_id: IdDeEntrada | None = None
    renga_id: IdDeEntrada | None = None

    @model_validator(mode="after")
    def _texto_ou_poema(self) -> "MensagemCreate":
        if len(self.texto) > MENSAGEM_MAX_CARACTERES:
            raise ValueError(f"a mensagem tem até {MENSAGEM_MAX_CARACTERES} caracteres")
        if self.post_id is not None and self.renga_id is not None:
            raise ValueError("a mensagem leva um poema ou uma renga, não os dois")
        if not self.texto.strip() and self.post_id is None and self.renga_id is None:
            raise ValueError("a mensagem não pode ficar vazia")
        return self


class LeituraIn(BaseModel):
    """Até que mensagem a pessoa leu; sem `ate`, até a última."""

    ate: Int4 | None = None


class MensagemOut(BaseModel):
    id: int
    conversa_id: int
    autor_id: int
    texto: str
    # O poema compartilhado; null se não há poema ou se ele foi apagado.
    post: PostOut | None
    # O poema compartilhado foi apagado pelo autor ("poema removido pelo autor").
    post_removido: bool
    # A renga compartilhada; null se a mensagem não leva renga.
    renga: RengaDetalhe | None = None
    created_at: datetime


class MensagemPage(BaseModel):
    """Mensagens em ordem cronológica (a mais antiga primeiro).

    Sem `depois`, é a janela mais recente (ou a anterior a `antes`), e
    `proximo_cursor` é o `antes` da janela mais antiga, null no começo da conversa.
    Com `depois`, são as seguintes, e `proximo_cursor` é o próximo `depois`, null
    quando já chegou à última.
    """

    items: list[MensagemOut]
    limit: int
    proximo_cursor: str | None


class ConversaOut(BaseModel):
    """Uma linha da caixa: com quem, a última mensagem e quantas faltam ler."""

    id: int
    outro: UserOut
    situacao: Situacao
    silenciada: bool
    ultima_mensagem: MensagemOut | None
    nao_lidas: int


class ConversaDetalhe(BaseModel):
    id: int
    outro: UserOut
    situacao: Situacao
    silenciada: bool
    bloqueei: bool
    pode_responder: bool
    # Por que não dá para responder (bloqueio), em português.
    motivo: str | None
    ultima_lida_id: int
    # Até que mensagem o outro leu ("visto"); null enquanto a conversa é um pedido
    # para ele (ler um pedido não avisa quem mandou).
    visto_ate: int | None


class CaixaPage(BaseModel):
    """Conversas pela última atividade, a mais recente primeiro, por cursor."""

    items: list[ConversaOut]
    limit: int
    proximo_cursor: str | None


class ResumoDeMensagens(BaseModel):
    """O contador da navegação: conversas não lidas (sem as silenciadas) e pedidos novos."""

    nao_lidas: int
    pedidos: int
