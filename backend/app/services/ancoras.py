"""Crítica ancorada no verso: um comentário de 1º nível sobre um trecho do poema.

Os versos são as linhas de `texto.split("\\n")`, contadas a partir de 1, com as
linhas em branco entre estrofes incluídas: o número de um verso é a posição da
linha no texto gravado, sem `strip()` nem normalização. Poema publicado não se
edita (decisão do Neto), então a âncora guarda só o intervalo e o trecho sai
do texto do poema.
"""

from collections import Counter

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.ancora_comentario import AncoraComentario
from app.models.comentario import Comentario
from app.models.post import Post
from app.schemas.comentario import (
    AncoraCreate,
    AncoraOut,
    VersoComentado,
    VersosComentadosOut,
)


def trecho_de(texto: str, inicio: int, fim: int) -> str:
    """As linhas `inicio` a `fim` (inclusive, base 1), juntas como estavam."""
    return "\n".join(texto.split("\n")[inicio - 1 : fim])


def validar(texto: str, parent_id: int | None, dados: AncoraCreate) -> None:
    """422 se a âncora não vale neste poema."""
    if parent_id is not None:
        raise HTTPException(
            status_code=422,
            detail="só comentários direto no poema citam versos; a resposta herda o trecho do pai",
        )
    total = len(texto.split("\n"))
    if dados.verso_inicio > dados.verso_fim:
        raise HTTPException(
            status_code=422, detail="o verso inicial não pode vir depois do verso final"
        )
    if dados.verso_inicio < 1 or dados.verso_fim > total:
        raise HTTPException(
            status_code=422, detail=f"o poema tem {total} versos; escolha entre o 1 e o {total}"
        )
    if not trecho_de(texto, dados.verso_inicio, dados.verso_fim).strip():
        raise HTTPException(status_code=422, detail="o trecho escolhido está em branco")


def ancorar(db: Session, comentario_id: int, dados: AncoraCreate) -> None:
    """Grava a âncora na mesma transação do comentário (quem chama faz o commit)."""
    db.add(
        AncoraComentario(
            comentario_id=comentario_id,
            verso_inicio=dados.verso_inicio,
            verso_fim=dados.verso_fim,
        )
    )


def saida(verso_inicio: int, verso_fim: int, texto: str) -> AncoraOut:
    return AncoraOut(
        verso_inicio=verso_inicio,
        verso_fim=verso_fim,
        trecho=trecho_de(texto, verso_inicio, verso_fim),
    )


def das_saidas(db: Session, comentarios: list[Comentario]) -> dict[int, AncoraOut]:
    """As âncoras de uma página de comentários, numa query (mais uma para o poema)."""
    if not comentarios:
        return {}
    ancoras = list(
        db.scalars(
            select(AncoraComentario).where(
                AncoraComentario.comentario_id.in_([c.id for c in comentarios])
            )
        )
    )
    if not ancoras:
        return {}
    # Todos os comentários de uma página são do mesmo poema.
    texto = db.get(Post, comentarios[0].post_id).texto
    return {a.comentario_id: saida(a.verso_inicio, a.verso_fim, texto) for a in ancoras}


def ids_no_verso(post: Post, verso: int):
    """Subquery com os ids dos comentários do poema cuja âncora cobre `verso`."""
    return (
        select(AncoraComentario.comentario_id)
        .join(Comentario, Comentario.id == AncoraComentario.comentario_id)
        .where(
            Comentario.post_id == post.id,
            AncoraComentario.verso_inicio <= verso,
            AncoraComentario.verso_fim >= verso,
        )
    )


def versos_comentados(db: Session, post: Post) -> VersosComentadosOut:
    """Quantos comentários cobrem cada verso do poema.

    Um comentário sobre os versos 5 a 8 conta nos quatro. O(a + s), com a =
    âncoras do poema e s = soma dos tamanhos dos intervalos.
    """
    intervalos = db.execute(
        select(AncoraComentario.verso_inicio, AncoraComentario.verso_fim)
        .join(Comentario, Comentario.id == AncoraComentario.comentario_id)
        .where(Comentario.post_id == post.id)
    )
    contagem: Counter[int] = Counter()
    for inicio, fim in intervalos:
        contagem.update(range(inicio, fim + 1))
    return VersosComentadosOut(
        items=[VersoComentado(verso=v, comentarios=n) for v, n in sorted(contagem.items())]
    )


def apagar(db: Session, comentario_ids: list[int]) -> None:
    """Antes de apagar comentários do banco (a FK não deixa a âncora órfã)."""
    db.execute(delete(AncoraComentario).where(AncoraComentario.comentario_id.in_(comentario_ids)))
