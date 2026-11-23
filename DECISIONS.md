# Decisões do time

**Time:** Neto (@fermneto), Henrique (@hguimaa), Pedro (@CorreiaPedro208)

Este arquivo acompanha o projeto. Comecem com o que já sabem e atualizem quando
as decisões mudarem.

## Produto

Respondam antes de escolher features. O pitch sai daqui.

- **Público:** poetas iniciantes universitários (UFPB e outras) que escrevem,
  mas não têm onde publicar e ser lidos.
- **Problema:** no X o limite de caracteres quebra o poema; no Instagram o poema
  vira imagem e não dá para citar um verso; os feeds algorítmicos enterram texto
  longo. E o iniciante lê pouco os clássicos.
- **Como a rede resolve:** o poema é um post de verdade (título, corpo sem
  limite e com as quebras preservadas, forma), com conversa em árvore,
  repost/citação de versos e os poetas consagrados (domínio público) no mesmo feed.
- **Como saberíamos que funcionou:** o iniciante cita um verso de um consagrado
  ou de um colega e recebe respostas na árvore de comentários.

## Decisões de produto

Registrem de 3 a 5 escolhas que mudaram o que a rede é. Boas candidatas: por
que essas features e não outras, o que ficou de fora, como o seed e a interface
refletem o nicho. Uma delas vai para o vídeo.

### 1. _(título curto)_

- **Contexto:** _(o que estava em jogo)_
- **Opções:** _(o que vocês consideraram)_
- **Escolha:** _(o que fizeram)_
- **O que cortamos e por quê:** _(o custo da escolha)_

Exemplo:

> **Feed cronológico em vez de "Em alta"**
>
> - **Contexto:** a comunidade é de corredores que treinam juntos.
> - **Opções:** feed ranqueado por engajamento ou feed cronológico.
> - **Escolha:** cronológico, com stories do dia.
> - **O que cortamos e por quê:** o "Em alta". Quem abre o app quer ver o
>   treino de hoje dos amigos, não o post mais curtido da semana.

## Features

Listem as features que o time vai construir, quem é o dono de cada uma e por
que ela entra no produto. A lista muda junto com o projeto: acrescentem e
tirem linhas quando mudarem de ideia.

| Feature | Dono | Por quê (1 frase) |
|---|---|---|
| Auth (núcleo) | Pedro | Consagrados existem como contas sem login; o resto entra com senha. |
| Posts/poemas (núcleo) | Henrique | Título, corpo sem limite e forma: o poema como unidade, não como tweet. |
| Feed (núcleo) | Henrique | Cronológico: o iniciante quer ver o que os colegas escreveram hoje. |
| Perfil (núcleo) | Pedro | Mostra o selo e os anos de vida dos consagrados. |
| Follow (núcleo) | Neto | Seguir um consagrado traz os clássicos para o feed. |
| Curtidas (núcleo) | Henrique | Feedback mínimo para quem está começando. |
| Comentários em árvore | Henrique | A crítica de poema vira conversa, não uma lista solta. |
| Seed fake (núcleo) | Neto | A demo abre com poetas universitários e poemas de verdade. |
| Consagrados (importador) | Neto | Os clássicos de domínio público convivem com os iniciantes. |
| Repost + citação | Henrique | Citar um verso é o gesto central de quem lê poesia. |
| Formas/temas (hashtags) | Neto | Descobrir sonetos, haicais e temas; trending do que se escreve. |
| Antologias | Pedro | O leitor monta coleções ("poemas de chuva"), como uma antologia de verdade. |
| Deploy | Neto | A banca usa a rede na URL pública. |

## Uma escolha técnica

Contem uma escolha técnica que o time fez e por quê. Por exemplo, por que usou
uma estrutura de dados no `core/`, qual o Big O da operação principal, ou o
que mudaria se a rede crescesse 100 vezes. Se mediram com `make bench`, colem a
saída e uma frase dizendo o que os números mostram.

## Uso de IA

Ferramenta e para quê. Exemplo: "Claude para gerar o seed de 200 posts sobre
corrida; o resto foi escrito pelo time."
