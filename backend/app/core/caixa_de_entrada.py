"""As regras da caixa de mensagens, em Python puro: onde a conversa cai e até onde se leu.

A caixa não lê as mensagens para se montar. Cada pessoa tem, na sua linha de
`participantes_conversa`, dois números (models/conversa.py):

- `ultima_mensagem_id`: o id da mensagem mais nova da conversa, copiado nas duas
  linhas a cada envio. Ordena a caixa pela última atividade, pelo índice
  (user_id, situacao, ultima_mensagem_id): O(log n + página).
- `ultima_lida_id`: até onde ela leu. Há não lidas quando
  `ultima_mensagem_id > ultima_lida_id`; o "visto" de quem mandou é o
  `ultima_lida_id` do outro lado.

A alternativa, varrer as mensagens agrupando por conversa para achar a última e
contar as não lidas, custa O(m) nas m mensagens da pessoa a cada abertura da
caixa (scripts/bench_mensagens.py compara as duas).
"""

CAIXA = "caixa"
PEDIDO = "pedido"
RECUSADA = "recusada"


def situacao_de_quem_recebe(segue_quem_manda: bool) -> str:
    """Como no X: de quem você segue, direto na caixa; de quem não segue, um pedido."""
    return CAIXA if segue_quem_manda else PEDIDO


def avancar_leitura(lida: int, ate: int | None, ultima: int | None) -> int:
    """A nova `ultima_lida_id`: até `ate` (ou até a última, sem `ate`), nunca para trás
    e nunca além da última mensagem que existe."""
    if ultima is None:
        return lida
    alvo = ultima if ate is None else min(ate, ultima)
    return max(lida, alvo)
