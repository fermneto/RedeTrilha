"""Cartão de compartilhamento: o mínimo de um poema, perfil, renga ou antologia
para a imagem e os metadados do link (schemas/cartao.py), sem login.

As rotas de sempre continuam pedindo login; estas devolvem só o que o cartão
mostra. Rascunho não é post, então nunca chega aqui; antologia privada dá 404
para todo mundo, como para quem não é o dono; poema apagado ou usuário que não
existe dão 404.
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.marcas import texto_sem_marcas
from app.models.antologia import Antologia, AntologiaPoema, AntologiaRenga
from app.models.post import Post
from app.models.renga import EstrofeRenga, Renga
from app.models.user import User
from app.schemas.cartao import (
    AutorDoCartao,
    CartaoAntologia,
    CartaoPoema,
    CartaoRenga,
    CartaoUsuario,
    PoemaDaAntologia,
)
from app.services import antologias as antologias_service
from app.services import posts as posts_service
from app.services.perfil import poemas_por_autor
from app.services.rengas import texto_de
from app.services.users import buscar_por_username

# Versos que vão no cartão: a imagem mostra até 8, e as linhas em branco entre
# estrofes também contam aqui.
VERSOS = 12
# Poemas da antologia listados no cartão.
POEMAS_DA_ANTOLOGIA = 4


def _autor(user: User) -> AutorDoCartao:
    return AutorDoCartao.model_validate(user, from_attributes=True)


def primeiros_versos(texto: str, quantos: int = VERSOS) -> tuple[list[str], bool]:
    """As `quantos` primeiras linhas sem marcas, a partir do primeiro verso não
    vazio, e se o poema continua depois delas (algum verso não vazio a mais)."""
    linhas = texto_sem_marcas(texto).replace("\r\n", "\n").split("\n")
    inicio = next((i for i, linha in enumerate(linhas) if linha.strip()), len(linhas))
    versos = linhas[inicio : inicio + quantos]
    continua = any(linha.strip() for linha in linhas[inicio + quantos :])
    return versos, continua


def poema(db: Session, post_id: int) -> CartaoPoema:
    # O repost puro mostra o original, como na tela; a citação é o poema de quem citou.
    post = posts_service.original_de(db, post_id)
    if post.repost_puro:
        raise HTTPException(status_code=404, detail="poema não encontrado")
    versos, continua = primeiros_versos(post.texto)
    titulo = texto_sem_marcas(post.titulo).strip() if post.titulo else ""
    return CartaoPoema(
        id=post.id,
        titulo=titulo or None,
        versos=versos,
        continua=continua,
        idioma=post.idioma,
        autor=_autor(post.autor),
    )


def usuario(db: Session, username: str) -> CartaoUsuario:
    pessoa = buscar_por_username(db, username)
    contagem = poemas_por_autor()
    poemas = db.scalar(select(contagem.c.n).where(contagem.c.user_id == pessoa.id)) or 0
    return CartaoUsuario(
        **_autor(pessoa).model_dump(),
        bio=pessoa.bio,
        avatar_url=pessoa.avatar_url,
        poemas=poemas,
    )


def renga(db: Session, renga_id: int) -> CartaoRenga:
    """Aberta ou de convidados: o modo diz quem escreve, não quem lê."""
    achada = db.get(Renga, renga_id)
    if achada is None:
        raise HTTPException(status_code=404, detail="renga não encontrada")
    estrofes = list(
        db.scalars(
            select(EstrofeRenga)
            .where(EstrofeRenga.renga_id == renga_id)
            .order_by(EstrofeRenga.posicao)
        )
    )
    autores: dict[int, User] = {}
    for estrofe in estrofes:
        autores.setdefault(estrofe.autor_id, estrofe.autor)
    versos, continua = primeiros_versos(texto_de([e.texto for e in estrofes]))
    return CartaoRenga(
        id=achada.id,
        titulo=achada.titulo,
        autores=[_autor(a) for a in autores.values()],
        versos=versos,
        continua=continua,
    )


def antologia(db: Session, antologia_id: int) -> CartaoAntologia:
    achada = db.get(Antologia, antologia_id)
    if achada is None or not achada.publica:
        raise HTTPException(status_code=404, detail="antologia não encontrada")
    qtd = sum(
        db.scalar(select(func.count()).where(modelo.antologia_id == antologia_id)) or 0
        for modelo in (AntologiaPoema, AntologiaRenga)
    )
    # Poemas e rengas na ordem da antologia; a renga entra pelo título, com o criador.
    primeiros = antologias_service.ordem(db, antologia_id, POEMAS_DA_ANTOLOGIA)
    posts = _por_id(db, Post, [i for tipo, i in primeiros if tipo == "poema"])
    rengas = _por_id(db, Renga, [i for tipo, i in primeiros if tipo == "renga"])
    poemas = []
    for tipo, item_id in primeiros:
        if tipo == "renga":
            renga = rengas[item_id]
            poemas.append(
                PoemaDaAntologia(titulo=renga.titulo, primeiro_verso="", autor=_autor(renga.criador))
            )
            continue
        post = posts[item_id]
        original = post.repost_de if post.repost_puro and post.repost_de else post
        versos, _ = primeiros_versos(original.texto, 1)
        titulo = texto_sem_marcas(original.titulo).strip() if original.titulo else ""
        poemas.append(
            PoemaDaAntologia(
                titulo=titulo or None,
                primeiro_verso=versos[0].strip() if versos else "",
                autor=_autor(original.autor),
            )
        )
    return CartaoAntologia(
        id=achada.id,
        nome=achada.nome,
        descricao=achada.descricao,
        dono=_autor(achada.dono),
        qtd=qtd,
        poemas=poemas,
    )


def _por_id(db: Session, modelo: type, ids: list[int]) -> dict:
    if not ids:
        return {}
    return {linha.id: linha for linha in db.scalars(select(modelo).where(modelo.id.in_(ids)))}
