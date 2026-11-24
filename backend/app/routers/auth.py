from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import LoginIn, RegistroIn, TokenOut
from app.schemas.user import UserOut
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/registro", response_model=UserOut, status_code=201)
def registrar(dados: RegistroIn, db: Session = Depends(get_db)):
    return service.registrar(db, dados)


@router.post("/login", response_model=TokenOut)
def logar(dados: LoginIn, db: Session = Depends(get_db)):
    return TokenOut(token=service.logar(db, dados))


@router.get("/eu", response_model=UserOut)
def eu(user: User = Depends(get_current_user)):
    return user
