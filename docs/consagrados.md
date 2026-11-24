# Consagrados: formato de importação

Os consagrados são usuários normais (aparecem no feed, podem ser seguidos,
curtidos, comentados e repostados), mas **não têm login**: `password_hash` é
`None` e `consagrado` é `True`.

## Fluxo

1. O scraping (feito fora do repositório) gera **um JSON por
   poeta** em `backend/data/consagrados/<username>.json`.
2. `uv run python scripts/importar_consagrados.py` lê todos os `*.json` da
   pasta, exceto os que começam com `_`.
3. A importação é **idempotente**: o user é encontrado pelo `username` e o poema
   por (`autor`, `titulo`, `obra`). Rodar duas vezes não duplica nada.
4. `make seed` e o `SEED_ON_BOOT` do deploy chamam a importação.
5. Tudo ou nada: todos os JSONs são validados antes de gravar, e a gravação é
   uma transação só. Um arquivo inválido (por exemplo, `morte > 1955`) não
   grava nada. Um `username` que já é de uma conta comum também aborta tudo.
6. As `tags` de cada poema vão para a coluna `tags_extras` do `Post` e somam-se
   às `#hashtags` do texto e à forma no índice de tags.
   Um poema marcado como `soneto` só fica com essa forma se tiver 14 versos
   não vazios; senão entra com `forma` nula (o texto não muda). Uma primeira
   linha que seja só cabeçalho de numeração ("Sonnet LXXV", "Soneto XII",
   "XIV") não conta. A regra é `forma_coerente`, em `app/schemas/consagrado.py`.
   As tags que são nome de língua (`portugues`, `latim`, `persa`…, lista em
   `TAGS_DE_LINGUA` no importador) ficam fora de `tags_extras`; o JSON não muda.
   A forma `outro` não vira tag (as outras formas viram).
7. O índice de tags vive em memória e é reconstruído no startup da API. Se o
   importador rodar com o servidor de pé, as tags novas só aparecem no
   `/tags/...` depois de reiniciar o servidor.
8. Reimportar atualiza o perfil e os poemas, mas não muda o `created_at` (a
   data do poema no feed) nem apaga poemas que saíram do JSON.

## Schema

```jsonc
{
  "username": "augusto_dos_anjos",   // [a-z0-9_]{3,30}
  "name": "Augusto dos Anjos",
  "bio": "Poeta paraibano (Cruz do Espírito Santo). Autor de um único livro, Eu.",
  "avatar_url": "https://...",        // opcional, "" se não houver
  "nascimento": 1884,                 // opcional (ano incerto → omita); perfil mostra só "† 1914"
  "morte": 1914,                      // obrigatório; > 1955 é recusado (domínio público)
  "poemas": [
    {
      "titulo": "Versos Íntimos",     // opcional (null para poemas sem título)
      "texto": "linha 1\nlinha 2\n\nestrofe 2...",  // \n preservados; \n\n separa estrofes
      "forma": "soneto",              // opcional; um de FORMAS (PLANO.md); soneto exige 14 versos
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
