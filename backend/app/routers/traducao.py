from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.traducao import TraducaoOut, TraducaoPedido
from app.services import traducao as service

router = APIRouter(prefix="/posts", tags=["traducao"])


@router.post("/{post_id}/traduzir", response_model=TraducaoOut)
def traduzir(
    post_id: int,
    pedido: TraducaoPedido,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.traduzir(db, post_id, pedido.para)
