import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.consagrado import Consagrado
from scripts.importar_consagrados import (
    PASTA_CONSAGRADOS,
    ArquivoConsagradoInvalido,
    datas_dos_poemas,
    ler_consagrados,
)

AGORA = datetime(2026, 11, 25, 12, 0, tzinfo=UTC)


def consagrado(**campos) -> dict:
    poema = {
        "titulo": "Poema",
        "texto": "verso um\nverso dois",
        "forma": "soneto",
        "fonte": "https://pt.wikisource.org/wiki/Poema",
        "tags": ["morte"],
    }
    poema.update(campos.pop("poema", {}))
    dados = {
        "username": "poeta_teste",
        "name": "Poeta Teste",
        "nascimento": 1884,
        "morte": 1914,
        "poemas": [poema],
    }
    dados.update(campos)
    return dados


def escrever(pasta: Path, nome: str, dados: dict) -> None:
    (pasta / nome).write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")


def test_exemplo_segue_o_schema():
    exemplo = Consagrado.model_validate_json(
        (PASTA_CONSAGRADOS / "_exemplo.json").read_text(encoding="utf-8")
    )
    assert exemplo.username == "augusto_dos_anjos"
    assert exemplo.poemas[0].forma == "soneto"
    assert "\n\n" in exemplo.poemas[0].texto


def test_morte_depois_de_1955_e_recusada():
    with pytest.raises(ValidationError, match="domínio público"):
        Consagrado.model_validate(consagrado(nascimento=1902, morte=1987))


def test_nascimento_depois_da_morte_e_recusado():
    with pytest.raises(ValidationError, match="anterior à morte"):
        Consagrado.model_validate(consagrado(nascimento=1920, morte=1914))


def test_forma_invalida_e_recusada():
    with pytest.raises(ValidationError, match="forma deve ser uma de"):
        Consagrado.model_validate(consagrado(poema={"forma": "epopeia"}))


def test_fonte_e_obrigatoria_e_tag_fora_do_padrao_e_recusada():
    sem_fonte = consagrado()
    del sem_fonte["poemas"][0]["fonte"]
    with pytest.raises(ValidationError):
        Consagrado.model_validate(sem_fonte)
    with pytest.raises(ValidationError, match="tag inválida"):
        Consagrado.model_validate(consagrado(poema={"tags": ["Solidão"]}))


def test_texto_vazio_e_sem_poemas_sao_recusados():
    with pytest.raises(ValidationError, match="vazio"):
        Consagrado.model_validate(consagrado(poema={"texto": "  \n\n  "}))
    with pytest.raises(ValidationError):
        Consagrado.model_validate(consagrado(poemas=[]))


def test_quebras_de_linha_e_recuos_preservados():
    texto = "\n  primeiro verso\n    recuado\n\nnova estrofe  \n"
    lido = Consagrado.model_validate(consagrado(poema={"texto": texto}))
    assert lido.poemas[0].texto == texto


def test_le_a_pasta_em_ordem_e_ignora_rascunhos(tmp_path):
    escrever(tmp_path, "olavo_bilac.json", consagrado(username="olavo_bilac"))
    escrever(tmp_path, "castro_alves.json", consagrado(username="castro_alves"))
    escrever(tmp_path, "_rascunho.json", consagrado(username="rascunho"))
    lidos = ler_consagrados(tmp_path)
    assert [c.username for c in lidos] == ["castro_alves", "olavo_bilac"]


def test_arquivo_invalido_traz_o_nome_no_erro(tmp_path):
    escrever(tmp_path, "valido.json", consagrado())
    escrever(tmp_path, "vivo_demais.json", consagrado(morte=1987))
    with pytest.raises(ArquivoConsagradoInvalido, match=r"vivo_demais\.json.*domínio público"):
        ler_consagrados(tmp_path)


def test_json_malformado_traz_o_nome_no_erro(tmp_path):
    (tmp_path / "quebrado.json").write_text("{ nao e json", encoding="utf-8")
    with pytest.raises(ArquivoConsagradoInvalido, match=r"quebrado\.json"):
        ler_consagrados(tmp_path)


def test_datas_deterministicas_ordenadas_e_nos_ultimos_30_dias():
    datas = datas_dos_poemas("augusto_dos_anjos", 10, AGORA)
    assert datas == datas_dos_poemas("augusto_dos_anjos", 10, AGORA)
    assert datas != datas_dos_poemas("olavo_bilac", 10, AGORA)
    assert datas == sorted(datas)
    assert len(datas) == 10
    assert all(AGORA - timedelta(days=30) <= d <= AGORA for d in datas)
    assert all(d.tzinfo == UTC for d in datas)
