from fastapi import APIRouter

from app.schemas.oficina import AnaliseOut, AnalisePedido
from app.services import oficina as service

router = APIRouter(prefix="/oficina", tags=["oficina"])


@router.post("/analise", response_model=AnaliseOut)
def analise(pedido: AnalisePedido):
    """Sílabas poéticas e rimas de um rascunho. Sem login e sem banco: nada é gravado."""
    return service.analisar_rascunho(pedido.texto, pedido.forma)
