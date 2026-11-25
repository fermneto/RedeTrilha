// Trocar de formato no compositor sem perder o poema começado (decisão 17).
// Para a renga, o poema vira a 1ª estrofe e o título vira o da renga: os dois
// passam pelo sessionStorage da aba, nunca pela URL, para o texto não ficar no
// histórico, nos logs nem num link copiado. A página da renga lê uma vez e apaga.

const CHAVE = "verso:poema-para-renga";

export type PoemaParaRenga = { titulo: string; estrofe: string };

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Sem sessionStorage (no servidor, ou bloqueado pelo navegador), a troca segue
// sem levar o poema.
function armazemDaAba(): Armazem | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

// Há poema a levar ou a perder: o corpo tem algo além de espaços.
export function temPoema(texto: string): boolean {
  return texto.trim() !== "";
}

export function guardarPoemaParaRenga(
  poema: { titulo: string; texto: string },
  armazem: Armazem | null = armazemDaAba(),
): void {
  if (!armazem || !temPoema(poema.texto)) return;
  const valor: PoemaParaRenga = { titulo: poema.titulo.trim(), estrofe: poema.texto };
  try {
    armazem.setItem(CHAVE, JSON.stringify(valor));
  } catch {
    // Armazenamento cheio ou negado: a renga abre vazia, como antes.
  }
}

// Lê e apaga: voltar à página depois não preenche de novo.
export function lerPoemaParaRenga(armazem: Armazem | null = armazemDaAba()): PoemaParaRenga | null {
  if (!armazem) return null;
  try {
    const bruto = armazem.getItem(CHAVE);
    armazem.removeItem(CHAVE);
    if (bruto === null) return null;
    const lido: unknown = JSON.parse(bruto);
    if (
      typeof lido !== "object" ||
      lido === null ||
      typeof (lido as PoemaParaRenga).titulo !== "string" ||
      typeof (lido as PoemaParaRenga).estrofe !== "string"
    )
      return null;
    return { titulo: (lido as PoemaParaRenga).titulo, estrofe: (lido as PoemaParaRenga).estrofe };
  } catch {
    return null;
  }
}
