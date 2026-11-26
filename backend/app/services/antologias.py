from fastapi import HTTPException
from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.antologia import Antologia, AntologiaPoema, AntologiaRenga
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
    ItemDaOrdem,
)
from app.schemas.user import UserOut
from app.services import bloqueios
from app.services import posts as posts_service
from app.services import rengas as rengas_service
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
    """Apaga a antologia e os vínculos com os poemas e as rengas (eles continuam)."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    db.execute(delete(AntologiaPoema).where(AntologiaPoema.antologia_id == antologia.id))
    db.execute(delete(AntologiaRenga).where(AntologiaRenga.antologia_id == antologia.id))
    db.delete(antologia)
    db.commit()


def listar_minhas(db: Session, usuario: User, offset: int, limit: int) -> AntologiaPage:
    """Todas as antologias do usuário atual, privadas inclusive."""
    return _listar(db, usuario, offset, limit, so_publicas=False)


def listar_minhas_marcando(
    db: Session,
    usuario: User,
    post_id: int | None,
    renga_id: int | None,
    offset: int,
    limit: int,
) -> AntologiaMarcadaPage:
    """As minhas antologias, cada uma dizendo se o poema (`post_id`) ou a renga
    (`renga_id`) está nela (`contem`); os dois juntos → 422.

    O `contem` vem na mesma query da página (EXISTS correlacionado), sem um
    pedido por antologia. Repost puro conta como o original, como em curtir e
    comentar; 404 se o post ou a renga não existe.
    """
    if post_id is not None and renga_id is not None:
        raise HTTPException(status_code=422, detail="peça post_id ou renga_id, não os dois")
    if renga_id is not None:
        renga = rengas_service.buscar(db, renga_id)
        contem = exists().where(
            AntologiaRenga.antologia_id == Antologia.id, AntologiaRenga.renga_id == renga.id
        )
    else:
        original_id = posts_service.original_de(db, post_id).id
        contem = exists().where(
            AntologiaPoema.antologia_id == Antologia.id, AntologiaPoema.post_id == original_id
        )
    contem = contem.label("contem")
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


def listar_publicas(db: Session, usuario: User, offset: int, limit: int) -> AntologiaPage:
    """As antologias públicas de todo mundo com ao menos um poema ou uma renga, a mais
    nova primeiro, para o Explorar. Uma antologia vazia não tem o que ler, e ficam fora
    as de quem tem bloqueio, em qualquer sentido, com o usuário (services/bloqueios.py)."""
    filtros = [
        Antologia.publica.is_(True),
        or_(
            exists().where(AntologiaPoema.antologia_id == Antologia.id),
            exists().where(AntologiaRenga.antologia_id == Antologia.id),
        ),
    ]
    bloqueados = bloqueios.ids_com_bloqueio(db, usuario.id)
    if bloqueados:
        filtros.append(Antologia.dono_id.not_in(bloqueados))
    return _pagina(db, filtros, offset, limit)


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
    """Dados da antologia + poemas (como PostOut) e rengas (como RengaDetalhe), cada
    lista na ordem de inserção, e a `ordem` dos dois juntos (a lista da tela)."""
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
    renga_ids = list(
        db.scalars(
            select(AntologiaRenga.renga_id)
            .where(AntologiaRenga.antologia_id == antologia_id)
            .order_by(AntologiaRenga.posicao, AntologiaRenga.id)
        )
    )
    detalhes = rengas_service.detalhar_varias(db, usuario, renga_ids)
    rengas = [detalhes[i] for i in renga_ids if i in detalhes]
    return AntologiaDetalhe(
        **_para_saida(antologia, qtd=len(poemas) + len(rengas)).model_dump(),
        poemas=poemas,
        rengas=rengas,
        ordem=[ItemDaOrdem(tipo=tipo, id=i) for tipo, i in ordem(db, antologia_id)],
    )


def ordem(db: Session, antologia_id: int, limite: int | None = None) -> list[tuple[str, int]]:
    """("poema", post_id) e ("renga", renga_id) na ordem em que entraram na antologia:
    a `posicao` é uma numeração só para os dois (`_proxima_posicao`). Público para o
    cartão de compartilhamento. Duas queries; `limite` corta cada uma."""
    linhas = [
        (posicao, "poema", item_id, linha_id)
        for posicao, item_id, linha_id in db.execute(
            select(AntologiaPoema.posicao, AntologiaPoema.post_id, AntologiaPoema.id)
            .where(AntologiaPoema.antologia_id == antologia_id)
            .order_by(AntologiaPoema.posicao, AntologiaPoema.id)
            .limit(limite)
        )
    ]
    linhas += [
        (posicao, "renga", item_id, linha_id)
        for posicao, item_id, linha_id in db.execute(
            select(AntologiaRenga.posicao, AntologiaRenga.renga_id, AntologiaRenga.id)
            .where(AntologiaRenga.antologia_id == antologia_id)
            .order_by(AntologiaRenga.posicao, AntologiaRenga.id)
            .limit(limite)
        )
    ]
    linhas.sort()
    return [(tipo, item_id) for _, tipo, item_id, _ in linhas[:limite]]


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
    db.add(
        AntologiaPoema(
            antologia_id=antologia.id, post_id=post_id, posicao=_proxima_posicao(db, antologia.id)
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


def adicionar_renga(db: Session, usuario: User, antologia_id: int, renga_id: int) -> None:
    """Idempotente: adicionar uma renga que já está na antologia não faz nada."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    rengas_service.buscar(db, renga_id)
    ja_esta = db.scalar(
        select(AntologiaRenga).where(
            AntologiaRenga.antologia_id == antologia.id, AntologiaRenga.renga_id == renga_id
        )
    )
    if ja_esta is not None:
        return
    db.add(
        AntologiaRenga(
            antologia_id=antologia.id, renga_id=renga_id, posicao=_proxima_posicao(db, antologia.id)
        )
    )
    db.commit()


def remover_renga(db: Session, usuario: User, antologia_id: int, renga_id: int) -> None:
    """Idempotente: tirar uma renga que não está na antologia não faz nada."""
    antologia = _buscar_do_dono(db, usuario, antologia_id)
    db.execute(
        delete(AntologiaRenga).where(
            AntologiaRenga.antologia_id == antologia.id, AntologiaRenga.renga_id == renga_id
        )
    )
    db.commit()


def _proxima_posicao(db: Session, antologia_id: int) -> int:
    """A posição depois da maior entre os poemas e as rengas: uma ordem de inserção só."""
    poemas = db.scalar(
        select(func.max(AntologiaPoema.posicao)).where(AntologiaPoema.antologia_id == antologia_id)
    )
    rengas = db.scalar(
        select(func.max(AntologiaRenga.posicao)).where(AntologiaRenga.antologia_id == antologia_id)
    )
    return max(poemas or 0, rengas or 0) + 1


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
    """Antologias de um dono, a mais nova primeiro."""
    return _pagina(db, _filtros(dono, so_publicas), offset, limit)


def _pagina(db: Session, filtros: list, offset: int, limit: int) -> AntologiaPage:
    """Uma página de antologias, a mais nova primeiro; `qtd` de todas numa query só."""
    total = db.scalar(select(func.count()).where(*filtros)) or 0
    antologias = list(
        db.scalars(select(Antologia).where(*filtros).order_by(*_ORDEM).offset(offset).limit(limit))
    )
    qtds = _contar_poemas(db, [antologia.id for antologia in antologias])
    items = [_para_saida(a, qtd=qtds.get(a.id, 0)) for a in antologias]
    return AntologiaPage(items=items, total=total, offset=offset, limit=limit)


def _contar_poemas(db: Session, antologia_ids: list[int]) -> dict[int, int]:
    """Poemas mais rengas de cada antologia (a renga conta como um poema, como no perfil)."""
    if not antologia_ids:
        return {}
    qtds: dict[int, int] = {}
    for modelo in (AntologiaPoema, AntologiaRenga):
        linhas = db.execute(
            select(modelo.antologia_id, func.count())
            .where(modelo.antologia_id.in_(antologia_ids))
            .group_by(modelo.antologia_id)
        )
        for antologia_id, n in linhas:
            qtds[antologia_id] = qtds.get(antologia_id, 0) + n
    return qtds


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
