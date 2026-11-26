"""O que cada pessoa já viu no feed, guardado entre uma sessão e outra.

O cursor (`core/vistos.py`) evita repetir dentro de uma sessão de leitura; esta
tabela faz o mesmo entre sessões: o "Para você" inédito e os consagrados da
continuação pulam o que a pessoa já viu em qualquer sessão anterior. No "Para
você", o item já visto volta quando tem atividade nova (repost, comentário,
estrofe) depois do `visto_em`, como um poema que sobe no feed.

O que conta como visto é o que o front avisa (`POST /feed/vistos`): a folha que
apareceu na tela, não tudo o que a página carregou adiantado.

Custo:
- marcar: um `INSERT ... ON CONFLICT DO UPDATE` por lote (até 100 itens), na
  chave primária (user_id, tipo, alvo_id): O(k log n). Ver de novo atualiza o
  `visto_em`, senão o item que voltou por atividade nova voltaria sempre;
- `vistos_em`: uma varredura do prefixo `user_id` da chave primária, O(v log n)
  com v = o que a pessoa já viu (no máximo, os itens da rede);
- `nao_visto`: um `NOT EXISTS` por linha candidata, cada um uma busca na chave
  primária, O(log n).
"""

from datetime import datetime

from sqlalchemy import ColumnElement, exists, select
from sqlalchemy.dialects.postgresql import insert as insert_postgres
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.orm import Session

from app.core.datas import agora_utc
from app.models.visto_no_feed import VistoNoFeed
from app.schemas.visto_no_feed import VistosIn
from app.services.cursor import utc_sem_fuso

Chave = tuple[str, int]


def marcar(db: Session, user_id: int, dados: VistosIn) -> None:
    linhas = [
        {"user_id": user_id, "tipo": tipo, "alvo_id": alvo_id}
        for tipo, alvo_id in sorted({(item.tipo, item.id) for item in dados.itens})
    ]
    inserir = insert_postgres if db.get_bind().dialect.name == "postgresql" else insert_sqlite
    agora = agora_utc()
    consulta = inserir(VistoNoFeed).values([{**linha, "visto_em": agora} for linha in linhas])
    db.execute(
        consulta.on_conflict_do_update(
            index_elements=["user_id", "tipo", "alvo_id"],
            set_={"visto_em": consulta.excluded.visto_em},
        )
    )
    db.commit()


def vistos_em(db: Session, user_id: int) -> dict[Chave, datetime]:
    """Tudo o que a pessoa já viu no feed, das chaves do cursor ("poema", 12) para
    a última vez que viu (UTC sem fuso, como as datas do feed)."""
    return {
        (tipo, alvo_id): utc_sem_fuso(visto_em)
        for tipo, alvo_id, visto_em in db.execute(
            select(VistoNoFeed.tipo, VistoNoFeed.alvo_id, VistoNoFeed.visto_em).where(
                VistoNoFeed.user_id == user_id
            )
        )
    }


def nao_visto(user_id: int, tipo: str, alvo_id: ColumnElement[int]) -> ColumnElement[bool]:
    """Filtro SQL: a pessoa ainda não viu este item no feed."""
    return ~exists().where(
        VistoNoFeed.user_id == user_id,
        VistoNoFeed.tipo == tipo,
        VistoNoFeed.alvo_id == alvo_id,
    )
