from pydantic import BaseModel, Field


class RegistroIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
