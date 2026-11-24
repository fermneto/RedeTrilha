"""Prepara o banco UMA vez antes da API subir: tabelas e, com SEED_ON_BOOT=true, o seed.

É o comando do serviço `seed` em deploy/oracle/compose.yaml. A API roda com
vários workers e SEED_ON_BOOT=false, então o seed nunca roda em paralelo.
Rode com: python scripts/preparar_banco.py (de backend/).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import preparar_banco  # noqa: E402

if __name__ == "__main__":
    preparar_banco()
    print("banco pronto")
