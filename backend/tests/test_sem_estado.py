"""A API sem estado no processo: o que um worker grava, o outro vê.

O "outro processo" é um interpretador Python de verdade (subprocess), com a sua
própria instância da API apontando para o mesmo banco de teste. Se o índice de
tags ou o limite de tradução morassem na memória, ele não veria nada daqui.
"""

import subprocess
import sys
import textwrap
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]

# Roda no outro processo: uma API nova, com o cliente da Anthropic falso.
PREAMBULO = """
import sys
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.main import app
from app.services import traducao

resposta = SimpleNamespace(
    stop_reason="end_turn", content=[SimpleNamespace(type="text", text="um verso")]
)
traducao._cliente = SimpleNamespace(messages=SimpleNamespace(create=lambda **_: resposta))
headers = {"Authorization": sys.argv[1]}
"""


def em_outro_processo(codigo: str, autorizacao: str) -> None:
    """Roda `codigo` (depois do PREAMBULO) num processo novo; falha se ele falhar."""
    programa = PREAMBULO + textwrap.dedent(codigo)
    resultado = subprocess.run(
        [sys.executable, "-c", programa, autorizacao],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert resultado.returncode == 0, resultado.stderr


def test_dois_processos_veem_o_mesmo_em_alta(client, logar):
    ana = logar("ana")
    client.post("/posts", json={"texto": "a maré de ontem\n#mar"}, headers=ana)

    em_outro_processo(
        """
        with TestClient(app) as outro:
            r = outro.post("/posts", json={"texto": "a chuva fina\\n#chuva #mar"}, headers=headers)
            assert r.status_code == 201, r.text
            itens = outro.get("/tags/trending", headers=headers).json()["items"]
            assert [(i["tag"], i["contagem"]) for i in itens] == [("mar", 2), ("chuva", 1)], itens
        """,
        ana["Authorization"],
    )

    itens = client.get("/tags/trending", headers=ana).json()["items"]
    assert itens == [
        {"tag": "mar", "contagem": 2, "trecho": "a chuva fina"},
        {"tag": "chuva", "contagem": 1, "trecho": "a chuva fina"},
    ]
    assert client.get("/tags/busca?q=ch", headers=ana).json() == {
        "items": [{"tag": "chuva", "poemas": 1}]
    }


def test_limite_de_traducao_vale_entre_processos(client, logar, monkeypatch):
    from types import SimpleNamespace

    from app.schemas.idioma import IDIOMAS
    from app.services import traducao

    ana = logar("ana")
    post_id = client.post("/posts", json={"texto": "um verso", "idioma": "pt"}, headers=ana).json()["id"]
    *trinta, trigesima_primeira = sorted(IDIOMAS - {"pt"})[:31]

    em_outro_processo(
        f"""
        with TestClient(app) as outro:
            for para in {trinta!r}:
                r = outro.post("/posts/{post_id}/traduzir", json={{"para": para}}, headers=headers)
                assert r.status_code == 200, r.text
        """,
        ana["Authorization"],
    )

    resposta = SimpleNamespace(
        stop_reason="end_turn", content=[SimpleNamespace(type="text", text="un verso")]
    )
    monkeypatch.setattr(
        traducao, "_cliente", SimpleNamespace(messages=SimpleNamespace(create=lambda **_: resposta))
    )
    r = client.post(f"/posts/{post_id}/traduzir", json={"para": trigesima_primeira}, headers=ana)
    assert (r.status_code, r.json()["detail"]) == (429, traducao.LIMITE_ATINGIDO)


def test_populador_e_idempotente(client, como):
    from sqlalchemy import delete, select

    from app.db import SessionLocal
    from app.models.post_tag import PostTag
    from app.services import indice_tags

    client.post("/posts", json={"texto": "#lua #mar", "forma": "haicai"}, headers=como("ana"))
    client.post("/posts", json={"texto": "#lua"}, headers=como("bia"))

    def linhas() -> list[tuple[int, str]]:
        with SessionLocal() as db:
            return list(db.execute(select(PostTag.post_id, PostTag.tag).order_by(PostTag.post_id, PostTag.tag)))

    gravadas = linhas()
    assert len(gravadas) == 4
    with SessionLocal() as db:
        db.execute(delete(PostTag))
        db.commit()
        assert indice_tags.popular(db) == 4
        assert indice_tags.popular(db) == 4
    assert linhas() == gravadas
