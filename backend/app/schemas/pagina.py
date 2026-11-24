from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Pagina(BaseModel, Generic[T]):
    """Padrão de paginação do projeto: toda listagem devolve isto."""

    items: list[T]
    total: int
    offset: int
    limit: int
