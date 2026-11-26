// O caminho que a pessoa fez dentro do Verso nesta aba do navegador, para o
// "voltar" das páginas de publicação (poema, renga, antologia): com uma página
// do Verso antes, ele volta no histórico (e o Início reabre na mesma aba e
// folha, lib/sessaoDoFeed.ts); quem chegou por um link direto vai para o Início.
//
// O Next não diz se a troca de rota foi um link (push) ou o botão de voltar do
// navegador (popstate): o `popstate` avisa antes, e a rota que chega igual à
// penúltima da pilha é uma volta. Fica só na memória: recarregar recomeça.
//
// Sem import: os testes transpilam este arquivo sozinho.

export type Historico = { pilha: string[]; voltando: boolean };

export function historicoVazio(): Historico {
  return { pilha: [], voltando: false };
}

// A rota nova à vista. Igual à atual (só mudou a busca ou o #) não conta.
export function anotar(historico: Historico, caminho: string): Historico {
  const { pilha, voltando } = historico;
  if (pilha[pilha.length - 1] === caminho) return { pilha, voltando: false };
  if (voltando && pilha[pilha.length - 2] === caminho) return { pilha: pilha.slice(0, -1), voltando: false };
  return { pilha: [...pilha, caminho], voltando: false };
}

export function temAnterior(historico: Historico): boolean {
  return historico.pilha.length > 1;
}

// ---- O módulo: o histórico desta aba ----

let atual = historicoVazio();

export function anotarRota(caminho: string): void {
  atual = anotar(atual, caminho);
}

// Chamado no `popstate` (o voltar ou o avançar do navegador), antes da rota mudar.
export function anotarVoltaDoNavegador(): void {
  atual = { ...atual, voltando: true };
}

export function temRotaAnterior(): boolean {
  return temAnterior(atual);
}
