from fastapi import HTTPException
from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.models.antologia import Antologia, AntologiaPoema
from app.models.post import Post
from app.models.user import User
from app.schemas.antologia import (
    AntologiaCreate,
    AntologiaDetalhe,
    AntologiaMarcada,
    AntologiaMarcadaPage,
    AntologiaOut,
    AntologiaPage,
    AntologiaUpdate,
)
from app.schemas.user import UserOut
from app.services import bloqueios
from app.services import posts as posts_service
from app.services.users import buscar_por_username


def criar(db: Session, dono: User, dados: AntologiaCreate) -> AntologiaOut:
    antologia = Antologia(dono_id=dono.id, **dados.model_dump())
    db.add(antologia)
    db.commit()
    db.refresh(antologia)
    return _para_saida(antologia, qtd=0)


def editar(
    db: Session, usuario: User, antologia_id: int, dados: AntologiaUpdate
) -> AntologiaOut:
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(antologia, campo, valor)
    db.commit()
    db.refresh(antologia)
    return _para_saida(antologia, qtd=_contar_poemas(db, [antologia.id]).get(antologia.id, 0))


def apagar(db: Session, usuario: User, antologia_id: int) -> None:
    """Apaga a antologia e os vínculos com os poemas (os poemas continuam)."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    db.execute(delete(AntologiaPoema).where(AntologiaPoema.antologia_id == antologia.id))
    db.delete(antologia)
    db.commit()


def listar_minhas(db: Session, usuario: User, offset: int, limit: int) -> AntologiaPage:
    """Todas as antologias do usuário atual, privadas inclusive."""
    return _listar(db, usuario, offset, limit, so_publicas=False)


def listar_minhas_marcando(
    db: Session, usuario: User, post_id: int, offset: int, limit: int
) -> AntologiaMarcadaPage:
    """As minhas antologias, cada uma dizendo se o poema está nela (`contem`).

    O `contem` vem na mesma query da página (EXISTS correlacionado), sem um
    pedido por antologia. Repost puro conta como o original, como em curtir e
    comentar; 404 se o post não existe.
    """
    original_id = posts_service.original_de(db, post_id).id
    contem = (
        exists()
        .where(
            AntologiaPoema.antologia_id == Antologia.id,
            AntologiaPoema.post_id == original_id,
        )
        .label("contem")
    )
    filtros = _filtros(usuario, so_publicas=False)
    total = db.scalar(select(func.count()).where(*filtros)) or 0
    linhas = db.execute(
        select(Antologia, contem).where(*filtros).order_by(*_ORDEM).offset(offset).limit(limit)
    ).all()
    qtds = _contar_poemas(db, [antologia.id for antologia, _ in linhas])
    items = [
        AntologiaMarcada(**_para_saida(a, qtd=qtds.get(a.id, 0)).model_dump(), contem=c)
        for a, c in linhas
    ]
    return AntologiaMarcadaPage(items=items, total=total, offset=offset, limit=limit)


def listar_de(
    db: Session, usuario: User, username: str, offset: int, limit: int
) -> AntologiaPage:
    """Antologias de alguém; as privadas só aparecem para o próprio dono. Com bloqueio
    (services/bloqueios.py): 404 para quem o dono bloqueou e vazio para quem bloqueou o dono."""
    dono = buscar_por_username(db, username)
    bloqueios.garantir_que_ve(db, usuario.id, dono.id, "usuário não encontrado")
    if bloqueios.bloqueou(db, usuario.id, dono.id):
        return AntologiaPage(items=[], total=0, offset=offset, limit=limit)
    return _listar(db, dono, offset, limit, so_publicas=dono.id != usuario.id)


def detalhar(db: Session, usuario: User, antologia_id: int) -> AntologiaDetalhe:
    """Dados da antologia + poemas na ordem de inserção, como PostOut."""
    antologia = _buscar_visivel(db, usuario, antologia_id)
    posts = list(
        db.scalars(
            select(Post)
            .join(AntologiaPoema, AntologiaPoema.post_id == Post.id)
            .where(AntologiaPoema.antologia_id == antologia_id)
            .order_by(AntologiaPoema.posicao, AntologiaPoema.id)
        )
    )
    poemas = posts_service.para_saidas(db, posts, usuario)
    return AntologiaDetalhe(
        **_para_saida(antologia, qtd=len(poemas)).model_dump(), poemas=poemas
    )


def adicionar_poema(db: Session, usuario: User, antologia_id: int, post_id: int) -> None:
    """Idempotente: adicionar um poema que já está na antologia não faz nada."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    posts_service.buscar(db, post_id)
    ja_esta = db.scalar(
        select(AntologiaPoema).where(
            AntologiaPoema.antologia_id == antologia.id,
            AntologiaPoema.post_id == post_id,
        )
    )
    if ja_esta is not None:
        return
    ultima = db.scalar(
        select(func.max(AntologiaPoema.posicao)).where(
            AntologiaPoema.antologia_id == antologia.id
        )
    )
    db.add(
        AntologiaPoema(
            antologia_id=antologia.id, post_id=post_id, posicao=(ultima or 0) + 1
        )
    )
    db.commit()


def remover_poema(db: Session, usuario: User, antologia_id: int, post_id: int) -> None:
    """Idempotente: tirar um poema que não está na antologia não faz nada."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    db.execute(
        delete(AntologiaPoema).where(
            AntologiaPoema.antologia_id == antologia.id,
            AntologiaPoema.post_id == post_id,
        )
    )
    db.commit()


def _buscar_visivel(db: Session, usuario: User, antologia_id: int) -> Antologia:
    """404 se não existe ou se é privada de outra pessoa (não revela que existe)."""
    antologia = db.get(Antologia, antologia_id)
    if antologia is None or (not antologia.publica and antologia.dono_id != usuario.id):
        raise HTTPException(status_code=404, detail="antologia não encontrada")
    return antologia


def _buscar_do_dono(db: Session, usuario: User, antologia_id: int) -> Antologia:
    antologia = _buscar_visivel(db, usuario, antologia_id)
    if antologia.dono_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o dono pode alterar a antologia")
    return antologia


# A mais nova primeiro; o id desempata antologias criadas no mesmo instante.
_ORDEM = (Antologia.created_at.desc(), Antologia.id.desc())


def _filtros(dono: User, so_publicas: bool) -> list:
    filtros = [Antologia.dono_id == dono.id]
    if so_publicas:
        filtros.append(Antologia.publica.is_(True))
    return filtros


def _listar(
    db: Session, dono: User, offset: int, limit: int, so_publicas: bool
) -> AntologiaPage:
    """Antologias de um dono, a mais nova primeiro; `qtd` de todas numa query só."""
    filtros = _filtros(dono, so_publicas)
    total = db.scalar(select(func.count()).where(*filtros)) or 0
    antologias = list(
        db.scalars(select(Antologia).where(*filtros).order_by(*_ORDEM).offset(offset).limit(limit))
    )
    qtds = _contar_poemas(db, [antologia.id for antologia in antologias])
    items = [_para_saida(a, qtd=qtds.get(a.id, 0)) for a in antologias]
    return AntologiaPage(items=items, total=total, offset=offset, limit=limit)


def _contar_poemas(db: Session, antologia_ids: list[int]) -> dict[int, int]:
    if not antologia_ids:
        return {}
    linhas = db.execute(
        select(AntologiaPoema.antologia_id, func.count())
        .where(AntologiaPoema.antologia_id.in_(antologia_ids))
        .group_by(AntologiaPoema.antologia_id)
    )
    return dict(linhas.all())


def _para_saida(antologia: Antologia, qtd: int) -> AntologiaOut:
    return AntologiaOut(
        id=antologia.id,
        dono_id=antologia.dono_id,
        dono=UserOut.model_validate(antologia.dono),
        nome=antologia.nome,
        descricao=antologia.descricao,
        publica=antologia.publica,
        created_at=antologia.created_at,
        qtd=qtd,
    )
