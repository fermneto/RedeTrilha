from pydantic import BaseModel


class BloqueioOut(BaseModel):
    """Se eu bloqueei a pessoa (o perfil mostra "Desbloquear")."""

    bloqueei: bool
