from dataclasses import dataclass, field

from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.models.ancora_comentario import AncoraComentario
from app.models.antologia import AntologiaPoema
from app.models.citacao_renga import CitacaoRenga
from app.models.comentario import Comentario
from app.models.curtida import Curtida
from app.models.mensagem import Mensagem
from app.models.post import Post
from app.models.rascunho import Rascunho
from app.models.traducao import Traducao
from app.models.user import User
from app.schemas.post import PostCreate, PostOut
from app.schemas.renga import RengaDetalhe
from app.schemas.user import UserOut
from app.services import avisos, bloqueios, indice_tags, rengas
from app.services.indice_tags import tags_do_post


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
    """PostOut de uma lista, com curtidas, reposts, `curti` e `repostei` do usuário atual.

    Os originais dos reposts e citações que faltam vêm numa query só: no identity map,
    o `post.repost_de` do `para_saida` não vai ao banco (era uma query por citação).
    As rengas citadas vêm em lote também (`rengas.detalhar_varias`).
    """
    originais = {post.repost_de_id for post in posts if post.repost_de_id is not None}
    faltando = [i for i in originais if db.identity_map.get(db.identity_key(Post, i)) is None]
    # A lista segura as referências: o identity map é fraco e soltaria os posts antes do uso.
    carregados = list(db.scalars(select(Post).where(Post.id.in_(faltando)))) if faltando else []
    ids = {post.id for post in posts} | originais
    contagens = contar(db, list(ids), usuario)
    citadas = rengas_citadas(db, list(ids), usuario)
    # O original de quem bloqueou quem vê fica "indisponível" (services/bloqueios.py).
    ocultos = (
        frozenset(bloqueios.quem_bloqueou(db, usuario.id)) if originais or citadas else frozenset()
    )
    saidas = [
        para_saida(post, contagens=contagens, ocultos=ocultos, citadas=citadas) for post in posts
    ]
    del carregados
    return saidas


def rengas_citadas(
    db: Session, post_ids: list[int], usuario: User
) -> dict[int, tuple[int, RengaDetalhe | None]]:
    """Post → (id da renga que ele cita, a renga), para os posts que citam uma renga.
    Duas queries e o lote do `rengas.detalhar_varias`."""
    if not post_ids:
        return {}
    pares = dict(
        db.execute(
            select(CitacaoRenga.post_id, CitacaoRenga.renga_id).where(
                CitacaoRenga.post_id.in_(post_ids)
            )
        ).all()
    )
    detalhes = rengas.detalhar_varias(db, usuario, list(set(pares.values())))
    return {post_id: (renga_id, detalhes.get(renga_id)) for post_id, renga_id in pares.items()}


def para_saida_de(db: Session, post: Post, usuario: User) -> PostOut:
    """PostOut de um post só, com curtidas, reposts, `curti` e `repostei` do usuário atual."""
    return para_saidas(db, [post], usuario)[0]


def para_saida(
    post: Post,
    incluir_repost: bool = True,
    contagens: Contagens | None = None,
    ocultos: frozenset[int] = frozenset(),
    citadas: dict[int, tuple[int, RengaDetalhe | None]] | None = None,
) -> PostOut:
    """Monta o PostOut. `repost_de` (ou a `renga_citada`) vem com um nível só.

    Sem `contagens`, as contagens, `curti` e `repostei` saem zerados: use `para_saidas` ou
    `para_saida_de` quando houver usuário atual.
    """
    contagens = contagens or Contagens()
    original = post.repost_de if incluir_repost else None
    indisponivel = original is not None and original.autor_id in ocultos
    if indisponivel:
        original = None
    renga_citada_id, renga_citada = (citadas or {}).get(post.id, (None, None))
    if renga_citada is not None and renga_citada.criador.id in ocultos:
        renga_citada, indisponivel = None, True
    return PostOut(
        id=post.id,
        autor_id=post.autor_id,
        titulo=post.titulo,
        texto=post.texto,
        forma=post.forma,
        obra=post.obra,
        ano=post.ano,
        fonte=post.fonte,
        idioma=post.idioma,
        repost_de_id=post.repost_de_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        autor=UserOut.model_validate(post.autor),
        curtidas=contagens.curtidas.get(post.id, 0),
        curti=post.id in contagens.curtidos,
        reposts=contagens.reposts.get(post.id, 0),
        repostei=post.id in contagens.repostados,
        # Repost puro mostra a conversa do original, para onde os comentários vão.
        comentarios=contagens.comentarios.get(
            post.repost_de_id if post.repost_puro else post.id, 0
        ),
        repost_de=(
            para_saida(original, incluir_repost=False, contagens=contagens)
            if original
            else None
        ),
        repost_removido=post.repost_removido,
        repost_indisponivel=indisponivel,
        renga_citada_id=renga_citada_id,
        renga_citada=renga_citada,
        tags=sorted(tags_do_post(post)),
    )


def buscar(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="poema não encontrado")
    return post


def visivel(db: Session, usuario: User, post_id: int) -> Post:
    """O post, se quem pede pode vê-lo; 404 também se o autor bloqueou quem pede."""
    post = buscar(db, post_id)
    bloqueios.garantir_que_ve(db, usuario.id, post.autor_id, "poema não encontrado")
    return post


def original_visivel(db: Session, usuario: User, post_id: int) -> Post:
    """O `original_de` (repost puro → o poema repostado), se quem pede pode vê-lo:
    404 também se o autor bloqueou quem pede."""
    original = original_de(db, post_id)
    bloqueios.garantir_que_ve(db, usuario.id, original.autor_id, "poema não encontrado")
    return original


def original_para_interagir(db: Session, usuario: User, post_id: int) -> Post:
    """O `original_de` para curtir, comentar, repostar, citar ou mandar por mensagem:
    404 se o autor bloqueou quem age, 403 se quem age bloqueou o autor."""
    original = original_de(db, post_id)
    bloqueios.garantir_interacao(db, usuario.id, original.autor_id, "poema não encontrado")
    return original


def original_de(db: Session, post_id: int) -> Post:
    """O post que recebe a interação feita num repost puro: o original, como no X.

    Público para os services de reposts, curtidas e comentários: repostar, citar,
    curtir ou comentar um repost puro vai no original. Citação não é resolvida
    (citar uma citação aponta para a citação). 404 se o post não existe.
    """
    post = buscar(db, post_id)
    return post.repost_de if post.repost_puro and post.repost_de else post


def criar(db: Session, autor: User, dados: PostCreate, repost_removido: bool = False) -> Post:
    """Publica o poema. O poema publicado não se edita: para corrigir, apaga e publica de novo.

    `repost_removido` só vem do rascunho de uma citação cujo original foi apagado
    antes da publicação (services/rascunhos.py).
    """
    post = Post(
        autor_id=autor.id,
        repost_removido=repost_removido,
        **dados.model_dump(exclude={"renga_citada_id"}),
    )
    citado = None
    if dados.repost_de_id is not None:
        citado = original_para_interagir(db, autor, dados.repost_de_id)
        post.repost_de_id = citado.id
    renga = None
    if dados.renga_citada_id is not None:
        renga = rengas.para_interagir(db, autor, dados.renga_citada_id)
    db.add(post)
    db.flush()
    if citado is not None:
        avisos.avisar(db, autor, [(citado.autor_id, "citacao")], post_id=post.id)
    if renga is not None:
        # A renga é de todos: a citação avisa cada autor, como a curtida e o repost dela.
        db.add(CitacaoRenga(post_id=post.id, renga_id=renga.id))
        rengas.avisar_autores(db, autor, renga, "citacao", post_id=post.id)
    # As tags entram no mesmo commit do poema: todo worker vê os dois juntos.
    indice_tags.indexar(db, post)
    db.commit()
    db.refresh(post)
    return post


def apagar(db: Session, usuario: User, post_id: int) -> None:
    post = _buscar_do_autor(db, usuario, post_id)
    puros = list(
        db.scalars(select(Post.id).where(Post.repost_de_id == post_id, Post.texto == ""))
    )
    db.execute(delete(Curtida).where(Curtida.post_id.in_([post_id, *puros])))
    avisos.apagar_do_poema(db, [post_id, *puros])
    db.execute(
        delete(AncoraComentario).where(
            AncoraComentario.comentario_id.in_(
                select(Comentario.id).where(Comentario.post_id.in_([post_id, *puros]))
            )
        )
    )
    db.execute(delete(Comentario).where(Comentario.post_id.in_([post_id, *puros])))
    db.execute(delete(AntologiaPoema).where(AntologiaPoema.post_id.in_([post_id, *puros])))
    db.execute(delete(CitacaoRenga).where(CitacaoRenga.post_id == post_id))
    db.execute(delete(Traducao).where(Traducao.post_id.in_([post_id, *puros])))
    indice_tags.remover(db, [post_id, *puros])
    db.execute(delete(Post).where(Post.id.in_(puros)))
    db.execute(
        update(Post)
        .where(Post.repost_de_id == post_id)
        .values(repost_de_id=None, repost_removido=True)
    )
    # Citação ainda em rascunho segue a publicada: fica sem o original, marcada.
    db.execute(
        update(Rascunho)
        .where(Rascunho.repost_de_id == post_id)
        .values(repost_de_id=None, repost_removido=True)
    )
    # A mensagem direta que compartilhou o poema fica, com "poema removido pelo autor".
    db.execute(
        update(Mensagem)
        .where(Mensagem.post_id.in_([post_id, *puros]))
        .values(post_id=None, post_removido=True)
    )
    db.delete(post)
    db.commit()


def _buscar_do_autor(db: Session, usuario: User, post_id: int) -> Post:
    post = buscar(db, post_id)
    if post.autor_id != usuario.id:
        raise HTTPException(status_code=403, detail="só o autor pode apagar o poema")
    return post
