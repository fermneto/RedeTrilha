from pydantic import BaseModel, field_validator

from app.schemas.user import Nome, Username

# O bcrypt ignora o que passa de 72 bytes: duas senhas iguais até ali
# virariam a mesma senha. Recusamos em vez de truncar calado.
LIMITE_SENHA = 72
MINIMO_SENHA = 8


class RegistroIn(BaseModel):
    username: Username
    name: Nome
    password: str

    # Limites no validador, e não em Field, para as mensagens saírem em português.
    @field_validator("password")
    @classmethod
    def senha_valida(cls, senha: str) -> str:
        if len(senha) < MINIMO_SENHA:
            raise ValueError(f"a senha precisa ter pelo menos {MINIMO_SENHA} caracteres")
        if len(senha.encode("utf-8")) > LIMITE_SENHA:
            raise ValueError(
                f"a senha pode ter no máximo {LIMITE_SENHA} caracteres "
                f"({LIMITE_SENHA} bytes; acentos e emojis ocupam mais de um)"
            )
        return senha


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
