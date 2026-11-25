"""Cartão de compartilhamento: as leituras sem login que o front usa para montar
a imagem e os metadados do link (lib/cartaoServidor.tsx). Só o mínimo do cartão;
a página do poema, do perfil, da renga e da antologia continua pedindo login."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache_http import cache
from app.db import get_db
from app.schemas.cartao import CartaoAntologia, CartaoPoema, CartaoRenga, CartaoUsuario
from app.services import cartoes as service

# Sem login e sem dado de quem pede: cache `public` curto, que a Vercel e o
# navegador podem guardar (o poema publicado não muda; o perfil e a renga, pouco).
CACHE = [cache(300, publico=True)]

router = APIRouter(prefix="/cartoes", tags=["cartões"])


@router.get("/poema/{post_id}", response_model=CartaoPoema, dependencies=CACHE)
def cartao_do_poema(post_id: int, db: Session = Depends(get_db)):
    return service.poema(db, post_id)


@router.get("/usuario/{username}", response_model=CartaoUsuario, dependencies=CACHE)
def cartao_do_usuario(username: str, db: Session = Depends(get_db)):
    return service.usuario(db, username)


@router.get("/renga/{renga_id}", response_model=CartaoRenga, dependencies=CACHE)
def cartao_da_renga(renga_id: int, db: Session = Depends(get_db)):
    return service.renga(db, renga_id)


@router.get("/antologia/{antologia_id}", response_model=CartaoAntologia, dependencies=CACHE)
def cartao_da_antologia(antologia_id: int, db: Session = Depends(get_db)):
    return service.antologia(db, antologia_id)
