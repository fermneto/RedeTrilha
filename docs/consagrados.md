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
7. As tags de cada poema entram no índice (`post_tags`) na mesma transação da
   importação. Com o servidor de pé, aparecem no `/tags/...` na hora.
8. Reimportar atualiza o perfil e os poemas, mas não muda o `created_at` (a
   data do poema no feed) nem apaga poemas que saíram do JSON.
9. **Sem poema repetido.** O scraper às vezes traz, no mesmo JSON, o poema
   inteiro e um trecho dele ("estrofes iniciais", uma estrofe solta), ou o
   mesmo texto em duas edições ou grafias ("Allucinação" e "Alucinação"). O
   importador deixa de fora o que é trecho ou cópia de outro poema do mesmo
   autor e fica com a versão mais completa (`app/core/duplicados.py`: o texto
   sem marcas, acentos e pontuação do menor cabe no maior, ao menos 90% dele em
   trechos de 12 caracteres seguidos). Os bancos importados antes disso se
   consertam com `scripts/fundir_poemas_repetidos.py` (`--simular`, o padrão,
   só lista; `--aplicar` funde as curtidas, comentários, reposts, citações,
   antologias, mensagens e avisos no poema que fica e apaga as cópias). Faça
   backup antes de `--aplicar`; o script não roda no boot.
   Versões diferentes de um poema que o autor reescreveu passam nessa regra e
   não são repetição: os pares decididos à mão ficam em
   `backend/data/consagrados/_versoes_distintas.json` (por `autor`, o username,
   e os dois `titulos`, que valem em qualquer banco), e o importador, o seed e
   o script mantêm os dois. Hoje: o "Prometheus" de Goethe (frühe e späte
   Fassung) e "Freygeisterey der Leidenschaft" / "Der Kampf" de Schiller. Com
   eles, os JSONs dão 160 grupos e 283 poemas de fora.

10. **Título sem o caminho do Wikisource.** O scraper guardou como título o
   nome da página do Wikisource: o caminho até o poema ("Eu (Augusto dos
   Anjos, 1912)/Vozes de um Tumulo", "Leaves of Grass (1882)/Calamus/...") ou
   o poema com o autor entre parênteses ("O Mar (Augusto dos Anjos)", "Vida
   (Álvares de Azevedo) — E as páginas..."). O JSON não muda: o importador
   grava só o nome do poema, e a obra e o ano do caminho preenchem os que
   faltam (o ano só se a obra do poema é o livro do caminho). Quando dois
   poemas do autor ficariam com o mesmo (`titulo`, `obra`), cada um leva a
   seção do caminho entre parênteses ("Carmen I (Liber II)"); se nem assim,
   fica o título original. A regra é `app/core/titulos.py`, aplicada depois de
   tirar os repetidos. Os bancos importados antes se consertam com
   `scripts/corrigir_titulos_consagrados.py` (`--dry-run` lista antes → depois;
   sem ele, aplica), que leva cada poema ao mesmo resultado do importador, para
   a próxima importação achá-lo. A ordem com `fundir_poemas_repetidos.py` não
   importa: os pares de `_versoes_distintas.json` trazem o título antigo e o
   novo ("Der Kampf (Friedrich Schiller)" e "Der Kampf").

## Schema

```jsonc
{
  "username": "augusto_dos_anjos",   // [a-z0-9_]{3,30}
  "name": "Augusto dos Anjos",
  "bio": "Poeta paraibano (Cruz do Espírito Santo). Autor de um único livro, Eu.",
  "avatar_url": "https://...",        // opcional, até 500 caracteres; "" se não houver
  "nascimento": 1884,                 // opcional (ano incerto → omita); perfil mostra só "† 1914"
  "morte": 1914,                      // obrigatório; > 1955 é recusado (domínio público)
  "escolas": ["simbolismo", "pre_modernismo"],  // opcional; códigos de ESCOLAS (abaixo)
  "pais": "BR",                       // opcional; ISO 3166-1 alfa-2 do país onde nasceu, nas fronteiras de hoje; null se não há como dizer
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

## Escolas e país

`escolas` e `pais` são opcionais e servem às sugestões de quem seguir (escolas
em comum com o que a pessoa marcou no onboarding, mesmo país). O importador os
grava na tabela `atributos_consagrado` (uma linha por consagrado, atualizada a
cada reimportação; campo ausente grava `[]` / `null`). Valor fora da lista
aborta a importação, como qualquer arquivo inválido.

Códigos de `escolas` (`backend/app/schemas/escola.py`):

| Código | Rótulo |
|---|---|
| `antiguidade_classica` | antiguidade clássica |
| `medieval_trovadorismo` | medieval e trovadorismo |
| `renascimento_classicismo` | renascimento e classicismo |
| `barroco` | barroco |
| `arcadismo_neoclassicismo` | arcadismo e neoclassicismo |
| `romantismo` | romantismo |
| `realismo` | realismo |
| `parnasianismo` | parnasianismo |
| `simbolismo` | simbolismo |
| `modernismo_hispanico` | modernismo hispânico |
| `pre_modernismo` | pré-modernismo |
| `modernismo_vanguardas` | modernismo e vanguardas |
| `popular_cordel` | poesia popular e cordel |
| `classica_oriental` | clássica oriental |
| `classica_arabe_persa` | clássica árabe e persa |

`pais` usa os códigos de `backend/app/schemas/regiao.py` (ISO 3166-1 alfa-2,
em maiúsculas: `BR`, `PT`, `FR`).

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
