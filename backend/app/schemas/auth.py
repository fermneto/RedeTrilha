from pydantic import BaseModel, field_validator

from app.core.limites import SENHA_MAX, SENHA_MIN
from app.schemas.user import Nome, Username


class RegistroIn(BaseModel):
    username: Username
    name: Nome
    password: str

    # Limites no validador, e não em Field, para as mensagens saírem em português.
    @field_validator("password")
    @classmethod
    def senha_valida(cls, senha: str) -> str:
        if len(senha) < SENHA_MIN:
            raise ValueError(f"a senha precisa ter pelo menos {SENHA_MIN} caracteres")
        if len(senha.encode("utf-8")) > SENHA_MAX:
            raise ValueError(
                f"a senha pode ter no máximo {SENHA_MAX} caracteres "
                f"({SENHA_MAX} bytes; acentos e emojis ocupam mais de um)"
            )
        return senha


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
