// Quando cada dica do livro aparece (components/DicasDoLivro.tsx). Um tour aos
// poucos, nunca de uma vez: uma dica por vez, no contexto dela, em qualquer
// página do livro, e a dispensada não volta (a lista fica na conta, GET /dicas).
// Cada uma aparece onde o lugar dela está à vista: folhear, na primeira página
// com mais de uma folha (o feed, um perfil, um poema no celular); as ações, no
// primeiro poema ou renga com a conversa à vista; a lombada, em qualquer página;
// escrever (poema e renga), ao abrir o compositor e, no Início, apontando o
// botão de escrever. Fora do compositor, depois de uma dica, a seguinte espera a
// pessoa folhear VIRADAS_ENTRE_DICAS páginas ou chegar a outra página. Funções
// puras: tests/dicas.test.mjs.

import type { Dica } from "@/lib/api";

export const ORDEM_DAS_DICAS: readonly Dica[] = ["virar_pagina", "acoes", "lombada", "escrever"];

export const VIRADAS_ENTRE_DICAS = 2;

// Onde a pessoa está: o Início (o feed), o compositor ou outra página do livro.
export type LugarDasDicas = "inicio" | "escrever" | "livro";

export function lugarDasDicas(caminho: string): LugarDasDicas {
  if (caminho === "/") return "inicio";
  if (caminho === "/escrever") return "escrever";
  return "livro";
}

// A dica que cabe agora, ou nenhuma. `viradas` são as páginas folheadas desde a
// última dica (ao chegar numa página, já conta como intervalo cumprido); `aVista`
// diz se o lugar da dica está na tela.
export function proximaDica(
  vistas: readonly Dica[],
  lugar: LugarDasDicas,
  viradas: number,
  aVista: (dica: Dica) => boolean,
): Dica | null {
  // No compositor, a de escrever vem ao chegar, sem esperar o intervalo.
  if (lugar === "escrever") return !vistas.includes("escrever") && aVista("escrever") ? "escrever" : null;
  if (viradas < VIRADAS_ENTRE_DICAS) return null;
  // Fora do Início e do compositor, o botão de escrever fica sem dica: ela vem ao abri-lo.
  const cabem = ORDEM_DAS_DICAS.filter((d) => !vistas.includes(d) && (d !== "escrever" || lugar === "inicio"));
  return cabem.find(aVista) ?? null;
}

export type Lado = "acima" | "abaixo" | "direita";
export type Retangulo = { top: number; left: number; width: number; height: number };

const MARGEM = 12;
const DISTANCIA = 14;

const sobrepoe = (a: Retangulo, b: Retangulo) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

// Onde a nota fica: do lado pedido da âncora, ou do oposto se não couber, sempre
// dentro da tela. `seta` é a distância da ponta da seta à borda da nota (o centro
// da âncora, preso às bordas arredondadas). Acima da âncora, a nota sobe até
// ficar acima dos `obstaculos` que cobriria (no desktop, o campo de comentar e
// os botões do pé da página ao lado da seta de folhear); a ponta segue na âncora.
export function posicionarNota(
  ancora: Retangulo,
  nota: { width: number; height: number },
  tela: { width: number; height: number },
  lado: Lado,
  obstaculos: readonly Retangulo[] = [],
): { top: number; left: number; lado: Lado; seta: number } {
  const prender = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  let final = lado;
  if (lado === "direita" && ancora.left + ancora.width + DISTANCIA + nota.width > tela.width - MARGEM) final = "acima";
  if (final === "acima" && ancora.top - DISTANCIA - nota.height < MARGEM) final = "abaixo";
  else if (final === "abaixo" && ancora.top + ancora.height + DISTANCIA + nota.height > tela.height - MARGEM) final = "acima";

  if (final === "direita") {
    const top = prender(ancora.top + ancora.height / 2 - nota.height / 2, MARGEM, tela.height - MARGEM - nota.height);
    const seta = prender(ancora.top + ancora.height / 2 - top, 18, nota.height - 18);
    return { top, left: ancora.left + ancora.width + DISTANCIA, lado: final, seta };
  }
  const left = prender(ancora.left + ancora.width / 2 - nota.width / 2, MARGEM, tela.width - MARGEM - nota.width);
  let top = final === "acima" ? ancora.top - DISTANCIA - nota.height : ancora.top + ancora.height + DISTANCIA;
  if (final === "acima") {
    // Cada obstáculo empurrado pode trazer o de cima: sobe até não cobrir nenhum.
    for (let vez = 0; vez < obstaculos.length; vez++) {
      const aqui = { top, left, width: nota.width, height: nota.height };
      const cobertos = obstaculos.filter((o) => sobrepoe(aqui, o));
      if (cobertos.length === 0) break;
      const novo = Math.min(...cobertos.map((o) => o.top)) - DISTANCIA - nota.height;
      if (novo < MARGEM) break;
      top = novo;
    }
  }
  const seta = prender(ancora.left + ancora.width / 2 - left, 18, nota.width - 18);
  return { top: prender(top, MARGEM, tela.height - MARGEM - nota.height), left, lado: final, seta };
}
