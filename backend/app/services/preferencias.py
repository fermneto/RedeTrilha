"""Preferências do onboarding: escolas, formas e região da pessoa (tudo opcional)."""

from sqlalchemy.orm import Session

from app.models.preferencia import Preferencia
from app.models.user import User
from app.schemas.escola import ESCOLAS
from app.schemas.post import FORMAS
from app.schemas.preferencia import Opcao, OpcoesDePreferencias, Preferencias
from app.schemas.regiao import PAISES, UFS


def ler(db: Session, usuario: User) -> Preferencias:
    linha = db.get(Preferencia, usuario.id)
    return Preferencias.model_validate(linha) if linha else Preferencias()


def salvar(db: Session, usuario: User, dados: Preferencias) -> Preferencias:
    """Troca tudo (PUT). Idempotente."""
    linha = db.get(Preferencia, usuario.id) or Preferencia(user_id=usuario.id)
    linha.escolas = dados.escolas
    linha.formas = dados.formas
    linha.pais = dados.pais
    linha.uf = dados.uf
    db.add(linha)
    db.commit()
    return Preferencias.model_validate(linha)


def opcoes() -> OpcoesDePreferencias:
    return OpcoesDePreferencias(
        escolas=[Opcao(codigo=c, rotulo=r) for c, r in ESCOLAS.items()],
        formas=list(FORMAS),
        paises=sorted(PAISES),
        ufs=[Opcao(codigo=c, rotulo=r) for c, r in UFS.items()],
    )
