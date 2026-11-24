"""Cache HTTP das rotas que quase não mudam e não dependem de quem pede.

Uso no router: `@router.get(..., dependencies=[cache(60)])`. O header só vai na
resposta de sucesso: um 401 ou 404 sai sem ele.

- `privado` (o padrão): só o navegador guarda. É o caso das rotas com login,
  mesmo quando a resposta é igual para todos: um cache compartilhado (CDN,
  proxy) entregaria a resposta sem conferir o token. `Vary: Authorization`
  separa as entradas de quem trocou de conta no mesmo navegador.
- `publico`: só em rota sem login e sem nada do usuário.

Nunca use em resposta com dado de quem pede (`curti`, `repostei`, `sigo`,
`posso_escrever`): o navegador mostraria o estado antigo depois do clique.
"""

from fastapi import Depends, Response


def cache(segundos: int, publico: bool = False):
    def _cabecalhos(response: Response) -> None:
        alcance = "public" if publico else "private"
        response.headers["Cache-Control"] = f"{alcance}, max-age={segundos}"
        if not publico:
            response.headers["Vary"] = "Authorization"

    return Depends(_cabecalhos)
