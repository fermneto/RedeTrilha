from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.user import UserOut


class ComentarioCreate(BaseModel):
    texto: str
    parent_id: int | None = None

    @field_validator("texto")
    @classmethod
    def _texto_nao_vazio(cls, texto: str) -> str:
        """Recusa comentário em branco sem alterar o texto: as quebras de linha ficam."""
        if not texto.strip():
            raise ValueError("o comentário não pode ficar vazio")
        return texto


class ComentarioOut(BaseModel):
    id: int
    texto: str
    autor: UserOut
    parent_id: int | None
    created_at: datetime
    respostas: list["ComentarioOut"] = []


class ComentarioArvore(BaseModel):
    """A árvore inteira do poema, sem paginação: as raízes já trazem as respostas."""

    items: list[ComentarioOut]
