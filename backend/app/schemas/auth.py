from pydantic import BaseModel, Field, field_validator

# O bcrypt ignora o que passa de 72 bytes: duas senhas iguais até ali
# virariam a mesma senha. Recusamos em vez de truncar calado.
LIMITE_SENHA = 72


class RegistroIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=LIMITE_SENHA)

    # mode="before" roda antes do max_length, para a mensagem sair em português.
    @field_validator("password", mode="before")
    @classmethod
    def senha_cabe_no_bcrypt(cls, senha: object) -> object:
        if isinstance(senha, str) and len(senha.encode("utf-8")) > LIMITE_SENHA:
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
