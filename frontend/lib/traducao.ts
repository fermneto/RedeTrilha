// A tradução no lugar do original (decisão 2): o card troca o título e o corpo
// pela tradução e volta com "ver original". A tradução que já veio fica guardada:
// "ver tradução" depois de voltar não chama a API de novo.
//
// Sem imports: o arquivo é transpilado sozinho nos testes (tests/traducao.test.mjs).

// Só o que a tela usa da resposta de POST /posts/{id}/traduzir.
export type TextoTraduzido = { titulo: string | null; texto: string; idioma_destino: string };

export type EstadoDaTraducao<T extends TextoTraduzido = TextoTraduzido> = {
  // A tradução carregada (null até a primeira chegar).
  traducao: T | null;
  // A tela mostra a tradução no lugar do original.
  mostrando: boolean;
  carregando: boolean;
  erro: string | null;
};

export const SEM_TRADUCAO: EstadoDaTraducao<never> = {
  traducao: null,
  mostrando: false,
  carregando: false,
  erro: null,
};

// O clique no botão. Mostrando a tradução: volta ao original. Com a tradução já
// carregada: mostra de novo, sem buscar. Sem ela: começa a carregar e pede a busca.
// Carregando: ignora (o botão fica desabilitado, mas um duplo clique não busca duas vezes).
export function alternarTraducao<T extends TextoTraduzido>(
  estado: EstadoDaTraducao<T>,
): { estado: EstadoDaTraducao<T>; buscar: boolean } {
  if (estado.carregando) return { estado, buscar: false };
  if (estado.mostrando) return { estado: { ...estado, mostrando: false }, buscar: false };
  if (estado.traducao) return { estado: { ...estado, mostrando: true, erro: null }, buscar: false };
  return { estado: { ...estado, carregando: true, erro: null }, buscar: true };
}

export function traducaoChegou<T extends TextoTraduzido>(_estado: EstadoDaTraducao<T>, traducao: T): EstadoDaTraducao<T> {
  return { traducao, mostrando: true, carregando: false, erro: null };
}

export function traducaoFalhou<T extends TextoTraduzido>(estado: EstadoDaTraducao<T>, erro: string): EstadoDaTraducao<T> {
  return { ...estado, mostrando: false, carregando: false, erro };
}

// O que a tela mostra no lugar do título e do corpo. A tradução sem título
// (poema sem título, ou a IA não devolveu) mantém o título original.
export function textoExibido<T extends TextoTraduzido>(
  original: { titulo: string | null; texto: string },
  estado: EstadoDaTraducao<T>,
): { titulo: string | null; texto: string; traduzido: boolean; lang: string | null } {
  if (!estado.mostrando || !estado.traducao) return { ...original, traduzido: false, lang: null };
  const t = estado.traducao;
  return {
    titulo: t.titulo || original.titulo,
    texto: t.texto,
    traduzido: true,
    lang: t.idioma_destino,
  };
}

// O texto do botão: "Traduzir" na primeira vez, "ver original" com a tradução na
// tela e "ver tradução" depois de voltar ao original.
export function rotuloDoBotao(estado: EstadoDaTraducao<TextoTraduzido>): string {
  if (estado.carregando) return "Traduzindo…";
  if (estado.mostrando) return "ver original";
  return estado.traducao ? "ver tradução" : "Traduzir";
}
