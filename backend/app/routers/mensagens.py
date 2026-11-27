from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import tempo_real
from app.core.limites import INT4_MAX
from app.db import get_db
from app.deps import Id, Limite, get_current_user, id_de_quem_abre_o_stream
from app.models.user import User
from app.schemas.mensagem import (
    Aba,
    CaixaPage,
    ConversaCreate,
    ConversaDetalhe,
    LeituraIn,
    MensagemCreate,
    MensagemOut,
    MensagemPage,
    ResumoDeMensagens,
)
from app.services import mensagens as service

router = APIRouter(prefix="/mensagens", tags=["mensagens"])

IdDeMensagem = Annotated[int | None, Query(ge=0, le=INT4_MAX)]


@router.get("/stream")
async def stream(user_id: int = Depends(id_de_quem_abre_o_stream)):
    """Server-Sent Events: avisa mensagem nova, pedido, leitura e mudança de conversa.

    `async` e sem `get_db`: o stream fica aberto sem thread e sem conexão do pool.
    """
    return StreamingResponse(
        tempo_real.eventos(user_id),
        media_type="text/event-stream",
        headers=tempo_real.CABECALHOS_DO_STREAM,
    )


@router.get("/conversas", response_model=CaixaPage)
def caixa(
    aba: Aba = "conversas",
    cursor: str | None = None,
    limit: Limite = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.caixa(db, user, aba, cursor, limit)


@router.get("/resumo", response_model=ResumoDeMensagens)
def resumo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.resumo(db, user)


@router.post("/conversas", response_model=ConversaDetalhe)
def abrir_conversa(
    dados: ConversaCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.abrir(db, user, dados.username)


@router.get("/conversas/{conversa_id}", response_model=ConversaDetalhe)
def ler_conversa(
    conversa_id: Id,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.detalhe(db, user, conversa_id)


@router.get("/conversas/{conversa_id}/mensagens", response_model=MensagemPage)
def listar_mensagens(
    conversa_id: Id,
    antes: IdDeMensagem = None,
    depois: IdDeMensagem = None,
    limit: Limite = 30,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.mensagens(db, user, conversa_id, antes, depois, limit)


@router.post("/conversas/{conversa_id}/mensagens", response_model=MensagemOut, status_code=201)
def enviar(
    conversa_id: Id,
    dados: MensagemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.enviar(db, user, conversa_id, dados)


@router.post("/conversas/{conversa_id}/lida", status_code=204)
def marcar_lida(
    conversa_id: Id,
    dados: LeituraIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.marcar_lida(db, user, conversa_id, dados.ate)


@router.post("/conversas/{conversa_id}/aceitar", status_code=204)
def aceitar(conversa_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.aceitar(db, user, conversa_id)


@router.post("/conversas/{conversa_id}/recusar", status_code=204)
def recusar(conversa_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.recusar(db, user, conversa_id)


@router.post("/conversas/{conversa_id}/silenciar", status_code=204)
def silenciar(conversa_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.silenciar(db, user, conversa_id, True)


@router.delete("/conversas/{conversa_id}/silenciar", status_code=204)
def tirar_do_silencio(
    conversa_id: Id, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    service.silenciar(db, user, conversa_id, False)
