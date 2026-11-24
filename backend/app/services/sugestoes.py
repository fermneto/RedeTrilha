"""Sugestões de quem seguir: o último passo do onboarding, o bloco no "Para você"
e a tela /sugestoes.

Entram as contas com pelo menos um poema (a conta do perfil: poemas, citações e
rengas), menos a própria pessoa e quem ela já segue. A ordem é a nota com pesos
de `core/pontuacao_sugestoes.py`: seguidores, escolas e formas em comum, mesma
língua e mesma região.

De onde sai cada dado da conta:
- escolas: do JSON do consagrado (`atributos_consagrado`) ou das preferências
  que o poeta comum marcou;
- formas: as dos poemas da conta, mais as que o poeta comum marcou;
- língua: a mais frequente nos poemas da conta (a mesma regra do Acervo);
- país e estado: do consagrado (só o país) ou das preferências.
Da pessoa que vê: as preferências dela, e a língua do navegador (`lingua`) ou,
sem ela, a mais frequente nos poemas da própria pessoa.

Custo: cinco consultas agregadas sobre as c contas candidatas (contagens e
língua, preferências, atributos de consagrados, formas escritas, preferências
de quem vê), O(c log c) para ordenar e uma consulta O(limit) para a página.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.pontuacao_sugestoes import Perfil, ordenar
from app.models.atributos_consagrado import AtributosConsagrado
from app.models.follow import Follow
from app.models.post import Post
from app.models.preferencia import Preferencia
from app.models.user import User
from app.schemas.sugestao import SugestaoOut, SugestaoPage
from app.schemas.user import UserOut
from app.services.acervo import lingua_de_quem_ve, lingua_por_autor
from app.services.follows import seguidores_por_usuario
from app.services.perfil import poemas_por_autor


def sugestoes(
    db: Session, usuario: User, offset: int, limit: int, lingua: str | None = None
) -> SugestaoPage:
    candidatas = _candidatas(db, usuario)
    ordem = ordenar(list(candidatas.values()), _quem_ve(db, usuario, lingua))
    pagina = ordem[offset : offset + limit]
    usuarios = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_([p.id for p in pagina])))
    }
    contagens = _contagens(db, [p.id for p in pagina])
    return SugestaoPage(
        items=[
            SugestaoOut(
                **UserOut.model_validate(usuarios[perfil.id]).model_dump(),
                seguidores=perfil.seguidores,
                poemas=contagens.get(perfil.id, 0),
                sigo=False,
                escolas=sorted(perfil.escolas),
            )
            for perfil in pagina
        ],
        total=len(ordem),
        offset=offset,
        limit=limit,
    )


def _candidatas(db: Session, usuario: User) -> dict[int, Perfil]:
    poemas = poemas_por_autor()
    seguidores = seguidores_por_usuario()
    lingua = lingua_por_autor()
    ultimo = (
        select(Post.autor_id.label("user_id"), func.max(Post.created_at).label("em"))
        .where(~Post.repost_puro)
        .group_by(Post.autor_id)
        .subquery()
    )
    seguidos = select(Follow.seguido_id).where(Follow.seguidor_id == usuario.id)
    linhas = db.execute(
        select(
            User.id,
            User.consagrado,
            func.coalesce(seguidores.c.n, 0),
            lingua.c.idioma,
            ultimo.c.em,
        )
        .join(poemas, poemas.c.user_id == User.id)
        .outerjoin(seguidores, seguidores.c.user_id == User.id)
        .outerjoin(lingua, lingua.c.user_id == User.id)
        .outerjoin(ultimo, ultimo.c.user_id == User.id)
        .where(poemas.c.n > 0, User.id != usuario.id, User.id.not_in(seguidos))
    ).all()
    ids = [linha[0] for linha in linhas]
    preferencias = {
        p.user_id: p
        for p in db.scalars(select(Preferencia).where(Preferencia.user_id.in_(ids)))
    }
    atributos = {
        a.user_id: a
        for a in db.scalars(
            select(AtributosConsagrado).where(AtributosConsagrado.user_id.in_(ids))
        )
    }
    escritas: dict[int, set[str]] = {}
    for autor_id, forma in db.execute(
        select(Post.autor_id, Post.forma)
        .where(Post.autor_id.in_(ids), Post.forma.is_not(None))
        .distinct()
    ):
        escritas.setdefault(autor_id, set()).add(forma)

    perfis = {}
    for user_id, consagrado, n_seguidores, idioma, em in linhas:
        pref = preferencias.get(user_id)
        attr = atributos.get(user_id) if consagrado else None
        perfis[user_id] = Perfil(
            id=user_id,
            seguidores=n_seguidores,
            escolas=frozenset(attr.escolas if attr else (pref.escolas if pref else [])),
            formas=frozenset(escritas.get(user_id, set()) | set(pref.formas if pref else [])),
            lingua=idioma,
            pais=attr.pais if attr else (pref.pais if pref else None),
            uf=None if consagrado or not pref else pref.uf,
            ultimo_poema=em,
        )
    return perfis


def _quem_ve(db: Session, usuario: User, lingua: str | None) -> Perfil:
    pref = db.get(Preferencia, usuario.id)
    return Perfil(
        id=usuario.id,
        escolas=frozenset(pref.escolas if pref else []),
        formas=frozenset(pref.formas if pref else []),
        lingua=lingua_de_quem_ve(db, usuario, lingua),
        pais=pref.pais if pref else None,
        uf=pref.uf if pref else None,
    )


def _contagens(db: Session, ids: list[int]) -> dict[int, int]:
    poemas = poemas_por_autor()
    return dict(
        db.execute(select(poemas.c.user_id, poemas.c.n).where(poemas.c.user_id.in_(ids))).all()
    )
