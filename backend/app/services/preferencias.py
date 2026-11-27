"""Preferências do onboarding: escolas, formas e região da pessoa (tudo opcional)."""

from sqlalchemy.orm import Session

from app.models.preferencia import Preferencia
from app.models.privacidade_dos_gostos import PrivacidadeDosGostos
from app.models.user import User
from app.schemas.escola import ESCOLAS
from app.schemas.post import ROTULOS_DAS_FORMAS
from app.schemas.preferencia import Limites, Opcao, OpcoesDePreferencias, Preferencias
from app.schemas.regiao import PAISES, UFS


def ler(db: Session, usuario: User) -> Preferencias:
    linha = db.get(Preferencia, usuario.id)
    prefs = Preferencias.model_validate(linha) if linha else Preferencias()
    privacidade = db.get(PrivacidadeDosGostos, usuario.id)
    prefs.mostrar_lugar = privacidade.mostrar_lugar if privacidade else True
    return prefs


def salvar(db: Session, usuario: User, dados: Preferencias) -> Preferencias:
    """Troca tudo (PUT). Idempotente."""
    linha = db.get(Preferencia, usuario.id) or Preferencia(user_id=usuario.id)
    linha.escolas = dados.escolas
    linha.formas = dados.formas
    linha.pais = dados.pais
    linha.uf = dados.uf
    db.add(linha)
    privacidade = db.get(PrivacidadeDosGostos, usuario.id)
    if privacidade:
        privacidade.mostrar_lugar = dados.mostrar_lugar
    elif not dados.mostrar_lugar:
        db.add(PrivacidadeDosGostos(user_id=usuario.id, mostrar_lugar=False))
    db.commit()
    return ler(db, usuario)


def publicas(db: Session, pessoa: User, quem_ve: User) -> Preferencias:
    """Os gostos como os outros veem no perfil: sem país e UF se a pessoa desligou
    "mostrar meu lugar no perfil". A própria pessoa vê tudo."""
    prefs = ler(db, pessoa)
    if pessoa.id != quem_ve.id and not prefs.mostrar_lugar:
        prefs.pais = None
        prefs.uf = None
    return prefs


def opcoes() -> OpcoesDePreferencias:
    return OpcoesDePreferencias(
        escolas=[Opcao(codigo=c, rotulo=r) for c, r in ESCOLAS.items()],
        formas=[Opcao(codigo=c, rotulo=r) for c, r in ROTULOS_DAS_FORMAS.items()],
        paises=sorted(PAISES),
        ufs=[Opcao(codigo=c, rotulo=r) for c, r in UFS.items()],
        limites=Limites(),
    )
