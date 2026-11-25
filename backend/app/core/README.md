# core/: as estruturas de dados do time

Aqui ficam as estruturas de dados das features, em Python puro: sem
SQLAlchemy, sem FastAPI, sem import de banco. Só dicts, sets, listas, deques,
heaps e a lógica deles. A banca olha isso no critério de organização do código: a lógica das
estruturas fica aqui, e o endpoint a usa de verdade.

## O padrão: o estado no banco, a lógica aqui

A API roda com vários workers e instâncias. Por isso **nada daqui guarda estado
entre requests**: um singleton em memória seria um por processo, cada um com os
seus números. O que precisa durar mora no banco; o core recebe o que o service
leu do banco e devolve o resultado.

`indice_tags.py` é o exemplo mais completo. O índice invertido tag → poemas é a
tabela `post_tags` (models/post_tag.py), gravada pelo `services/indice_tags.py`
na mesma transação que publica ou apaga o poema. O core decide que tags o poema
tem (`extrair_tags`, `normalizar`), escolhe o top-k das contagens com um heap
(`top_k`) e o poema de cada tag no "Em alta" (`representantes`).

Cada estrutura segue quatro regras:

1. É uma função ou classe pura, testável sem servidor e sem banco.
2. Não há instância global com estado: o service chama o core por request.
3. O que precisa sobreviver a um restart, ou valer igual em dois processos,
   fica numa tabela, com o índice que a consulta precisa.
4. O endpoint usa o core através do service (router → service → core).

**A exceção: `assinaturas.py`.** É o dict pessoa → filas dos streams de
mensagens abertos no processo. Ele guarda estado, mas só o que é do processo por
natureza: uma conexão SSE existe só no worker que a atende. Nada ali precisa
sobreviver a um restart (o cliente reconecta e busca o que perdeu pelas rotas)
nem valer igual em dois workers: o que passa entre eles é o evento, pelo
Postgres `LISTEN/NOTIFY` (`app/tempo_real.py`). A caixa de mensagens segue o
padrão: os ponteiros moram em `participantes_conversa`, e
`caixa_de_entrada.py` só tem as regras.

## Avisos

- O Big O que vale é o da operação inteira: a consulta ao banco (com índice,
  O(log n + resultado)) mais o trabalho do core sobre o que ela trouxe. Os
  dois estão anotados nas docstrings e no `DECISIONS.md`.
- Montar a estrutura a cada request (como `arvore_comentarios.py` e
  `mistura.py`) é o normal aqui: só com o que a página carregou, nunca com a
  rede inteira.
