"""Funde os poemas repetidos dos consagrados que já estão no banco.

O importador (`importar_consagrados.py`) deixou de criar o mesmo poema duas vezes
(o inteiro e um trecho dele, ou o mesmo texto em outra edição ou grafia; a regra
está em `app/core/duplicados.py`). Os bancos importados antes ainda têm as
cópias: este script acha os grupos, com a mesma regra e a mesma escolha do poema
que fica (o mais completo), e funde cada grupo nele:

- curtidas, reposts puros e itens de antologia passam para o poema mantido; o
  que já existia nele (a mesma pessoa curtiu os dois) não duplica: a cópia sai;
- comentários (com as respostas) e avisos passam para ele; a âncora de uma
  crítica segue os versos se eles estão no poema mantido, senão sai (a crítica
  fica como comentário);
- citações, rascunhos de citação e mensagens diretas apontam para ele;
- a tradução em cache, as tags do índice e o poema repetido saem.

Os pares de versões diferentes de `data/consagrados/_versoes_distintas.json`
(por autor e título) não se fundem, como no importador.

Idempotente: depois de aplicado, não acha mais grupo nenhum. Tudo numa
transação: ou funde tudo, ou nada.

    cd backend
    uv run python scripts/fundir_poemas_repetidos.py              # só lista (--simular)
    uv run python scripts/fundir_poemas_repetidos.py --aplicar    # funde

Faça backup do banco antes de `--aplicar` (com DATABASE_URL apontando para ele,
como nos outros scripts; ver docs/deploy.md). Não roda no boot.
"""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.duplicados import grupos_de_duplicados
from app.core.marcas import texto_sem_marcas
from app.db import SessionLocal
from app.models.ancora_comentario import AncoraComentario
from app.models.antologia import AntologiaPoema
from app.models.aviso import Aviso
from app.models.citacao_renga import CitacaoRenga
from app.models.comentario import Comentario
from app.models.curtida import Curtida
from app.models.mensagem import Mensagem
from app.models.post import Post
from app.models.rascunho import Rascunho
from app.models.traducao import Traducao
from app.models.user import User
from app.services import indice_tags
from scripts.importar_consagrados import VersoesDistintas, ler_versoes_distintas


@dataclass
class GrupoDoBanco:
    autor: str
    mantido: int
    removidos: list[int]


def encontrar_grupos(db: Session, distintos: VersoesDistintas | None = None) -> list[GrupoDoBanco]:
    """Os grupos de poemas repetidos de cada consagrado, pelo `core/duplicados.py`.

    Os poemas vão em ordem de id, que é a ordem do JSON na importação: o
    desempate escolhe o mesmo poema que o importador manteria. Os pares de
    versões diferentes (`data/consagrados/_versoes_distintas.json`) ficam os dois.
    """
    distintos = ler_versoes_distintas() if distintos is None else distintos
    grupos = []
    consagrados = db.execute(
        select(User.id, User.username).where(User.consagrado).order_by(User.username)
    ).all()
    for autor_id, username in consagrados:
        poemas = db.execute(
            select(Post.id, Post.texto, Post.titulo)
            .where(Post.autor_id == autor_id, ~Post.repost_puro)
            .order_by(Post.id)
        ).all()
        pares = grupos_de_duplicados(
            [(id_, texto) for id_, texto, _ in poemas],
            [titulo for _, _, titulo in poemas],
            distintos.get(username, set()),
        )
        for grupo in pares:
            grupos.append(GrupoDoBanco(username, grupo.mantido, grupo.removidos))
    return grupos


def fundir(db: Session, grupo: GrupoDoBanco) -> None:
    """Passa tudo dos `removidos` para o `mantido` e apaga os removidos (sem commit)."""
    mantido = db.get(Post, grupo.mantido)
    for removido_id in grupo.removidos:
        _mover_curtidas(db, removido_id, mantido.id)
        _mover_reposts(db, removido_id, mantido.id)
        _mover_antologias(db, removido_id, mantido.id)
        _mover_comentarios(db, db.get(Post, removido_id), mantido)
        db.execute(update(Aviso).where(Aviso.post_id == removido_id).values(post_id=mantido.id))
        db.execute(
            update(Post).where(Post.repost_de_id == removido_id).values(repost_de_id=mantido.id)
        )
        db.execute(
            update(Rascunho)
            .where(Rascunho.repost_de_id == removido_id)
            .values(repost_de_id=mantido.id)
        )
        db.execute(
            update(Mensagem).where(Mensagem.post_id == removido_id).values(post_id=mantido.id)
        )
        db.execute(delete(Traducao).where(Traducao.post_id == removido_id))
        db.execute(delete(CitacaoRenga).where(CitacaoRenga.post_id == removido_id))
        indice_tags.remover(db, [removido_id])
        db.execute(delete(Post).where(Post.id == removido_id))
    db.flush()


def _mover_curtidas(db: Session, de: int, para: int) -> None:
    ja_curtiram = select(Curtida.user_id).where(Curtida.post_id == para)
    repetidas = list(
        db.scalars(
            select(Curtida.user_id).where(Curtida.post_id == de, Curtida.user_id.in_(ja_curtiram))
        )
    )
    db.execute(delete(Curtida).where(Curtida.post_id == de, Curtida.user_id.in_(repetidas)))
    _apagar_avisos(db, "curtida", de, repetidas)
    db.execute(update(Curtida).where(Curtida.post_id == de).values(post_id=para))


def _mover_reposts(db: Session, de: int, para: int) -> None:
    """Repost puro: um por (pessoa, poema), pelo índice `uq_repost_puro`."""
    ja_repostaram = select(Post.autor_id).where(Post.repost_de_id == para, Post.repost_puro)
    repetidos = db.execute(
        select(Post.id, Post.autor_id).where(
            Post.repost_de_id == de, Post.repost_puro, Post.autor_id.in_(ja_repostaram)
        )
    ).all()
    ids = [post_id for post_id, _ in repetidos]
    db.execute(delete(Aviso).where(Aviso.post_id.in_(ids)))
    db.execute(delete(Curtida).where(Curtida.post_id.in_(ids)))
    indice_tags.remover(db, ids)
    db.execute(delete(Post).where(Post.id.in_(ids)))
    _apagar_avisos(db, "repost", de, [autor_id for _, autor_id in repetidos])


def _mover_antologias(db: Session, de: int, para: int) -> None:
    ja_tem = select(AntologiaPoema.antologia_id).where(AntologiaPoema.post_id == para)
    db.execute(
        delete(AntologiaPoema).where(
            AntologiaPoema.post_id == de, AntologiaPoema.antologia_id.in_(ja_tem)
        )
    )
    db.execute(update(AntologiaPoema).where(AntologiaPoema.post_id == de).values(post_id=para))


def _apagar_avisos(db: Session, tipo: str, post_id: int, atores: list[int]) -> None:
    """O aviso da curtida (ou do repost) que saiu por já existir no poema mantido."""
    if atores:
        db.execute(
            delete(Aviso).where(
                Aviso.tipo == tipo, Aviso.post_id == post_id, Aviso.ator_id.in_(atores)
            )
        )


def _mover_comentarios(db: Session, de: Post, para: Post) -> None:
    """Os comentários vão com as respostas (o `parent_id` fica). A âncora conta
    versos do texto do removido: segue para os mesmos versos no mantido, se
    estiverem lá; senão sai."""
    ancoras = db.scalars(
        select(AncoraComentario).where(
            AncoraComentario.comentario_id.in_(
                select(Comentario.id).where(Comentario.post_id == de.id)
            )
        )
    ).all()
    for ancora in ancoras:
        versos = achar_versos(de.texto, para.texto, ancora.verso_inicio, ancora.verso_fim)
        if versos is None:
            db.delete(ancora)
        else:
            ancora.verso_inicio, ancora.verso_fim = versos
    db.execute(update(Comentario).where(Comentario.post_id == de.id).values(post_id=para.id))


def achar_versos(origem: str, destino: str, inicio: int, fim: int) -> tuple[int, int] | None:
    """Onde os versos `inicio`..`fim` (a partir de 1) de `origem` estão em `destino`.

    Compara os versos sem as marcas e sem os espaços das pontas; None se não estão.
    """

    def versos(texto: str) -> list[str]:
        return [linha.strip() for linha in texto_sem_marcas(texto).split("\n")]

    trecho = versos(origem)[inicio - 1 : fim]
    alvo = versos(destino)
    for i in range(len(alvo) - len(trecho) + 1):
        if alvo[i : i + len(trecho)] == trecho:
            return (i + 1, i + len(trecho))
    return None


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument("--simular", action="store_true", help="só lista os grupos (padrão)")
    modo.add_argument("--aplicar", action="store_true", help="funde os grupos no banco")
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        grupos = encontrar_grupos(db)
        titulos = dict(
            db.execute(
                select(Post.id, Post.titulo).where(
                    Post.id.in_([i for g in grupos for i in (g.mantido, *g.removidos)])
                )
            ).all()
        )
        for grupo in grupos:
            removidos = ", ".join(f"{i} ({titulos[i]})" for i in grupo.removidos)
            print(f"{grupo.autor}: fica {grupo.mantido} ({titulos[grupo.mantido]}); sai {removidos}")
        total = sum(len(g.removidos) for g in grupos)
        if not args.aplicar:
            print(f"{len(grupos)} grupos, {total} poemas a fundir (simulação: nada mudou)")
            return
        try:
            for grupo in grupos:
                fundir(db, grupo)
            db.commit()
        except Exception:
            db.rollback()
            raise
        print(f"{len(grupos)} grupos, {total} poemas fundidos")


if __name__ == "__main__":
    main()
