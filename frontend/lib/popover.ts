// Para onde abre um popover preso a um botão (o "adicionar à antologia"): embaixo
// do botão, a não ser que não caiba ali e em cima haja mais espaço.
//
// O espaço visível não é a janela inteira: o que rola é a página do livro (um
// contêiner com overflow), e no fim dela podem ficar coisas presas por cima do
// conteúdo, como a barra de navegação do celular e o campo "Comente o poema"
// (`.pe-da-conversa`, #62). `faixaVisivel` junta esses limites; `abrirParaCima`
// decide com eles.

// Distância entre o botão e o popover, mais uma folga.
const FOLGA = 8;

export type Faixa = { inicio: number; fim: number };

// Os limites que recortam ou cobrem o popover, em coordenadas da janela.
// `recorte`: a caixa do contêiner que rola (null se a página inteira rola);
// `cobertas`: o topo de cada coisa presa por cima do fim da tela (a barra fixa,
// o pé da conversa). Só conta a que começa abaixo do botão (`base`): a que está
// acima dele não cobre o espaço de baixo.
export function faixaVisivel(
  janela: number,
  recorte: Faixa | null,
  cobertas: number[],
  base: number,
): Faixa {
  let inicio = 0;
  let fim = janela;
  if (recorte) {
    inicio = Math.max(inicio, recorte.inicio);
    fim = Math.min(fim, recorte.fim);
  }
  for (const topo of cobertas) {
    if (topo > base && topo < fim) fim = topo;
  }
  return { inicio, fim };
}

// `ancora`: o topo e a base do botão; `altura`: a do popover.
export function abrirParaCima(ancora: { topo: number; base: number }, altura: number, faixa: Faixa): boolean {
  const abaixo = faixa.fim - ancora.base;
  const acima = ancora.topo - faixa.inicio;
  return altura + FOLGA > abaixo && acima > abaixo;
}
