from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.escola import validar_escolas
from app.schemas.post import FORMAS
from app.schemas.regiao import BRASIL, UFS, validar_pais


class Preferencias(BaseModel):
    """As preferências da pessoa (`GET` e `PUT /preferencias`), todas opcionais.

    O `PUT` troca tudo: o que não vier volta ao vazio.
    """

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    escolas: list[str] = []
    formas: list[str] = []
    pais: str | None = None
    uf: str | None = None
    # O país e a UF aparecem nos gostos públicos do perfil? Padrão: sim.
    mostrar_lugar: bool = True

    _escolas = field_validator("escolas")(validar_escolas)
    _pais = field_validator("pais")(validar_pais)

    @field_validator("formas")
    @classmethod
    def _formas_validas(cls, formas: list[str]) -> list[str]:
        for forma in formas:
            if forma not in FORMAS:
                raise ValueError(f"forma inválida {forma!r}: use uma de {', '.join(FORMAS)}")
        return list(dict.fromkeys(formas))

    @field_validator("uf")
    @classmethod
    def _uf_valida(cls, uf: str | None) -> str | None:
        if uf is not None and uf not in UFS:
            raise ValueError(f"estado inválido {uf!r}: use a sigla da UF, como PB")
        return uf

    @model_validator(mode="after")
    def _uf_so_no_brasil(self) -> "Preferencias":
        if self.uf is not None and self.pais != BRASIL:
            raise ValueError("o estado (UF) só vale com o país BR")
        return self


class Opcao(BaseModel):
    codigo: str
    rotulo: str


class OpcoesDePreferencias(BaseModel):
    """O vocabulário das telas do onboarding: o front não copia as listas."""

    escolas: list[Opcao]
    formas: list[str]
    paises: list[str]
    ufs: list[Opcao]
