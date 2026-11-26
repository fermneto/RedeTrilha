"""Avisos (decisão 16): curtidas, seguidores, reposts, citações, comentários,
críticas, respostas, estrofes e convites de renga.

**Gravar.** Os services das ações chamam `avisar` antes do commit delas: o aviso
entra na mesma transação da curtida ou do comentário (se a ação cai num
IntegrityError e volta, o aviso volta junto), e o `tempo_real.avisar` manda o
evento `aviso` pelo mesmo stream das mensagens (o NOTIFY só sai no commit).
Quem recebe sai de `core/avisos.destinatarios`: nunca quem agiu, nunca uma conta
sem login (os consagrados) e nunca quem tem bloqueio, em qualquer sentido, com
quem agiu ou com o dono do poema ou da renga.

**Desfazer.** Descurtir, desfazer o repost e deixar de seguir apagam o aviso
daquela ação (`desfazer`); apagar o poema ou o comentário apaga os avisos que
apontam para ele (`apagar_do_poema`, `apagar_do_comentario`). O stream avisa de
novo, e o contador desce.

**Ler.** Uma linha por ação no banco; na tela, as curtidas de um mesmo poema
(ou de uma mesma renga) num mesmo dia viram uma linha só ("Ana e mais 3
curtiram"), e os reposts também (decisão do Neto). O dia é o de Brasília. O
agrupamento é um GROUP BY nos avisos da pessoa (tipo, poema, renga e dia; o id
para os tipos que não agrupam),
ordenado pelo aviso mais recente de cada grupo e
paginado por cursor nesse mesmo par (data, id). Um bloqueio feito depois do
aviso o esconde na leitura (como nos comentários), sem apagar.

Custos, com a = avisos da pessoa, k = página:

- `avisar`: O(c log n), c = candidatos (uma consulta para os sem login e as dos
  bloqueios, pelos índices);
- `listar`: O(a) no índice `(destinatario_id, created_at, id)` para agrupar, mais
  O(k log n) para os atores e os alvos da página, em lote (sem N+1);
- `resumo`: O(u), u = não lidos da pessoa, no índice `(destinatario_id, lido)`.
"""

from collections.abc import Iterable

from sqlalchemy import and_, case, delete, distinct, func, or_, select, update
from sqlalchemy.orm import Session

from app import tempo_real
from app.core import avisos as regras
from app.core.marcas import texto_sem_marcas
from app.models.ancora_comentario import AncoraComentario
from app.models.aviso import Aviso
from app.models.comentario import Comentario
from app.models.comentario_renga import ComentarioRenga
from app.models.post import Post
from app.models.renga import EstrofeRenga, Renga
from app.models.user import User
from app.schemas.aviso import AvisoOut, AvisoPage, ResumoDeAvisos
from app.schemas.user import UserOut
from app.services import bloqueios
from app.services.cursor import codificar_cursor, ler_cursor

# Os tipos que viram uma linha por poema e por dia na tela.
AGRUPADOS = ("curtida", "repost")
# O dia da linha agrupada é o de Brasília. No SQLite (dev e testes), que não tem
# base de fusos, vale o deslocamento fixo: o Brasil não tem horário de verão desde 2019.
FUSO = "America/Sao_Paulo"
DESLOCAMENTO_DO_FUSO = "-3 hours"
# Quantos atores a linha agrupada mostra pelo nome.
ATORES_NA_LINHA = 2
EVENTO = {"tipo": "aviso"}


def avisar(
    db: Session,
    ator: User,
    candidatos: Iterable[tuple[int | None, str]],
    dono_id: int | None = None,
    **alvo: int | None,
) -> None:
    """Grava os avisos de uma ação para os (pessoa, tipo) de `candidatos`, sem commit.

    `dono_id` é o autor do poema ou o criador da renga: quem tem bloqueio com ele
    não vê o alvo, então também não é avisado. `alvo` são as colunas do alvo
    (`post_id`, `renga_id`, `comentario_id`, `estrofe_id`).
    """
    candidatos = [(pessoa, tipo) for pessoa, tipo in candidatos if pessoa is not None]
    if not candidatos:
        return
    para = regras.destinatarios(
        ator.id, candidatos, _sem_aviso(db, ator.id, [p for p, _ in candidatos], dono_id)
    )
    if not para:
        return
    db.add_all(
        Aviso(destinatario_id=pessoa, tipo=tipo, ator_id=ator.id, **alvo) for pessoa, tipo in para
    )
    tempo_real.avisar(db, [pessoa for pessoa, _ in para], EVENTO)


def do_comentario(
    pai_autor_id: int | None, donos: Iterable[int], critica: bool
) -> list[tuple[int | None, str]]:
    """Os candidatos de um comentário: o autor do comentário respondido recebe
    "resposta"; os donos (o autor do poema, ou o criador e os autores da renga),
    "critica" ou "comentario". Quem é os dois recebe um aviso só, o de resposta."""
    tipo = "critica" if critica else "comentario"
    return [(pai_autor_id, "resposta"), *((dono, tipo) for dono in donos)]


def desfazer(db: Session, tipo: str, ator_id: int, **alvo: int) -> None:
    """A ação foi desfeita (descurtir, desfazer o repost, deixar de seguir): sai o aviso dela."""
    filtros = [Aviso.tipo == tipo, Aviso.ator_id == ator_id]
    filtros += [getattr(Aviso, coluna) == valor for coluna, valor in alvo.items()]
    _apagar(db, and_(*filtros))


def apagar_do_poema(db: Session, post_ids: list[int]) -> None:
    """O poema (e os reposts puros dele) saiu: saem as curtidas, os reposts, a
    citação que ele era e os comentários nele."""
    _apagar(db, Aviso.post_id.in_(post_ids))


def apagar_do_comentario(db: Session, comentario_id: int, em_renga: bool) -> None:
    """O comentário foi apagado (ou virou o marcador "comentário removido")."""
    lado = Aviso.renga_id.is_not(None) if em_renga else Aviso.post_id.is_not(None)
    _apagar(db, and_(Aviso.comentario_id == comentario_id, lado))


def listar(db: Session, eu: User, cursor: str | None, limit: int) -> AvisoPage:
    """Os avisos de `eu`, a linha com o aviso mais recente primeiro, por cursor."""
    grupos = _grupos(db, eu, cursor, limit)
    pagina, tem_mais = grupos[:limit], len(grupos) > limit
    itens = _montar(db, eu, pagina)
    ultimo = pagina[-1] if pagina else None
    return AvisoPage(
        items=itens,
        limit=limit,
        proximo_cursor=(
            codificar_cursor(ultimo.quando, ultimo.ultimo) if ultimo and tem_mais else None
        ),
    )


def resumo(db: Session, eu: User) -> ResumoDeAvisos:
    """Quantas linhas da tela têm aviso não lido (as curtidas de um poema num dia contam uma)."""
    grupos = (
        select(Aviso.tipo)
        .where(*_meus(db, eu), Aviso.lido.is_(False))
        .group_by(*_chave_do_grupo(db))
        .subquery()
    )
    return ResumoDeAvisos(nao_lidos=db.scalar(select(func.count()).select_from(grupos)) or 0)


def marcar_lidos(db: Session, eu: User, ate: int | None) -> None:
    """Marca como lidos os avisos de `eu` até o id `ate` (ou todos); as outras abas
    de `eu` recebem o evento e zeram o contador."""
    filtros = [Aviso.destinatario_id == eu.id, Aviso.lido.is_(False)]
    if ate is not None:
        filtros.append(Aviso.id <= ate)
    resultado = db.execute(update(Aviso).where(*filtros).values(lido=True))
    if resultado.rowcount:
        tempo_real.avisar(db, [eu.id], EVENTO)
    db.commit()


def _sem_aviso(db: Session, ator_id: int, pessoas: list[int], dono_id: int | None) -> set[int]:
    """Quem, entre `pessoas`, não recebe: sem login (consagrados) ou com bloqueio."""
    sem_login = set(
        db.scalars(select(User.id).where(User.id.in_(pessoas), User.password_hash.is_(None)))
    )
    com_bloqueio = bloqueios.ids_com_bloqueio(db, ator_id)
    if dono_id is not None and dono_id != ator_id:
        com_bloqueio |= bloqueios.ids_com_bloqueio(db, dono_id)
    return sem_login | com_bloqueio


def _apagar(db: Session, filtro) -> None:
    """Apaga os avisos do filtro e avisa os destinatários (o contador deles muda)."""
    para = set(db.scalars(select(Aviso.destinatario_id).where(filtro)))
    if not para:
        return
    db.execute(delete(Aviso).where(filtro))
    tempo_real.avisar(db, para, EVENTO)


def _meus(db: Session, eu: User) -> list:
    """Os avisos de `eu`, sem os de quem tem bloqueio com `eu` (bloqueio feito depois)."""
    filtros = [Aviso.destinatario_id == eu.id]
    bloqueados = bloqueios.ids_com_bloqueio(db, eu.id)
    if bloqueados:
        filtros.append(Aviso.ator_id.not_in(bloqueados))
    return filtros


def _dia(db: Session):
    """O dia do aviso no fuso de Brasília (`created_at` é gravado em UTC)."""
    if db.get_bind().dialect.name == "postgresql":
        return func.date(func.timezone(FUSO, func.timezone("UTC", Aviso.created_at)))
    return func.date(Aviso.created_at, DESLOCAMENTO_DO_FUSO)


def _chave_do_grupo(db: Session) -> tuple:
    """(tipo, poema, renga, id, dia): curtidas e reposts do mesmo poema (ou da mesma
    renga) no mesmo dia caem na mesma linha (o id vira 0); os outros tipos ficam uma
    linha por aviso (o dia vira nulo)."""
    agrupa = Aviso.tipo.in_(AGRUPADOS)
    return (
        Aviso.tipo,
        Aviso.post_id,
        Aviso.renga_id,
        case((agrupa, 0), else_=Aviso.id),
        case((agrupa, _dia(db)), else_=None),
    )


def _grupos(db: Session, eu: User, cursor: str | None, limit: int) -> list:
    """As linhas da página: (tipo, post_id, renga_id, dia, quando, ultimo, atores,
    lido), mais uma para saber se há próxima página."""
    quando = func.max(Aviso.created_at)
    ultimo = func.max(Aviso.id)
    chave = _chave_do_grupo(db)
    consulta = (
        select(
            Aviso.tipo,
            Aviso.post_id,
            Aviso.renga_id,
            chave[4].label("dia"),
            quando.label("quando"),
            ultimo.label("ultimo"),
            func.count(distinct(Aviso.ator_id)).label("atores"),
            func.min(case((Aviso.lido, 1), else_=0)).label("lido"),
        )
        .where(*_meus(db, eu))
        .group_by(*chave)
    )
    if cursor is not None:
        data, id_ = ler_cursor(cursor)
        consulta = consulta.having(or_(quando < data, and_(quando == data, ultimo < id_)))
    return list(db.execute(consulta.order_by(quando.desc(), ultimo.desc()).limit(limit + 1)))


def _montar(db: Session, eu: User, grupos: list) -> list[AvisoOut]:
    """Os atores e os alvos das linhas, em lote: uma consulta para cada tipo de alvo."""
    if not grupos:
        return []
    principais = _por_id(db, Aviso, {g.ultimo for g in grupos})
    atores = _atores_dos_agrupados(db, eu, grupos)
    alvos = _Alvos(db, list(principais.values()))
    itens = []
    for grupo in grupos:
        aviso = principais[grupo.ultimo]
        if grupo.tipo in AGRUPADOS:
            de_quem = atores.get(
                (grupo.tipo, grupo.post_id, grupo.renga_id, grupo.dia), [aviso.ator]
            )
        else:
            de_quem = [aviso.ator]
        itens.append(
            AvisoOut(
                id=aviso.id,
                tipo=aviso.tipo,
                created_at=grupo.quando,
                lido=bool(grupo.lido),
                atores=[UserOut.model_validate(u) for u in de_quem],
                total_atores=grupo.atores,
                post_id=aviso.post_id,
                renga_id=aviso.renga_id,
                comentario_id=aviso.comentario_id,
                **alvos.de(aviso),
            )
        )
    return itens


def _atores_dos_agrupados(db: Session, eu: User, grupos: list) -> dict[tuple, list[User]]:
    """Os ATORES_NA_LINHA atores mais recentes de cada linha agrupada, numa consulta
    (ROW_NUMBER por tipo, poema, renga e dia), sem carregar as mil curtidas de um poema."""
    chaves = {(g.tipo, g.post_id, g.renga_id, g.dia) for g in grupos if g.tipo in AGRUPADOS}
    if not chaves:
        return {}
    dia = _dia(db).label("dia")
    posicao = (
        func.row_number()
        .over(
            partition_by=(Aviso.tipo, Aviso.post_id, Aviso.renga_id, dia),
            order_by=(Aviso.created_at.desc(), Aviso.id.desc()),
        )
        .label("posicao")
    )
    posts = {post_id for _, post_id, _, _ in chaves if post_id is not None}
    rengas = {renga_id for _, _, renga_id, _ in chaves if renga_id is not None}
    recentes = (
        select(Aviso.id, dia, posicao)
        .where(
            *_meus(db, eu),
            Aviso.tipo.in_(AGRUPADOS),
            or_(Aviso.post_id.in_(posts), Aviso.renga_id.in_(rengas)),
        )
        .subquery()
    )
    linhas = db.execute(
        select(Aviso, recentes.c.dia)
        .join(recentes, recentes.c.id == Aviso.id)
        .where(
            recentes.c.posicao <= ATORES_NA_LINHA,
            recentes.c.dia.in_({d for _, _, _, d in chaves}),
        )
        .order_by(recentes.c.posicao)
    )
    por_chave: dict[tuple, list[User]] = {}
    for aviso, dia_do_aviso in linhas:
        chave = (aviso.tipo, aviso.post_id, aviso.renga_id, dia_do_aviso)
        por_chave.setdefault(chave, []).append(aviso.ator)
    return por_chave


class _Alvos:
    """Os poemas, rengas, comentários e estrofes de uma página de avisos, buscados
    de uma vez, e o `titulo`, o `trecho` e os versos que cada linha mostra."""

    def __init__(self, db: Session, avisos: list[Aviso]) -> None:
        def ids(coluna: str, filtro=lambda a: True) -> set[int]:
            return {getattr(a, coluna) for a in avisos if getattr(a, coluna) and filtro(a)}

        self.posts = _por_id(db, Post, ids("post_id"))
        self.posts |= _por_id(
            db, Post, {p.repost_de_id for p in self.posts.values() if p.repost_de_id}
        )
        self.rengas = _por_id(db, Renga, ids("renga_id"))
        self.estrofes = _por_id(db, EstrofeRenga, ids("estrofe_id"))
        dos_poemas = ids("comentario_id", lambda a: a.renga_id is None)
        self.comentarios = _por_id(db, Comentario, dos_poemas)
        self.comentarios_renga = _por_id(
            db, ComentarioRenga, ids("comentario_id", lambda a: a.renga_id is not None)
        )
        self.ancoras = _por_id(db, AncoraComentario, dos_poemas, AncoraComentario.comentario_id)

    def de(self, aviso: Aviso) -> dict:
        post = self.posts.get(aviso.post_id)
        renga = self.rengas.get(aviso.renga_id)
        if renga is not None:
            # A renga curtida, repostada, citada ou comentada.
            titulo = renga.titulo
        elif aviso.tipo == "citacao" and post is not None and post.repost_de_id:
            # A citação mostra o título do poema citado, que é o de quem recebe.
            titulo = getattr(self.posts.get(post.repost_de_id), "titulo", None)
        else:
            titulo = post.titulo if post else None
        if aviso.tipo == "estrofe":
            estrofe = self.estrofes.get(aviso.estrofe_id)
            return {"titulo": titulo, "trecho": _trecho(estrofe.texto if estrofe else "")}
        if aviso.comentario_id is not None:
            return {"titulo": titulo, **self._do_comentario(aviso)}
        return {"titulo": titulo, "trecho": _trecho(post.texto) if post else ""}

    def _do_comentario(self, aviso: Aviso) -> dict:
        if aviso.renga_id is not None:
            comentario = self.comentarios_renga.get(aviso.comentario_id)
            inicio = comentario.verso_inicio if comentario else None
            fim = comentario.verso_fim if comentario else None
        else:
            comentario = self.comentarios.get(aviso.comentario_id)
            ancora = self.ancoras.get(aviso.comentario_id)
            inicio, fim = (ancora.verso_inicio, ancora.verso_fim) if ancora else (None, None)
        return {
            "trecho": _trecho(comentario.texto) if comentario else "",
            "verso_inicio": inicio,
            "verso_fim": fim,
        }


def _por_id(db: Session, modelo: type, ids: set[int], coluna=None) -> dict:
    coluna = coluna if coluna is not None else modelo.id
    if not ids:
        return {}
    return {getattr(linha, coluna.key): linha for linha in db.scalars(select(modelo).where(coluna.in_(ids)))}


def _trecho(texto: str) -> str:
    return regras.trecho(texto_sem_marcas(texto))
