"use client";
// As folhas do caderno: a página dupla do desktop (de 1024 px) e a página única
// do celular. Cada folha tem a página da esquerda (o poema, o perfil, o que a
// rota mostra) e, se houver, a da direita (os comentários, as listas, a ficha).
// No celular a folha vira duas páginas seguidas: a da esquerda e depois a da
// direita, a não ser que a folha peça para juntar as duas numa só.
//
// Passar a página: o botão no canto da página, as setas ← → do teclado (fora
// dos campos de texto), arrastar a folha para o lado (no toque, em qualquer
// lugar da página; com o mouse, pelo pé da página, para não brigar com a
// seleção de versos) ou deslizar dois dedos para o lado no touchpad (e Shift +
// roda do mouse; a lógica do gesto está em lib/rodaDaFolha.ts). A animação de virada está em globals.css (.vira-frente,
// .vira-verso...); com prefers-reduced-motion, vira um fade curto.
//
// Só montam as páginas da folha atual (e as da próxima, durante a virada): a
// página que sai continua montada até a folha deitar, sem recarregar nada.

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useDicasDoLivro } from "@/components/DicasDoLivro";
import { IconeSeta } from "@/components/icones/IconeSeta";
import { deslocamentoLateral, type EstadoDaRoda, lerRoda, RODA_PARADA } from "@/lib/rodaDaFolha";

export type Folha = {
  chave: string;
  // Lido pelo leitor de tela ao chegar na folha ("Soneto da chuva, de Ana").
  rotulo: string;
  esquerda: ReactNode;
  direita?: ReactNode;
  // Rótulo da página da direita no celular ("comentários de ...").
  rotuloDaDireita?: string;
  // No celular, as duas páginas numa só (o compositor: escrever e publicar).
  juntarNoCelular?: boolean;
  // A página da direita só na página dupla (a coluna Descobrir das outras rotas).
  direitaSoNoDuplo?: boolean;
};

type Lado = "e" | "d";
type Posicao = { folha: number; lado: Lado };
type Virada = { de: Posicao; para: Posicao; sentido: 1 | -1 };

// O papel de cada página na tela: à vista, por baixo da folha que gira, a folha
// que gira (frente e verso, indo ou voltando) ou guardada (montada e escondida).
type Papel = "ver" | "sob" | "vira-frente" | "vira-verso" | "volta-frente" | "volta-verso" | "guardada";

const DUPLO = "(min-width: 1024px)";

function assinarDuplo(avisar: () => void) {
  const consulta = window.matchMedia(DUPLO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

// No servidor e na hidratação, página única; no navegador, a largura decide.
export function useDuplo(): boolean {
  return useSyncExternalStore(
    assinarDuplo,
    () => window.matchMedia(DUPLO).matches,
    () => false,
  );
}

type Contexto = {
  duplo: boolean;
  // Mostra a página da esquerda ou da direita da folha atual (no celular, vira
  // até ela) e chama `depois` quando ela está à vista.
  mostrar: (lado: Lado, depois?: () => void) => void;
};

const ContextoDasFolhas = createContext<Contexto>({ duplo: false, mostrar: (_, depois) => depois?.() });

export function useFolhas(): Contexto {
  return useContext(ContextoDasFolhas);
}

// Campos onde as setas andam no texto ou nas opções: lá elas não viram a página.
function ehCampo(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  if (alvo.isContentEditable) return true;
  if (alvo.closest("input, textarea, select, [role=tab], [role=menu], [role=listbox], [role=slider]")) return true;
  return false;
}

// Algum elemento entre o alvo e o caderno rola para o lado (as fileiras de
// chips): o deslizar lateral é dele.
function rolaParaOLado(alvo: EventTarget | null, ate: HTMLElement): boolean {
  for (let el = alvo instanceof Element ? alvo : null; el && el !== ate; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue;
    const { overflowX } = getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}

function temSelecao(): boolean {
  const s = window.getSelection();
  return Boolean(s && !s.isCollapsed && s.toString().trim());
}

type Props = {
  folhas: Folha[];
  // Chamado a cada folha nova à vista (o feed pede a próxima página perto do fim).
  aoChegar?: (indice: number) => void;
  // Os rótulos dos botões de virar ("poema anterior", "próximo poema").
  anterior?: string;
  proxima?: string;
  // Abre como uma página nova do livro (o compositor): a primeira folha chega
  // virando, sobre a página da esquerda (no celular, assentando por cima).
  abrirComoNova?: boolean;
  // Onde o caderno abre (o feed volta à folha em que a pessoa parou) e o aviso de
  // cada página nova à vista, para quem guarda a posição.
  abrirEm?: Posicao;
  aoMudar?: (posicao: Posicao) => void;
};

export function CadernoFolhas({
  folhas,
  aoChegar,
  anterior = "página anterior",
  proxima = "próxima página",
  abrirComoNova = false,
  abrirEm,
  aoMudar,
}: Props) {
  const duplo = useDuplo();
  const [pos, setPos] = useState<Posicao>(abrirEm ?? { folha: 0, lado: "e" });
  const [virada, setVirada] = useState<Virada | null>(null);
  const [aviso, setAviso] = useState("");
  const depoisDaVirada = useRef<(() => void) | null>(null);
  // O foco estava numa página quando ela virou: ao fim, ele passa à página nova.
  const focoNaPagina = useRef(false);
  const toque = useRef<{ x: number; y: number; id: number } | null>(null);
  const roda = useRef<EstadoDaRoda>(RODA_PARADA);
  const raiz = useRef<HTMLDivElement>(null);

  // As páginas do celular, em ordem: [folha 0 esquerda, folha 0 direita, folha 1...].
  const temDireitaNoCelular = (f: Folha) => Boolean(f.direita) && !f.juntarNoCelular && !f.direitaSoNoDuplo;
  const pista: Posicao[] = folhas.flatMap((f, i) =>
    temDireitaNoCelular(f) ? [{ folha: i, lado: "e" as Lado }, { folha: i, lado: "d" as Lado }] : [{ folha: i, lado: "e" as Lado }],
  );
  const indiceNaPista = (p: Posicao) =>
    Math.max(0, pista.findIndex((q) => q.folha === p.folha && q.lado === (temDireitaNoCelular(folhas[p.folha]) ? p.lado : "e")));

  // A folha atual pode sumir (a lista encolheu): volta para a última.
  const atual: Posicao = pos.folha < folhas.length ? pos : { folha: Math.max(0, folhas.length - 1), lado: "e" };
  const total = duplo ? folhas.length : pista.length;
  const aqui = duplo ? atual.folha : indiceNaPista(atual);

  useEffect(() => {
    aoChegar?.(atual.folha);
  }, [atual.folha, aoChegar]);

  // Cada página folheada também conta para as dicas do livro (DicasDoLivro.tsx).
  const { virou } = useDicasDoLivro();
  useEffect(() => {
    aoMudar?.({ folha: atual.folha, lado: atual.lado });
    virou(`${atual.folha}:${atual.lado}`);
  }, [atual.folha, atual.lado, aoMudar, virou]);

  const virar = useCallback(
    (para: Posicao, depois?: () => void) => {
      if (virada || folhas.length === 0) return;
      const mesmaFolha = para.folha === atual.folha;
      if (duplo && mesmaFolha) {
        depois?.();
        return;
      }
      if (!duplo && mesmaFolha && (para.lado === atual.lado || !temDireitaNoCelular(folhas[para.folha]))) {
        depois?.();
        return;
      }
      const sentido: 1 | -1 =
        para.folha > atual.folha || (mesmaFolha && para.lado === "d") ? 1 : -1;
      depoisDaVirada.current = depois ?? null;
      focoNaPagina.current = Boolean(raiz.current?.contains(document.activeElement));
      setVirada({ de: atual, para, sentido });
      const f = folhas[para.folha];
      setAviso(
        para.lado === "d" && !duplo
          ? (f.rotuloDaDireita ?? `continuação de ${f.rotulo}`)
          : `${f.rotulo}, página ${duplo ? para.folha * 2 + 1 : indiceNaPista(para) + 1}`,
      );
    },
    [virada, folhas, atual, duplo],
  );

  const passo = useCallback(
    (n: 1 | -1) => {
      if (duplo) {
        const alvo = atual.folha + n;
        if (alvo >= 0 && alvo < folhas.length) virar({ folha: alvo, lado: "e" });
        return;
      }
      const alvo = pista[aqui + n];
      if (alvo) virar(alvo);
    },
    [duplo, atual.folha, folhas.length, virar, pista, aqui],
  );

  function terminar() {
    if (!virada) return;
    setPos(virada.para);
    setVirada(null);
    const depois = depoisDaVirada.current;
    depoisDaVirada.current = null;
    // O foco estava num botão da página que saiu: passa ao mesmo botão da nova.
    requestAnimationFrame(() => {
      const ativo = document.activeElement;
      const perdido = !ativo || ativo === document.body || Boolean(ativo.closest("[inert]"));
      if (focoNaPagina.current && perdido && raiz.current) {
        const alvo =
          raiz.current.querySelector<HTMLElement>(`[data-a-vista] [data-virar="${virada.sentido === 1 ? "proxima" : "anterior"}"]:not([disabled])`) ??
          raiz.current.querySelector<HTMLElement>("[data-a-vista]");
        alvo?.focus({ preventScroll: true });
      }
      depois?.();
    });
  }

  // Se a animação não terminar (aba em segundo plano), a virada termina sozinha.
  useEffect(() => {
    if (!virada) return;
    const relogio = setTimeout(terminar, 1200);
    return () => clearTimeout(relogio);
  });

  useEffect(() => {
    if (total < 2) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (ehCampo(e.target)) return;
      e.preventDefault();
      passo(e.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [passo, total]);

  // O deslizar lateral de dois dedos no touchpad. O ouvinte não é passivo para
  // poder segurar o evento: dentro do caderno, o deslizar para o lado vira a
  // página e não aciona o "voltar" do navegador. Ctrl + roda é o zoom (a pinça).
  useEffect(() => {
    const caderno = raiz.current;
    if (!caderno || total < 2) return;
    const el: HTMLElement = caderno;
    function aoRolar(e: WheelEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (deslocamentoLateral(e) === null) {
        roda.current = lerRoda(roda.current, e).estado;
        return;
      }
      if (ehCampo(e.target) || temSelecao() || rolaParaOLado(e.target, el)) return;
      e.preventDefault();
      const lido = lerRoda(roda.current, e);
      roda.current = lido.estado;
      if (lido.passo !== 0) passo(lido.passo);
    }
    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  }, [passo, total]);

  function aoApertar(e: React.PointerEvent) {
    if (total < 2) return;
    if (e.pointerType === "mouse" && !(e.target as HTMLElement).closest("[data-arrastar]")) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select, [contenteditable]") && e.pointerType === "mouse") return;
    toque.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function aoSoltar(e: React.PointerEvent) {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio || inicio.id !== e.pointerId || temSelecao()) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    passo(dx < 0 ? 1 : -1);
  }

  const contexto: Contexto = {
    duplo,
    mostrar: (lado, depois) => virar({ folha: atual.folha, lado }, depois),
  };

  // Quem aparece e como. No desktop, cada folha tem as duas metades; no celular,
  // as páginas da folha atual (e da de destino) dividem o mesmo lugar.
  type Peca = { chave: string; slot: "e" | "d" | "u"; papel: Papel; folha: number; lado: Lado };
  const pecas: Peca[] = [];
  if (duplo) {
    const metades = (folha: number, e: Papel, d: Papel) => {
      pecas.push({ chave: `${folhas[folha].chave}:e`, slot: "e", papel: e, folha, lado: "e" });
      pecas.push({ chave: `${folhas[folha].chave}:d`, slot: "d", papel: d, folha, lado: "d" });
    };
    if (!virada || virada.de.folha === virada.para.folha) metades(atual.folha, "ver", "ver");
    else if (virada.sentido === 1) {
      metades(virada.de.folha, "sob", "vira-frente");
      metades(virada.para.folha, "vira-verso", "sob");
    } else {
      metades(virada.de.folha, "volta-frente", "sob");
      metades(virada.para.folha, "sob", "volta-verso");
    }
  } else {
    const de = virada ? indiceNaPista(virada.de) : aqui;
    const para = virada ? indiceNaPista(virada.para) : aqui;
    const folhasMontadas = new Set([pista[de]?.folha, pista[para]?.folha]);
    pista.forEach((p, i) => {
      if (!folhasMontadas.has(p.folha)) return;
      let papel: Papel = "guardada";
      if (!virada) papel = i === aqui ? "ver" : "guardada";
      else if (virada.sentido === 1) papel = i === de ? "vira-frente" : i === para ? "sob" : "guardada";
      else papel = i === para ? "volta-verso" : i === de ? "sob" : "guardada";
      pecas.push({ chave: `${folhas[p.folha].chave}:${p.lado}`, slot: "u", papel, folha: p.folha, lado: p.lado });
    });
  }

  // A camada de cada papel: a folha que gira por cima, a que fica por baixo dela atrás.
  const camada = (papel: Papel, slot: Peca["slot"], lado: Lado) => {
    if (papel === "guardada") return 0;
    if (papel.startsWith("vira") || papel.startsWith("volta")) return 3;
    if (papel === "ver") return 2;
    // Por baixo: no desktop, a metade que só se revela no fim fica mais atrás.
    if (slot === "u") return 1;
    if (!virada) return 1;
    return (virada.sentido === 1 ? lado === "e" : lado === "d") ? 2 : 1;
  };

  function conteudo(p: Peca): ReactNode {
    const f = folhas[p.folha];
    if (p.slot === "u") {
      if (p.lado === "d") return f.direita;
      if (f.juntarNoCelular && f.direita) {
        return (
          <>
            {f.esquerda}
            {f.direita}
          </>
        );
      }
      return f.esquerda;
    }
    return p.lado === "e" ? f.esquerda : f.direita;
  }

  function numero(p: Peca): number {
    return duplo ? p.folha * 2 + (p.lado === "e" ? 1 : 2) : indiceNaPista(p) + 1;
  }

  const podeVoltar = aqui > 0;
  const podeAvancar = aqui < total - 1;

  return (
    <ContextoDasFolhas.Provider value={contexto}>
      <div
        ref={raiz}
        className="caderno relative h-full touch-pan-y"
        onPointerDown={aoApertar}
        onPointerUp={aoSoltar}
        onPointerCancel={() => {
          toque.current = null;
        }}
      >
        {pecas.map((p) => {
          const papel = p.papel;
          const vista = papel === "ver";
          const anima = papel !== "ver" && papel !== "sob" && papel !== "guardada";
          // A página nova: só a da esquerda (ou a única) da primeira folha, ao montar.
          const nova = abrirComoNova && vista && p.folha === 0 && p.lado === "e" ? `folha-nova${p.slot === "u" ? "-u" : ""}` : "";
          const f = folhas[p.folha];
          const comPe = total > 1;
          const rotulo = p.lado === "d" ? (f.rotuloDaDireita ?? `continuação de ${f.rotulo}`) : f.rotulo;
          return (
            <section
              key={p.chave}
              aria-label={rotulo}
              data-a-vista={vista ? "" : undefined}
              tabIndex={-1}
              inert={!vista}
              hidden={papel === "guardada"}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && anima) terminar();
              }}
              style={{ zIndex: camada(papel, p.slot, p.lado) }}
              className={`pagina pagina-${p.slot} outline-none ${anima ? papel : nova}`}
            >
              <div className="pagina-rolagem">{conteudo(p)}</div>
              {comPe && (
                <PeDaPagina
                  numero={numero(p)}
                  lado={p.slot === "u" ? "u" : p.lado}
                  anterior={podeVoltar ? anterior : null}
                  proxima={podeAvancar ? proxima : null}
                  aoVoltar={() => passo(-1)}
                  aoAvancar={() => passo(1)}
                />
              )}
            </section>
          );
        })}
        {pecas.length === 0 && <div className="pagina pagina-u" />}
        {/* A página nova, no desktop: a folha em branco da direita levanta e vira,
            e o verso dela é a página da esquerda que chega (.folha-nova). */}
        {abrirComoNova && duplo && (
          <div aria-hidden="true" className="pagina pagina-d folha-em-branco pointer-events-none" style={{ zIndex: 3 }} />
        )}
        <p className="sr-only" aria-live="polite">
          {aviso}
        </p>
      </div>
    </ContextoDasFolhas.Provider>
  );
}

// O pé da página: o número no centro e, no canto de fora, o botão de virar. No
// desktop, a página da esquerda volta e a da direita avança; no celular, a
// página única tem os dois. O pé inteiro é a ponta da folha que se arrasta.
function PeDaPagina({
  numero,
  lado,
  anterior,
  proxima,
  aoVoltar,
  aoAvancar,
}: {
  numero: number;
  lado: "e" | "d" | "u";
  anterior: string | null;
  proxima: string | null;
  aoVoltar: () => void;
  aoAvancar: () => void;
}) {
  const botao =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-tinta-suave transition-colors duration-150 hover:bg-tinta/7 hover:text-tinta disabled:cursor-default disabled:opacity-0";
  return (
    <div
      data-arrastar=""
      className="flex h-14 shrink-0 cursor-grab items-center justify-between px-3 active:cursor-grabbing lg:px-5"
    >
      {lado !== "d" ? (
        <button
          type="button"
          data-virar="anterior"
          onClick={aoVoltar}
          disabled={anterior === null}
          aria-label={anterior ?? "início do caderno"}
          title={anterior ?? undefined}
          className={botao}
        >
          <IconeSeta className="h-5 w-5 rotate-180" />
        </button>
      ) : (
        <span className="w-11" />
      )}
      <span className="text-xs text-tinta-suave tabular-nums" aria-hidden="true">
        {numero}
      </span>
      {lado !== "e" ? (
        <button
          type="button"
          data-virar="proxima"
          onClick={aoAvancar}
          disabled={proxima === null}
          aria-label={proxima ?? "fim do caderno"}
          title={proxima ?? undefined}
          className={botao}
        >
          <IconeSeta className="h-5 w-5" />
        </button>
      ) : (
        <span className="w-11" />
      )}
    </div>
  );
}
