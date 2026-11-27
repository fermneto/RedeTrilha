// A sessão de leitura do Início, como a timeline do X: o que as duas abas ("Para
// você" e "Seguindo") já carregaram, o cursor e a folha onde a pessoa parou, e o
// que ela já viu. Fica acima da rota, num módulo (sobrevive a ir a outra página e
// voltar) espelhado no sessionStorage (sobrevive a recarregar a página na mesma
// aba do navegador). Só recomeça do topo quando a pessoa pede (tocar em Início
// estando no Início), ou quando a conta muda.
//
// Uma vez só entre as abas: cada poema ou renga fica com a aba em que a pessoa o
// viu primeiro (chegou na folha dele), e a outra aba o pula. O filtro é do front
// porque o "visto" é do front (o backend só sabe o que entregou, e o que uma aba
// carregou adiantado a pessoa ainda não viu: pular isso esvaziaria o Para você).
// O cursor de cada aba segue sendo o do backend, que já não repete na aba. O
// mais curtido e a releitura da continuação do feed infinito (`subiu_por`
// "curtidas" e "releitura") podem repetir por desenho, e passam pelo filtro sempre.
// O que é da própria pessoa (o poema dela, o repost dela, o poema dela que alguém
// repostou) também passa sempre no Seguindo: quem acabou de publicar procura o
// poema ali, mesmo que já o tenha visto no Para você.
//
// Sem import de valor (só de tipo): os testes transpilam este arquivo sozinho.

import type { ItemDoFeed } from "@/lib/api";

export type Aba = "para-voce" | "seguindo";
export type PosicaoNoCaderno = { folha: number; lado: "e" | "d" };

export type EstadoDaAba = {
  itens: ItemDoFeed[];
  cursor: string | null;
  // Só com a rede sem poemas: o feed não acaba.
  fim: boolean;
  posicao: PosicaoNoCaderno;
  // Quantos dos `itens` vieram antes da virada (`fim_em` do FeedPage): no
  // Seguindo, o que é de quem a pessoa segue. null antes de chegar lá.
  fimEm?: number | null;
};

export type Sessao = {
  // De quem é (um resumo do token): outra conta no mesmo navegador começa do zero.
  dono: string;
  aba: Aba;
  abas: Partial<Record<Aba, EstadoDaAba>>;
  // Chave do poema ou renga (`chaveDoAlvo`) → a aba em que foi visto primeiro.
  vistos: Record<string, Aba>;
};

export const ABA_INICIAL: Aba = "para-voce";
export const INICIO_DO_CADERNO: PosicaoNoCaderno = { folha: 0, lado: "e" };
const CHAVE_DO_STORAGE = "verso:sessao-do-feed";
// Disparado quando a sessão recomeça (tocar em Início estando no Início).
export const EVENTO_FEED_RECOMECOU = "verso:feed-recomecou";

export function sessaoVazia(dono: string): Sessao {
  return { dono, aba: ABA_INICIAL, abas: {}, vistos: {} };
}

export function abaVazia(): EstadoDaAba {
  return { itens: [], cursor: null, fim: false, posicao: INICIO_DO_CADERNO, fimEm: null };
}

// O poema é de quem lê: escrito ou repostado por ela (o repost dela, ou ela entre
// quem repostou, juntado pelo juntarAoFeed), ou o original de um repost puro.
export function ehDaPessoa(item: ItemDoFeed, euId: number | null): boolean {
  if (euId === null || item.tipo === "renga") return false;
  return (
    item.autor_id === euId ||
    (item.texto === "" && item.repost_de?.autor_id === euId) ||
    (item.repostado_por ?? []).some((u) => u.id === euId)
  );
}

// Os itens que a aba mostra: os que ninguém viu ainda e os que foram vistos nela
// (no Seguindo, também os da própria pessoa).
export function visiveis(
  itens: ItemDoFeed[],
  chave: (item: ItemDoFeed) => string,
  vistos: Record<string, Aba>,
  aba: Aba,
  euId: number | null = null,
): ItemDoFeed[] {
  return itens.filter(
    (item) =>
      (item.tipo !== "renga" && (item.subiu_por === "curtidas" || item.subiu_por === "releitura")) ||
      (aba === "seguindo" && ehDaPessoa(item, euId)) ||
      (vistos[chave(item)] ?? aba) === aba,
  );
}

// Marca o item como visto na aba, se ainda não foi visto em nenhuma. Devolve o
// mesmo objeto quando não muda nada (para o React não renderizar à toa).
export function marcarVisto(vistos: Record<string, Aba>, chave: string, aba: Aba): Record<string, Aba> {
  return chave in vistos ? vistos : { ...vistos, [chave]: aba };
}

type EstadoDasAcoes = { curti: boolean; curtidas: number; repostei: boolean; reposts: number };

// Curtir ou repostar no feed muda o item guardado: ao voltar, o botão mostra o
// estado novo, e não o de quando a página foi carregada.
export function comAcao(
  sessao: Sessao,
  alvo: { tipo: "poema" | "renga"; id: number },
  estado: EstadoDasAcoes,
): Sessao {
  const atualizar = (item: ItemDoFeed): ItemDoFeed => {
    if (item.tipo === "renga") {
      return alvo.tipo === "renga" && item.renga.id === alvo.id ? { ...item, renga: { ...item.renga, ...estado } } : item;
    }
    if (alvo.tipo !== "poema") return item;
    if (item.id === alvo.id) return { ...item, ...estado };
    if (item.repost_de?.id === alvo.id) return { ...item, repost_de: { ...item.repost_de, ...estado } };
    return item;
  };
  const abas: Sessao["abas"] = {};
  for (const [aba, estadoDaAba] of Object.entries(sessao.abas) as [Aba, EstadoDaAba][]) {
    abas[aba] = { ...estadoDaAba, itens: estadoDaAba.itens.map(atualizar) };
  }
  return { ...sessao, abas };
}

// Um resumo do token (djb2), para não copiar o token para o sessionStorage.
export function donoDoToken(token: string | null): string {
  if (!token) return "";
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ---- O módulo: a sessão da aba do navegador ----

let atual: Sessao | null = null;

function lerDoStorage(dono: string): Sessao {
  try {
    const bruto = sessionStorage.getItem(CHAVE_DO_STORAGE);
    if (bruto) {
      const sessao = JSON.parse(bruto) as Sessao;
      if (sessao.dono === dono && sessao.abas && sessao.vistos) return sessao;
    }
  } catch {
    // sem storage (janela privada, cota cheia): só a memória do módulo
  }
  return sessaoVazia(dono);
}

function tokenAtual(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

// A sessão de quem está logado agora (só no navegador).
export function sessaoAtual(): Sessao {
  const dono = donoDoToken(tokenAtual());
  if (!atual || atual.dono !== dono) atual = lerDoStorage(dono);
  return atual;
}

let gravacao: ReturnType<typeof setTimeout> | null = null;

export function guardarSessao(mudar: (sessao: Sessao) => Sessao): void {
  atual = mudar(sessaoAtual());
  // Uma gravação por rajada: virar várias folhas seguidas não serializa a lista a cada uma.
  if (gravacao) clearTimeout(gravacao);
  gravacao = setTimeout(() => {
    gravacao = null;
    try {
      sessionStorage.setItem(CHAVE_DO_STORAGE, JSON.stringify(atual));
    } catch {
      // cota cheia: a sessão continua na memória enquanto a aba não recarregar
    }
  }, 300);
}

export function lembrarAcao(alvo: { tipo: "poema" | "renga"; id: number }, estado: EstadoDasAcoes): void {
  if (atual) guardarSessao((sessao) => comAcao(sessao, alvo, estado));
}

// Uma sessão nova: as duas abas voltam ao topo e o "visto" zera.
export function recomecarFeed(): void {
  guardarSessao((sessao) => sessaoVazia(sessao.dono));
  window.dispatchEvent(new Event(EVENTO_FEED_RECOMECOU));
}
