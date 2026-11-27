"""Tradução de poemas sob demanda com a API da Anthropic (Claude Haiku 5.5).

Uma tradução por (poema, língua) fica na tabela `traducoes`: o mesmo pedido não
chama a API de novo. A chave vem só de ANTHROPIC_API_KEY; sem ela, 503.
O cliente é criado na primeira tradução que não está em cache, e os testes
trocam `_cliente` por um falso (nunca chamam a API real).

Formato da resposta: texto simples, com a primeira linha "TÍTULO: ..." quando o
poema tem título. É mais simples que structured outputs (JSON), e o poema sai
sem escapes, com as quebras de linha e os recuos como o modelo os escreveu.

O poema pode ter negrito, itálico, sublinhado e tachado no formato do Verso
(core/marcas.py). O modelo é instruído a manter as marcas nos mesmos versos;
se elas voltam quebradas (um `**` que não fecha) ou inventadas num poema sem
marcas, a tradução é gravada sem formatação, para a tela não mostrar lixo.
"""

import logging
import os
from datetime import UTC, datetime, timedelta

import anthropic
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.marcas import marcas_quebradas, sem_marcas_quebradas, tem_marcas
from app.models.post import Post
from app.models.traducao import Traducao
from app.models.user import User
from app.schemas.traducao import TraducaoOut
from app.services.cursor import utc_sem_fuso
from app.services.posts import original_visivel

logger = logging.getLogger(__name__)

MODELO = "claude-haiku-5-5"
MAX_TOKENS = 16000
ROTULO_TITULO = "TÍTULO:"

INDISPONIVEL = "tradução indisponível no momento"
FALHOU = "não foi possível traduzir este poema; tente de novo mais tarde"
LIMITE_ATINGIDO = "limite de traduções atingido, tente mais tarde"
# Traduções novas por usuário numa janela deslizante (as do cache não contam).
LIMITE_POR_JANELA = 30
JANELA_DO_LIMITE = timedelta(hours=1)

PROMPT_SISTEMA = f"""Você é tradutor literário de poesia. Traduza o poema que o usuário enviar \
para a língua de destino indicada, com fidelidade ao sentido, ao tom, ao registro e às imagens \
do original.

Preserve EXATAMENTE a estrutura do poema:
- o mesmo número de versos, um verso traduzido em cada linha, com a quebra de linha no mesmo lugar;
- o mesmo número de estrofes, com as linhas em branco entre elas nos mesmos lugares;
- os recuos (espaços no começo do verso) como estão no original.
Não junte nem divida versos.

O poema pode ter formatação em marcas: **negrito**, *itálico*, ++sublinhado++ e ~~tachado~~, \
com \\ antes de um *, + ou ~ literal. Mantenha cada marca em volta das palavras traduzidas \
correspondentes, no mesmo verso; abra e feche a marca dentro do verso, nunca atravessando a \
quebra de linha. Não acrescente marcas que não estejam no original.

Responda só com a tradução, sem notas, sem explicações, sem comentários e sem aspas ou \
marcações que não estejam no original.

Formato da resposta:
- Se o pedido trouxer uma linha "{ROTULO_TITULO} ...", a primeira linha da resposta é \
"{ROTULO_TITULO} " seguido do título traduzido; depois, uma linha em branco; depois, o poema \
traduzido.
- Se o pedido não trouxer título, a resposta é só o poema traduzido."""

_cliente: anthropic.Anthropic | None = None


def cliente() -> anthropic.Anthropic:
    """O cliente da Anthropic, criado na primeira vez. Sem ANTHROPIC_API_KEY, 503."""
    global _cliente
    if _cliente is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise HTTPException(status_code=503, detail=INDISPONIVEL)
        _cliente = anthropic.Anthropic()
    return _cliente


def traduzir(db: Session, usuario: User, post_id: int, para: str) -> TraducaoOut:
    """Tradução do poema `post_id` para `para`; repost puro traduz o original.
    404 também se o autor bloqueou quem pede, como no GET do poema.

    Só a tradução nova conta no limite do usuário (30 por hora); a do cache é livre.
    """
    post = original_visivel(db, usuario, post_id)
    if post.idioma == para:
        raise HTTPException(status_code=422, detail="o poema já está nessa língua")

    traducao = _do_cache(db, post.id, para)
    if traducao is not None:
        return _saida(traducao, post, em_cache=True)

    if traducoes_recentes(db, usuario.id) >= LIMITE_POR_JANELA:
        raise HTTPException(status_code=429, detail=LIMITE_ATINGIDO)

    titulo, texto = _chamar_modelo(post, para)
    traducao = Traducao(
        post_id=post.id,
        idioma_destino=para,
        titulo=titulo,
        texto=texto,
        modelo=MODELO,
        pedida_por_id=usuario.id,
    )
    db.add(traducao)
    try:
        db.commit()
    except IntegrityError:
        # Um pedido simultâneo gravou a mesma tradução primeiro: fica a dele.
        db.rollback()
        traducao = _do_cache(db, post.id, para)
    return _saida(traducao, post, em_cache=False)


def traducoes_recentes(db: Session, usuario_id: int) -> int:
    """Traduções novas que a pessoa pediu na última hora, contadas na tabela `traducoes`.

    Sem estado no processo: todo worker conta as mesmas linhas. O índice
    (pedida_por_id, created_at) deixa a contagem em O(log n + c), c <= 30.
    """
    inicio = utc_sem_fuso(datetime.now(UTC) - JANELA_DO_LIMITE)
    return db.scalar(
        select(func.count())
        .select_from(Traducao)
        .where(Traducao.pedida_por_id == usuario_id, Traducao.created_at > inicio)
    ) or 0


def montar_pedido(post: Post, para: str) -> str:
    """Mensagem do usuário: as línguas, o título (se houver) e o poema exatamente como está."""
    origem = post.idioma or "desconhecida (identifique pelo texto)"
    partes = [
        f"Língua de origem (ISO 639-1): {origem}",
        f"Língua de destino (ISO 639-1): {para}",
        "",
    ]
    if post.titulo:
        partes += [f"{ROTULO_TITULO} {post.titulo}", ""]
    partes.append(post.texto)
    return "\n".join(partes)


def separar_resposta(resposta: str, com_titulo: bool) -> tuple[str | None, str]:
    """(título, poema) da resposta do modelo. Sem título pedido, a resposta toda é o poema."""
    if not com_titulo or not resposta.startswith(ROTULO_TITULO):
        return None, resposta
    primeira, _, resto = resposta.partition("\n")
    titulo = primeira.removeprefix(ROTULO_TITULO).strip() or None
    # A linha em branco que separa o título do poema não faz parte do poema.
    return titulo, resto.removeprefix("\n")


def _do_cache(db: Session, post_id: int, para: str) -> Traducao | None:
    return db.scalar(
        select(Traducao).where(Traducao.post_id == post_id, Traducao.idioma_destino == para)
    )


def _chamar_modelo(post: Post, para: str) -> tuple[str | None, str]:
    # Thinking adaptativo (padrão do Haiku 5.5): sem `thinking`, sem temperature.
    try:
        resposta = cliente().messages.create(
            model=MODELO,
            max_tokens=MAX_TOKENS,
            system=PROMPT_SISTEMA,
            messages=[{"role": "user", "content": montar_pedido(post, para)}],
        )
    except anthropic.AuthenticationError:
        logger.error("tradução: a API recusou a ANTHROPIC_API_KEY")
        raise HTTPException(status_code=503, detail=INDISPONIVEL)
    except anthropic.RateLimitError:
        logger.warning("tradução: limite de requisições da API atingido")
        raise HTTPException(status_code=503, detail=INDISPONIVEL)
    except anthropic.APIStatusError as erro:
        logger.error("tradução: a API respondeu %s", erro.status_code)
        if erro.status_code >= 500:
            raise HTTPException(status_code=503, detail=INDISPONIVEL)
        raise HTTPException(status_code=502, detail=FALHOU)
    except anthropic.APIConnectionError:
        logger.warning("tradução: sem conexão com a API")
        raise HTTPException(status_code=503, detail=INDISPONIVEL)

    # Recusa ou tradução cortada não vão para o cache.
    if resposta.stop_reason in ("refusal", "max_tokens"):
        logger.warning(
            "tradução do poema %s para %s parou com stop_reason=%s",
            post.id,
            para,
            resposta.stop_reason,
        )
        raise HTTPException(status_code=502, detail=FALHOU)

    texto_resposta = "".join(b.text for b in resposta.content if b.type == "text")
    titulo, texto = separar_resposta(texto_resposta, com_titulo=bool(post.titulo))
    if not texto.strip():
        logger.warning("tradução do poema %s para %s veio vazia", post.id, para)
        raise HTTPException(status_code=502, detail=FALHOU)

    texto = formatacao_da_traducao(post.texto, texto, post.id, para)
    linhas_original, linhas_traducao = post.texto.count("\n") + 1, texto.count("\n") + 1
    if linhas_original != linhas_traducao:
        # Aceita mesmo assim: uma linha a mais ou a menos não invalida a tradução.
        logger.warning(
            "tradução do poema %s para %s tem %d linhas; o original tem %d",
            post.id,
            para,
            linhas_traducao,
            linhas_original,
        )
    return titulo, texto


def formatacao_da_traducao(original: str, traducao: str, post_id: int, para: str) -> str:
    """A tradução com as marcas, se elas vieram inteiras; senão, sem formatação."""
    if marcas_quebradas(traducao) or (tem_marcas(traducao) and not tem_marcas(original)):
        logger.warning(
            "tradução do poema %s para %s veio com marcas quebradas ou a mais; gravada sem formatação",
            post_id,
            para,
        )
        return sem_marcas_quebradas(traducao)
    return traducao


def _saida(traducao: Traducao, post: Post, em_cache: bool) -> TraducaoOut:
    return TraducaoOut(
        titulo=traducao.titulo,
        texto=traducao.texto,
        idioma_origem=post.idioma,
        idioma_destino=traducao.idioma_destino,
        modelo=traducao.modelo,
        em_cache=em_cache,
    )
