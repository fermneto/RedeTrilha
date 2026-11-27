"""Oficina do compositor: análise de métrica e rima de um rascunho (nada é gravado)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.limites import OFICINA_MAX_CARACTERES
from app.schemas.entrada import Entrada
from app.schemas.post import validar_forma


class AnalisePedido(Entrada):
    model_config = ConfigDict(extra="forbid")

    # Analisado como veio: nada de strip, as quebras de linha alinham as marcas.
    texto: str = Field(max_length=OFICINA_MAX_CARACTERES)
    # Só para o aviso de forma (soneto, haicai); as outras formas não avisam.
    forma: str | None = None

    _forma = field_validator("forma")(validar_forma)


class VersoAnalisado(BaseModel):
    # None em linha em branco ou sem palavras.
    silabas: int | None
    # Letra do esquema ("A", "B"...).
    rima: str | None
    # None quando o verso não rima com nenhum outro.
    tipo_rima: Literal["consoante", "toante"] | None


class AnaliseOut(BaseModel):
    # Um item por linha de texto.split("\n"), na mesma ordem.
    versos: list[VersoAnalisado]
    # "ABBA ABBA CDC DCD": estrofes separadas por espaço.
    esquema: str
    aviso: str | None
