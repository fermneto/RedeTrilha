// O caminho que a pessoa fez dentro do Verso nesta aba do navegador, para o
// "voltar" das páginas de publicação (poema, renga, antologia): com uma página
// do Verso antes, ele volta no histórico (e o Início reabre na mesma aba e
// folha, lib/sessaoDoFeed.ts); quem chegou por um link direto vai para o Início.
//
// O Next não diz se a troca de rota foi um link (push) ou o botão de voltar do
// navegador (popstate): o `popstate` avisa antes, e a rota que chega igual à
// penúltima da pilha é uma volta.
//
// A pilha fica no sessionStorage, para sobreviver a recarregar a página. Mas a
// aba aberta por um link (Ctrl+clique, "abrir em nova aba") herda uma cópia do
// sessionStorage da aba de origem, com um histórico que não é dela: o guardado
// só vale quando a página carregou recarregando ou pelo voltar/avançar do
// navegador, e a última rota dele é a rota em que a página abriu. Senão, começa
// do zero (e o voltar leva ao Início).
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

// O tipo do carregamento da página (PerformanceNavigationTiming.type).
export type TipoDeCarregamento = "navigate" | "reload" | "back_forward" | "prerender";

// O histórico guardado, se ele é desta aba (ver acima); senão, um vazio.
export function retomar(guardado: unknown, caminho: string, tipo: TipoDeCarregamento | null): Historico {
  if (tipo !== "reload" && tipo !== "back_forward") return historicoVazio();
  const pilha = (guardado as Historico | null)?.pilha;
  if (!Array.isArray(pilha) || !pilha.every((c) => typeof c === "string")) return historicoVazio();
  if (pilha[pilha.length - 1] !== caminho) return historicoVazio();
  return { pilha, voltando: false };
}

// ---- O módulo: o histórico desta aba, espelhado no sessionStorage ----

const CHAVE_DO_STORAGE = "verso:historico";
// null até a primeira rota da página: aí o guardado é lido (ou descartado).
let atual: Historico | null = null;

function tipoDoCarregamento(): TipoDeCarregamento | null {
  const entrada = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return (entrada?.type as TipoDeCarregamento | undefined) ?? null;
}

function lerGuardado(): unknown {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_DO_STORAGE) ?? "null");
  } catch {
    return null;
  }
}

export function anotarRota(caminho: string): void {
  atual = anotar(atual ?? retomar(lerGuardado(), caminho, tipoDoCarregamento()), caminho);
  try {
    sessionStorage.setItem(CHAVE_DO_STORAGE, JSON.stringify({ pilha: atual.pilha }));
  } catch {
    // sem storage (janela privada, cota cheia): só a memória do módulo
  }
}

// Chamado no `popstate` (o voltar ou o avançar do navegador), antes da rota mudar.
export function anotarVoltaDoNavegador(): void {
  if (atual) atual = { ...atual, voltando: true };
}

export function temRotaAnterior(): boolean {
  return atual !== null && temAnterior(atual);
}
