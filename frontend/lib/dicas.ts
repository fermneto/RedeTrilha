// Quando cada dica do livro aparece (components/DicasDoLivro.tsx). Um tour aos
// poucos, nunca de uma vez: uma dica por vez, no contexto dela, e a que foi vista
// não volta (a lista fica na conta, GET /dicas). No Início, a primeira (virar a
// página) vem logo ao chegar; as outras, na ordem, só depois de a pessoa folhear
// VIRADAS_ENTRE_DICAS páginas desde a última, e só com o lugar delas à vista (no
// celular, as ações estão na página da conversa). No compositor, a de escrever
// vem ao chegar, se ainda não foi vista. Funções puras: tests/dicas.test.mjs.

import type { Dica } from "@/lib/api";

export const ORDEM_DAS_DICAS: readonly Dica[] = ["virar_pagina", "acoes", "lombada", "escrever"];

export const VIRADAS_ENTRE_DICAS = 2;

// Onde a pessoa está: o Início (o feed), o compositor ou outra página (sem dicas).
export type LugarDasDicas = "inicio" | "escrever" | null;

export function lugarDasDicas(caminho: string): LugarDasDicas {
  if (caminho === "/") return "inicio";
  if (caminho === "/escrever") return "escrever";
  return null;
}

// A dica que cabe agora, ou nenhuma. `aVista` diz se o lugar da dica está na tela.
export function proximaDica(
  vistas: readonly Dica[],
  lugar: LugarDasDicas,
  viradas: number,
  aVista: (dica: Dica) => boolean,
): Dica | null {
  if (lugar === "escrever") return !vistas.includes("escrever") && aVista("escrever") ? "escrever" : null;
  if (lugar !== "inicio") return null;
  const proxima = ORDEM_DAS_DICAS.find((d) => !vistas.includes(d));
  if (!proxima) return null;
  // A primeira vem ao chegar; as outras esperam a pessoa folhear um pouco.
  if (proxima !== ORDEM_DAS_DICAS[0] && viradas < VIRADAS_ENTRE_DICAS) return null;
  return aVista(proxima) ? proxima : null;
}

export type Lado = "acima" | "abaixo" | "direita";
export type Retangulo = { top: number; left: number; width: number; height: number };

const MARGEM = 12;
const DISTANCIA = 14;

// Onde a nota fica: do lado pedido da âncora, ou do oposto se não couber, sempre
// dentro da tela. `seta` é a distância da ponta da seta à borda da nota (o centro
// da âncora, preso às bordas arredondadas).
export function posicionarNota(
  ancora: Retangulo,
  nota: { width: number; height: number },
  tela: { width: number; height: number },
  lado: Lado,
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
  const top = final === "acima" ? ancora.top - DISTANCIA - nota.height : ancora.top + ancora.height + DISTANCIA;
  const seta = prender(ancora.left + ancora.width / 2 - left, 18, nota.width - 18);
  return { top: prender(top, MARGEM, tela.height - MARGEM - nota.height), left, lado: final, seta };
}
