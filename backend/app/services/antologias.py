from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.antologia import Antologia, AntologiaPoema
from app.models.post import Post
from app.models.user import User
from app.schemas.antologia import AntologiaCreate, AntologiaDetalhe, AntologiaOut
from app.schemas.user import UserOut
from app.services import posts as posts_service
from app.services.users import buscar_por_username


def criar(db: Session, dono: User, dados: AntologiaCreate) -> AntologiaOut:
    antologia = Antologia(dono_id=dono.id, **dados.model_dump())
    db.add(antologia)
    db.commit()
    db.refresh(antologia)
    return _para_saida(antologia, qtd=0)


def listar_do_usuario(
    db: Session, dono: User, offset: int, limit: int
) -> tuple[list[AntologiaOut], int]:
    """Antologias de um dono, a mais nova primeiro; `qtd` de todas numa query só."""
    total = db.scalar(select(func.count()).where(Antologia.dono_id == dono.id)) or 0
    antologias = list(
        db.scalars(
            select(Antologia)
            .where(Antologia.dono_id == dono.id)
            .order_by(Antologia.created_at.desc(), Antologia.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    qtds = _contar_poemas(db, [antologia.id for antologia in antologias])
    return [_para_saida(a, qtd=qtds.get(a.id, 0)) for a in antologias], total


def listar_de(
    db: Session, username: str, offset: int, limit: int
) -> tuple[list[AntologiaOut], int]:
    return listar_do_usuario(db, buscar_por_username(db, username), offset, limit)


def detalhar(db: Session, usuario: User, antologia_id: int) -> AntologiaDetalhe:
    """Dados da antologia + poemas na ordem de inserção, como PostOut."""
    antologia = buscar(db, antologia_id)
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


def buscar(db: Session, antologia_id: int) -> Antologia:
    antologia = db.get(Antologia, antologia_id)
    if antologia is None:
        raise HTTPException(status_code=404, detail="antologia não encontrada")
    return antologia


def _buscar_do_dono(db: Session, usuario: User, antologia_id: int) -> Antologia:
    antologia = buscar(db, antologia_id)
    if antologia.dono_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o dono pode alterar a antologia")
    return antologia


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
        created_at=antologia.created_at,
        qtd=qtd,
    )
