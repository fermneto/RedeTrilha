"""Acervo: todos os poetas, com filtros de tipo, nome, língua e época, ordem e páginas.

Como funciona uma página (3 consultas, sem N+1):

1. Uma consulta agregada traz (id, nome, username, seguidores, poemas) de todos os
   poetas que passam pelos filtros de tipo, língua e época. As contagens vêm das
   subqueries de services/follows.py e services/perfil.py, juntadas por GROUP BY.
2. A busca por nome, a ordem e o corte da página são feitos em Python sobre essas
   linhas, com core/indice_tags.normalizar (casefold e sem acento), a mesma das tags.
   Motivo: o SQLite não tem como ignorar acento (não há `unaccent`, e o lower() dele
   só conhece ASCII), e no Postgres o `unaccent` é uma extensão a instalar. Uma
   coluna normalizada no User exigiria migração no Postgres do deploy, que o
   projeto não tem (create_all não acrescenta coluna). Fazer em Python dá o mesmo
   resultado nos dois bancos, inclusive a ordem alfabética ("Álvares" no A, e não
   depois do Z, como no SQLite). O custo é ler 4 colunas de cada poeta filtrado:
   dezenas a centenas de linhas no Verso. Se a rede crescer, o caminho é a coluna
   normalizada com Alembic.
3. Os Users completos da página e o `sigo` vêm em duas consultas pelos ids dela.

A língua de um consagrado é a mais frequente nos poemas dele (o `idioma` do Post,
que o importador preenche pela fonte), calculada na própria consulta por uma
subquery com row_number(), que o SQLite (3.25+) e o Postgres têm.
"""

from dataclasses import dataclass

from sqlalchemy import Row, case, func, select
from sqlalchemy.orm import Session

from app.core.indice_tags import normalizar
from app.models.post import Post
from app.models.user import User
from app.schemas.acervo import (
    AcervoPage,
    ChaveEpoca,
    EpocaDoAcervo,
    FiltrosDoAcervo,
    LinguaDoAcervo,
    Ordem,
    PoetaDoAcervo,
    Tipo,
)
from app.schemas.consagrado import ANO_LIMITE_DOMINIO_PUBLICO
from app.schemas.user import UserOut
from app.services.follows import seguidores_por_usuario, seguidos_entre
from app.services.perfil import poemas_por_autor


@dataclass(frozen=True)
class FaixaDeEpoca:
    """Faixa de anos de morte, inclusive nas duas pontas; `inicio` None = sem limite."""

    chave: ChaveEpoca
    rotulo: str
    inicio: int | None
    fim: int


# Tabela única das épocas: o filtro, as contagens e o front (via GET /acervo/filtros).
FAIXAS_DE_EPOCA = (
    FaixaDeEpoca("antiguidade", "Antiguidade", None, 500),
    FaixaDeEpoca("idade_media", "Idade Média", 501, 1500),
    FaixaDeEpoca("xvi", "Século XVI", 1501, 1600),
    FaixaDeEpoca("xvii", "Século XVII", 1601, 1700),
    FaixaDeEpoca("xviii", "Século XVIII", 1701, 1800),
    FaixaDeEpoca("xix", "Século XIX", 1801, 1900),
    FaixaDeEpoca("xx", "Século XX", 1901, ANO_LIMITE_DOMINIO_PUBLICO),
)
_FAIXA_POR_CHAVE = {faixa.chave: faixa for faixa in FAIXAS_DE_EPOCA}


@dataclass(frozen=True)
class Filtros:
    tipo: Tipo = "todos"
    q: str | None = None
    lingua: str | None = None
    epoca: ChaveEpoca | None = None
    ordem: Ordem = "alfabetica"


def listar(
    db: Session, usuario: User, filtros: Filtros, offset: int, limit: int
) -> AcervoPage:
    linhas = _filtrar_por_nome(db.execute(_consulta(filtros)).all(), filtros.q)
    linhas.sort(key=_chave_de_ordem(filtros.ordem))
    pagina = linhas[offset : offset + limit]

    ids = [linha.id for linha in pagina]
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids)))}
    sigo = seguidos_entre(db, usuario.id, ids)
    items = [
        PoetaDoAcervo(
            **UserOut.model_validate(users[linha.id]).model_dump(),
            seguidores=linha.seguidores,
            poemas=linha.poemas,
            sigo=linha.id in sigo,
        )
        for linha in pagina
    ]
    return AcervoPage(items=items, total=len(linhas), offset=offset, limit=limit)


def opcoes_de_filtro(db: Session) -> FiltrosDoAcervo:
    """As línguas que algum consagrado tem e todas as faixas de época, com contagem."""
    lingua = _lingua_por_autor()
    linguas = db.execute(
        select(lingua.c.idioma, func.count())
        .join(User, User.id == lingua.c.user_id)
        .where(User.consagrado)
        .group_by(lingua.c.idioma)
        .order_by(func.count().desc(), lingua.c.idioma)
    ).all()

    epoca = _epoca_sql().label("epoca")
    por_epoca = dict(
        db.execute(
            select(epoca, func.count()).where(User.consagrado).group_by(epoca)
        ).all()
    )
    return FiltrosDoAcervo(
        linguas=[LinguaDoAcervo(codigo=codigo, poetas=n) for codigo, n in linguas],
        epocas=[
            EpocaDoAcervo(
                chave=faixa.chave,
                rotulo=faixa.rotulo,
                inicio=faixa.inicio,
                fim=faixa.fim,
                poetas=por_epoca.get(faixa.chave, 0),
            )
            for faixa in FAIXAS_DE_EPOCA
        ],
    )


def _consulta(filtros: Filtros):
    seguidores = seguidores_por_usuario()
    poemas = poemas_por_autor()
    consulta = (
        select(
            User.id,
            User.name,
            User.username,
            func.coalesce(seguidores.c.n, 0).label("seguidores"),
            func.coalesce(poemas.c.n, 0).label("poemas"),
        )
        .outerjoin(seguidores, seguidores.c.user_id == User.id)
        .outerjoin(poemas, poemas.c.user_id == User.id)
    )
    if filtros.tipo == "consagrados":
        consulta = consulta.where(User.consagrado)
    elif filtros.tipo == "do_verso":
        consulta = consulta.where(~User.consagrado)
    # Língua e época só existem para consagrados: com elas, poeta da rede não entra.
    if filtros.lingua:
        lingua = _lingua_por_autor()
        consulta = consulta.join(lingua, lingua.c.user_id == User.id).where(
            User.consagrado, lingua.c.idioma == filtros.lingua
        )
    if filtros.epoca:
        faixa = _FAIXA_POR_CHAVE[filtros.epoca]
        consulta = consulta.where(User.consagrado, User.morte <= faixa.fim)
        if faixa.inicio is not None:
            consulta = consulta.where(User.morte >= faixa.inicio)
    return consulta


def _lingua_por_autor():
    """Subquery (user_id, idioma): a língua mais frequente nos poemas autorais de cada
    autor. Empate fica com o código menor em ordem alfabética, para a resposta ser estável."""
    contagem = (
        select(Post.autor_id, Post.idioma, func.count().label("n"))
        .where(~Post.repost_puro, Post.idioma.is_not(None))
        .group_by(Post.autor_id, Post.idioma)
        .subquery()
    )
    posicao = func.row_number().over(
        partition_by=contagem.c.autor_id,
        order_by=(contagem.c.n.desc(), contagem.c.idioma),
    )
    ranking = select(
        contagem.c.autor_id.label("user_id"), contagem.c.idioma, posicao.label("posicao")
    ).subquery()
    return (
        select(ranking.c.user_id, ranking.c.idioma).where(ranking.c.posicao == 1).subquery()
    )


def _epoca_sql():
    """A chave da faixa do ano de morte, em SQL; None sem morte ou fora das faixas."""
    return case(
        *(
            (
                User.morte.between(faixa.inicio, faixa.fim)
                if faixa.inicio is not None
                else User.morte <= faixa.fim,
                faixa.chave,
            )
            for faixa in FAIXAS_DE_EPOCA
        ),
        else_=None,
    )


def _filtrar_por_nome(linhas: list[Row], q: str | None) -> list[Row]:
    """Nome ou @username que contenha o termo, sem diferença de acento e maiúscula."""
    termo = normalizar((q or "").strip().removeprefix("@"))
    if not termo:
        return list(linhas)
    return [
        linha
        for linha in linhas
        if termo in normalizar(linha.name) or termo in normalizar(linha.username)
    ]


def _chave_de_ordem(ordem: Ordem):
    """Alfabética pelo nome normalizado; nas contagens, maior primeiro e empate pelo nome."""

    def por_nome(linha: Row) -> tuple[str, str]:
        return normalizar(linha.name), linha.username

    if ordem == "seguidos":
        return lambda linha: (-linha.seguidores, *por_nome(linha))
    if ordem == "poemas":
        return lambda linha: (-linha.poemas, *por_nome(linha))
    return por_nome
