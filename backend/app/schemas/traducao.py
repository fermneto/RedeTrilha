from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.idioma import validar_idioma


class TraducaoPedido(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Código ISO 639-1 da língua de destino, em minúsculas ("pt", "en", "zh").
    para: str

    _para = field_validator("para")(validar_idioma)


class TraducaoOut(BaseModel):
    titulo: str | None
    texto: str
    # None quando a língua do poema é desconhecida.
    idioma_origem: str | None
    idioma_destino: str
    modelo: str
    # True quando veio da tabela `traducoes`, sem chamar a API.
    em_cache: bool
