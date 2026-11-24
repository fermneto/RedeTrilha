from dataclasses import dataclass, field

from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.indice_tags import extrair_tags, indice_tags, normalizar
from app.models.antologia import AntologiaPoema
from app.models.comentario import Comentario
from app.models.curtida import Curtida
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostOut, PostUpdate
from app.schemas.user import UserOut


@dataclass
class Contagens:
    """Contagens de uma página inteira de posts, buscadas em lote (sem N+1)."""

    curtidas: dict[int, int] = field(default_factory=dict)
    curtidos: set[int] = field(default_factory=set)
    reposts: dict[int, int] = field(default_factory=dict)
    repostados: set[int] = field(default_factory=set)
    comentarios: dict[int, int] = field(default_factory=dict)


def contar(db: Session, post_ids: list[int], usuario: User) -> Contagens:
    """Cinco queries para a página toda: curtidas, reposts (puros e citações) e
    comentários por post, quais o usuário curtiu e quais ele repostou (repost puro)."""
    if not post_ids:
        return Contagens()
    curtidas = db.execute(
        select(Curtida.post_id, func.count())
        .where(Curtida.post_id.in_(post_ids))
        .group_by(Curtida.post_id)
    )
    curtidos = db.scalars(
        select(Curtida.post_id).where(
            Curtida.post_id.in_(post_ids), Curtida.user_id == usuario.id
        )
    )
    reposts = db.execute(
        select(Post.repost_de_id, func.count())
        .where(Post.repost_de_id.in_(post_ids))
        .group_by(Post.repost_de_id)
    )
    repostados = db.scalars(
        select(Post.repost_de_id).where(
            Post.repost_de_id.in_(post_ids), Post.autor_id == usuario.id, Post.texto == ""
        )
    )
    comentarios = db.execute(
        select(Comentario.post_id, func.count())
        .where(Comentario.post_id.in_(post_ids))
        .group_by(Comentario.post_id)
    )
    return Contagens(
        curtidas=dict(curtidas.all()),
        curtidos=set(curtidos),
        reposts=dict(reposts.all()),
        repostados=set(repostados),
        comentarios=dict(comentarios.all()),
    )


def para_saidas(db: Session, posts: list[Post], usuario: User) -> list[PostOut]:
    """PostOut de uma lista, com curtidas, reposts, `curti` e `repostei` do usuário atual."""
    ids = {post.id for post in posts} | {
        post.repost_de_id for post in posts if post.repost_de_id is not None
    }
    contagens = contar(db, list(ids), usuario)
    return [para_saida(post, contagens=contagens) for post in posts]


def para_saida_de(db: Session, post: Post, usuario: User) -> PostOut:
    """PostOut de um post só, com curtidas, reposts, `curti` e `repostei` do usuário atual."""
    return para_saidas(db, [post], usuario)[0]


def para_saida(
    post: Post, incluir_repost: bool = True, contagens: Contagens | None = None
) -> PostOut:
    """Monta o PostOut. `repost_de` vem com um nível só.

    Sem `contagens`, as contagens, `curti` e `repostei` saem zerados: use `para_saidas` ou
    `para_saida_de` quando houver usuário atual.
    """
    contagens = contagens or Contagens()
    original = post.repost_de if incluir_repost else None
    return PostOut(
        id=post.id,
        autor_id=post.autor_id,
        titulo=post.titulo,
        texto=post.texto,
        forma=post.forma,
        obra=post.obra,
        ano=post.ano,
        fonte=post.fonte,
        repost_de_id=post.repost_de_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        autor=UserOut.model_validate(post.autor),
        curtidas=contagens.curtidas.get(post.id, 0),
        curti=post.id in contagens.curtidos,
        reposts=contagens.reposts.get(post.id, 0),
        repostei=post.id in contagens.repostados,
        comentarios=contagens.comentarios.get(post.id, 0),
        repost_de=(
            para_saida(original, incluir_repost=False, contagens=contagens)
            if original
            else None
        ),
        repost_removido=post.repost_removido,
        tags=sorted(tags_do_post(post)),
    )


def tags_do_post(post: Post) -> set[str]:
    """Tags do poema no índice e no PostOut: #hashtags, forma e as `tags_extras`."""
    extras = {normalizar(tag) for tag in post.tags_extras or ()}
    return extrair_tags(post.texto, post.forma) | extras


def buscar(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="poema não encontrado")
    return post


def original_de(db: Session, post_id: int) -> Post:
    """O post que recebe a interação feita num repost puro: o original, como no X.

    Público para os services de reposts, curtidas e comentários: repostar, citar,
    curtir ou comentar um repost puro vai no original. Citação não é resolvida
    (citar uma citação aponta para a citação). 404 se o post não existe.
    """
    post = buscar(db, post_id)
    return post.repost_de if post.repost_puro and post.repost_de else post


def criar(db: Session, autor: User, dados: PostCreate) -> Post:
    post = Post(autor_id=autor.id, **dados.model_dump())
    if dados.repost_de_id is not None:
        post.repost_de_id = original_de(db, dados.repost_de_id).id
    db.add(post)
    db.commit()
    db.refresh(post)
    _indexar(post)
    return post


def editar(db: Session, usuario: User, post_id: int, dados: PostUpdate) -> Post:
    post = _buscar_do_autor(db, usuario, post_id)
    if post.repost_puro:
        raise HTTPException(status_code=422, detail="repost puro não se edita; desfaça o repost")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(post, campo, valor)
    db.commit()
    db.refresh(post)
    _indexar(post)
    return post


def apagar(db: Session, usuario: User, post_id: int) -> None:
    post = _buscar_do_autor(db, usuario, post_id)
    puros = list(
        db.scalars(select(Post.id).where(Post.repost_de_id == post_id, Post.texto == ""))
    )
    db.execute(delete(Curtida).where(Curtida.post_id.in_([post_id, *puros])))
    db.execute(delete(Comentario).where(Comentario.post_id.in_([post_id, *puros])))
    db.execute(delete(AntologiaPoema).where(AntologiaPoema.post_id.in_([post_id, *puros])))
    db.execute(delete(Post).where(Post.id.in_(puros)))
    db.execute(
        update(Post)
        .where(Post.repost_de_id == post_id)
        .values(repost_de_id=None, repost_removido=True)
    )
    db.delete(post)
    db.commit()
    for apagado in (post_id, *puros):
        indice_tags.remover(apagado)


def reconstruir_indice(db: Session) -> None:
    """Chamado no startup: o índice de tags vive em memória."""
    posts = db.scalars(select(Post))
    indice_tags.reconstruir([(post.id, tags_do_post(post), post.created_at) for post in posts])


def _buscar_do_autor(db: Session, usuario: User, post_id: int) -> Post:
    post = buscar(db, post_id)
    if post.autor_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o autor pode alterar o poema")
    return post


def _indexar(post: Post) -> None:
    indice_tags.indexar(post.id, tags_do_post(post), post.created_at)
