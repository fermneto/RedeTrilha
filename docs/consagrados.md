# Consagrados: formato de importação

Os consagrados são usuários normais (aparecem no feed, podem ser seguidos,
curtidos, comentados e repostados), mas **não têm login**: `password_hash` é
`None` e `consagrado` é `True`.

## Fluxo

1. O scraping (em `backend/scripts/scraping/`, fora do app) gera **um JSON por
   poeta** em `backend/data/consagrados/<username>.json`.
2. `uv run python scripts/importar_consagrados.py` lê todos os `*.json` da
   pasta, exceto os que começam com `_`.
3. A importação é **idempotente**: o user é encontrado pelo `username` e o poema
   por (`autor`, `titulo`, `obra`). Rodar duas vezes não duplica nada.
4. `make seed` e o `SEED_ON_BOOT` do deploy chamam a importação.

## Schema

```jsonc
{
  "username": "augusto_dos_anjos",   // [a-z0-9_]{3,30}
  "name": "Augusto dos Anjos",
  "bio": "Poeta paraibano (Cruz do Espírito Santo). Autor de um único livro, Eu.",
  "avatar_url": "https://...",        // opcional, "" se não houver
  "nascimento": 1884,
  "morte": 1914,                      // obrigatório; > 1955 é recusado (domínio público)
  "poemas": [
    {
      "titulo": "Versos Íntimos",     // opcional (null para poemas sem título)
      "texto": "linha 1\nlinha 2\n\nestrofe 2...",  // \n preservados; \n\n separa estrofes
      "forma": "soneto",              // opcional; um de FORMAS (PLANO.md)
      "obra": "Eu",                   // opcional
      "ano": 1912,                    // opcional
      "fonte": "https://pt.wikisource.org/wiki/...",  // obrigatório
      "tags": ["morte", "desilusao"]  // opcional; [a-z0-9_]+, viram #tags no índice
    }
  ]
}
```

## Datas no feed

Como o poema original não tem data de postagem, o importador distribui o
`created_at` dos poemas de cada consagrado nos últimos 30 dias, de forma
determinística (semente = `username`). Assim o feed parece vivo e a importação
segue idempotente.

## Fontes sugeridas

- Wikisource em português (`pt.wikisource.org`)
- Domínio Público (`dominiopublico.gov.br`)

Autores elegíveis em 2026 (mortos até 1955), por exemplo: Augusto dos Anjos,
Olavo Bilac, Castro Alves, Gonçalves Dias, Álvares de Azevedo, Cruz e Sousa,
Alphonsus de Guimaraens, Raimundo Correia, Fernando Pessoa, Florbela Espanca,
Cesário Verde, Antero de Quental e Auta de Souza.
