// A repercussão (components/Repercussao.tsx) acompanha as ações da própria
// pessoa sem pedir nada ao backend: a barra de ações (components/BarraDeAcoes.tsx)
// avisa que curtiu ou repostou, e a linha "curtido por ..." põe ou tira a pessoa
// da prévia e soma ou subtrai 1 do total. Evento de window, como o das
// antologias, para não passar callbacks por dentro do PoemaCard.

import type { Alvo, Page, User } from "@/lib/api";

const EVENTO = "verso:acao-feita";

export type AcaoFeita = { alvo: Alvo; acao: "curtidas" | "reposts"; ativo: boolean };

export function avisarAcao(acao: AcaoFeita): void {
  window.dispatchEvent(new CustomEvent<AcaoFeita>(EVENTO, { detail: acao }));
}

// Assina as ações; devolve a função que cancela a assinatura (para o useEffect).
export function ouvirAcoes(aoFazer: (acao: AcaoFeita) => void): () => void {
  const ouvinte = (e: Event) => aoFazer((e as CustomEvent<AcaoFeita>).detail);
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}

// A página com a pessoa (`eu`) entrando no começo (ativo) ou saindo (inativo),
// e o total somando ou subtraindo 1. Quem manda é o estado da ação, não a
// prévia: quem curtiu há muito tempo pode não estar entre os rostos e, ao
// descurtir, o total desce do mesmo jeito. `limite` corta a prévia nos rostos
// que ela mostra; sem ele (a lista aberta), nada é cortado.
export function comAPessoa(pagina: Page<User>, eu: User, ativo: boolean, limite?: number): Page<User> {
  const outros = pagina.items.filter((u) => u.id !== eu.id);
  if (!ativo) return { ...pagina, items: outros, total: Math.max(0, pagina.total - 1) };
  const items = [eu, ...outros];
  return { ...pagina, items: limite === undefined ? items : items.slice(0, limite), total: pagina.total + 1 };
}
