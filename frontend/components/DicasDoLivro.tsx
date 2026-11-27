"use client";
// As dicas do livro: quem chega não sabe que o Verso se folheia, nem o que são
// os ícones da lombada. Em vez de um tour de uma vez, quatro notas curtas, cada
// uma no contexto dela e uma de cada vez (a regra de quando está em
// lib/dicas.ts): virar a página, as ações e os comentários, a lombada e
// escrever (poema e renga). Cada nota é um papel apoiado sobre o livro, com uma
// ponta para o que ela explica e um fio em volta dele; "entendi", o X ou Esc a
// dispensam, e a dispensada não volta (fica na conta, PUT /dicas/{dica});
// "dispensar todas" marca as quatro. Virar a página ou sair dela só tira a nota
// da frente: sem ter sido dispensada, ela volta no próximo lugar em que couber.
// A exceção é a de folhear: virar a página com ela aberta já é tê-la aprendido.
// "Rever as dicas", nas Preferências, zera a lista.
//
// As notas não mexem nos componentes que explicam: acham o lugar deles pelo que
// já está na página (o botão de virar, a barra de ações presa no topo da
// conversa, a navegação "Principal"). Só quem tem conta vê as dicas.

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useDuplo } from "@/components/CadernoFolhas";
import { IconeAvisos } from "@/components/icones/IconeAvisos";
import { IconeExplorar } from "@/components/icones/IconeExplorar";
import { IconeFechar } from "@/components/icones/IconeFechar";
import { IconeInicio } from "@/components/icones/IconeInicio";
import { IconeMensagens } from "@/components/icones/IconeMensagens";
import { IconePerfil } from "@/components/icones/IconePerfil";
import type { PropsIcone } from "@/components/icones/Icone";
import { buscarDicasVistas, marcarDicaVista, temToken, zerarDicas, type Dica } from "@/lib/api";
import {
  type Lado,
  lugarDasDicas,
  type LugarDasDicas,
  ORDEM_DAS_DICAS,
  posicionarNota,
  proximaDica,
  VIRADAS_ENTRE_DICAS,
} from "@/lib/dicas";

// "Rever as dicas" (nas Preferências) avisa o provedor, que já está montado.
const EVENTO_DICAS_ZERADAS = "verso:dicas-zeradas";

// De quanto em quanto tempo o provedor olha se a próxima dica cabe: o bastante
// para a virada da página (680 ms, globals.css) terminar antes.
const INTERVALO = 1000;

type Contexto = {
  // O feed avisa cada folha à vista ("3:e"); a primeira é a de chegada.
  virou: (posicao: string) => void;
};

const ContextoDasDicas = createContext<Contexto>({ virou: () => undefined });

export function useDicasDoLivro(): Contexto {
  return useContext(ContextoDasDicas);
}

// O lugar de cada dica na página, achado pelo que os componentes já marcam.
function ancoraDa(dica: Dica, lugar: LugarDasDicas): HTMLElement | null {
  const achar = (seletor: string) => document.querySelector<HTMLElement>(seletor);
  switch (dica) {
    case "virar_pagina":
      return achar('[data-a-vista] [data-virar="proxima"]:not([disabled])');
    case "acoes":
      return achar("[data-a-vista] .acoes-presas");
    case "lombada":
      return achar('nav[aria-label="Principal"] ul');
    case "escrever":
      return lugar === "escrever"
        ? achar('nav[aria-label="O que escrever"] ul')
        : achar('nav[aria-label="Principal"] a[href="/escrever"]');
  }
}

function ladoDa(dica: Dica, lugar: LugarDasDicas, duplo: boolean): Lado {
  if (dica === "virar_pagina") return "acima";
  if (dica === "acoes") return "abaixo";
  if (dica === "escrever" && lugar === "escrever") return "abaixo";
  return duplo ? "direita" : "acima";
}

// Os controles da página à vista, menos a âncora: na página dupla, a nota não
// os cobre (a de folhear, sobre a seta do pé, tapava o campo de comentar).
function controlesAVista(ancora: HTMLElement): DOMRect[] {
  return [...document.querySelectorAll<HTMLElement>("[data-a-vista] :is(a, button, input, select, textarea)")]
    .filter((el) => !el.contains(ancora) && !ancora.contains(el))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
}

// A capa que abre ao entrar (CapaDoLivro) cobre a tela: a dica espera ela sair.
function capaNaFrente(): boolean {
  return document.querySelector("div.fixed.inset-0[inert][aria-hidden]") !== null;
}

function escrevendoEmCampo(): boolean {
  const ativo = document.activeElement;
  return ativo instanceof HTMLElement && (ativo.isContentEditable || ativo.matches("input, textarea, select"));
}

export function DicasDoLivro({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const lugar = lugarDasDicas(caminho);
  const duplo = useDuplo();
  // null = ainda não sei (sem conta ou sem resposta): nenhuma dica aparece.
  const [vistas, setVistas] = useState<Dica[] | null>(null);
  const [aberta, setAberta] = useState<Dica | null>(null);
  // Páginas folheadas desde a última dica; ao chegar numa página, o intervalo
  // já está cumprido (a primeira dica vem logo).
  const [viradas, setViradas] = useState(VIRADAS_ENTRE_DICAS);
  const abertaRef = useRef<Dica | null>(null);
  const ultimaPosicao = useRef<string | null>(null);
  abertaRef.current = aberta;

  // As vistas vêm da conta; sem token (saiu, ou outra conta vai entrar), esquece.
  useEffect(() => {
    if (!temToken()) {
      setVistas(null);
      return;
    }
    if (vistas !== null) return;
    let vivo = true;
    buscarDicasVistas()
      .then((r) => vivo && setVistas(r.vistas))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [caminho, vistas]);

  useEffect(() => {
    const aoZerar = () => {
      setVistas([]);
      setViradas(VIRADAS_ENTRE_DICAS);
    };
    window.addEventListener(EVENTO_DICAS_ZERADAS, aoZerar);
    return () => window.removeEventListener(EVENTO_DICAS_ZERADAS, aoZerar);
  }, []);

  const dispensar = useCallback((dica: Dica) => {
    setAberta(null);
    setViradas(0);
    setVistas((atuais) => (atuais && !atuais.includes(dica) ? [...atuais, dica] : atuais));
    // Se falhar (sem rede), a dica volta numa próxima visita: nada a mostrar aqui.
    marcarDicaVista(dica).catch(() => undefined);
  }, []);

  // "Dispensar todas": as quatro como vistas, um PUT por dica (idempotente).
  const dispensarTodas = useCallback(() => {
    setAberta(null);
    setViradas(0);
    setVistas([...ORDEM_DAS_DICAS]);
    Promise.all(ORDEM_DAS_DICAS.map((d) => marcarDicaVista(d))).catch(() => undefined);
  }, []);

  // Outra página: a nota aberta sai sem contar como vista, a posição recomeça e
  // a próxima dica (ou a mesma) pode vir logo, se o lugar dela estiver ali.
  useEffect(() => {
    ultimaPosicao.current = null;
    setAberta(null);
    setViradas(VIRADAS_ENTRE_DICAS);
  }, [caminho]);

  const virou = useCallback(
    (posicao: string) => {
      const antes = ultimaPosicao.current;
      ultimaPosicao.current = posicao;
      if (antes === null || antes === posicao) return;
      const aberta = abertaRef.current;
      if (!aberta) {
        setViradas((n) => n + 1);
        return;
      }
      // Virar com a dica de folhear aberta é fazer o que ela ensina: foi vista.
      // As outras só saem da frente e voltam depois do intervalo, para não
      // reaparecerem a cada página.
      if (aberta === "virar_pagina") dispensar(aberta);
      else {
        setAberta(null);
        setViradas(0);
      }
    },
    [dispensar],
  );

  // Uma de cada vez: com nenhuma aberta, olha de tempos em tempos se a próxima
  // cabe (o feed pode ainda estar carregando, a capa ainda abrindo).
  useEffect(() => {
    if (aberta || vistas === null) return;
    const relogio = setInterval(() => {
      if (capaNaFrente() || document.visibilityState !== "visible") return;
      const dica = proximaDica(vistas, lugar, viradas, (d) => ancoraDa(d, lugar) !== null);
      if (dica) setAberta(dica);
    }, INTERVALO);
    return () => clearInterval(relogio);
  }, [aberta, vistas, lugar, viradas]);

  return (
    <ContextoDasDicas.Provider value={{ virou }}>
      {children}
      {aberta && (
        <Nota
          key={aberta}
          dica={aberta}
          lugar={lugar}
          duplo={duplo}
          aoDispensar={() => dispensar(aberta)}
          aoDispensarTodas={dispensarTodas}
        />
      )}
    </ContextoDasDicas.Provider>
  );
}

// `raio`: o arredondamento da âncora, para o fio acompanhar a forma dela.
type Posicionada = ReturnType<typeof posicionarNota> & { ancora: DOMRect; raio: number };

function Nota({
  dica,
  lugar,
  duplo,
  aoDispensar,
  aoDispensarTodas,
}: {
  dica: Dica;
  lugar: LugarDasDicas;
  duplo: boolean;
  aoDispensar: () => void;
  aoDispensarTodas: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Posicionada | null>(null);
  const focoAntes = useRef<Element | null>(null);
  const focou = useRef(false);
  const id = useId();
  const texto = TEXTOS[dica](duplo, lugar);

  // A nota acompanha a âncora (a coluna rola, a janela muda de tamanho, a barra
  // de ações desce): mede a cada quadro e só re-renderiza quando algo mudou.
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      const ancora = ancoraDa(dica, lugar);
      const nota = ref.current;
      if (ancora && nota) {
        const r = ancora.getBoundingClientRect();
        const raio = parseFloat(getComputedStyle(ancora).borderTopLeftRadius) || 0;
        const p = posicionarNota(
          r,
          { width: nota.offsetWidth, height: nota.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
          ladoDa(dica, lugar, duplo),
          duplo ? controlesAVista(ancora) : [],
        );
        setPos((atual) =>
          atual &&
          atual.top === p.top &&
          atual.left === p.left &&
          atual.seta === p.seta &&
          atual.ancora.top === r.top &&
          atual.ancora.left === r.left &&
          atual.ancora.width === r.width &&
          atual.ancora.height === r.height &&
          atual.raio === raio
            ? atual
            : { ...p, ancora: r, raio },
        );
      } else {
        setPos(null);
      }
      quadro = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(quadro);
  }, [dica, lugar, duplo]);

  // O foco vai à nota quando ela aparece (as setas continuam virando a página),
  // a não ser que a pessoa esteja escrevendo num campo; ao fechar, volta.
  useEffect(() => {
    if (!pos || focou.current) return;
    focou.current = true;
    if (escrevendoEmCampo()) return;
    focoAntes.current = document.activeElement;
    ref.current?.focus({ preventScroll: true });
  }, [pos]);

  useEffect(() => {
    const nota = ref.current;
    return () => {
      const antes = focoAntes.current;
      const ativo = document.activeElement;
      const perdido = !ativo || ativo === document.body || Boolean(nota?.contains(ativo));
      if (perdido && antes instanceof HTMLElement && antes.isConnected && !antes.closest("[inert]")) {
        antes.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // No campo de texto, o Esc é do campo (o compositor usa Esc e Tab para sair dele).
      if (escrevendoEmCampo() && !ref.current?.contains(document.activeElement)) return;
      e.preventDefault();
      aoDispensar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoDispensar]);

  // Na capa (a lombada), o fio é da cor da gravura; nas páginas, do destaque.
  const naCapa = dica === "lombada" || (dica === "escrever" && lugar !== "escrever");
  const seta =
    pos?.lado === "direita"
      ? { left: -7, top: pos.seta - 6, borda: "border-b border-l" }
      : pos?.lado === "abaixo"
        ? { top: -7, left: pos.seta - 6, borda: "border-t border-l" }
        : { bottom: -7, left: (pos?.seta ?? 0) - 6, borda: "border-b border-r" };

  return createPortal(
    <>
      {pos && (
        <span
          aria-hidden="true"
          className={`fio-da-dica pointer-events-none fixed z-[90] border-2 ${
            naCapa ? "border-gravura/70" : "border-destaque/60"
          }`}
          style={{
            top: pos.ancora.top - 4,
            left: pos.ancora.left - 4,
            width: pos.ancora.width + 8,
            height: pos.ancora.height + 8,
            borderRadius: pos.raio > 0 ? Math.min(pos.raio + 4, 9999) : 12,
          }}
        />
      )}
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        tabIndex={-1}
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
        className={`fixed z-[90] w-[min(21rem,calc(100vw-1.5rem))] rounded-lg border border-borda bg-papel-alto px-5 pt-4 pb-3 text-tinta shadow-[0_2px_4px_rgb(0_0_0/0.08),0_18px_40px_-14px_rgb(0_0_0/0.4)] outline-none ${
          pos ? `nota-da-dica nota-${pos.lado}` : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute h-3 w-3 rotate-45 border-borda bg-papel-alto ${seta.borda}`}
          style={{ top: seta.top, left: seta.left, bottom: seta.bottom }}
        />
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-titulo`} className="pt-1 font-serifada text-[1.1875rem] leading-snug italic text-pretty">
            {texto.titulo}
          </h2>
          <button
            type="button"
            onClick={aoDispensar}
            aria-label="fechar a dica"
            className="-mt-1.5 -mr-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-tinta-suave transition-colors duration-150 hover:bg-tinta/7 hover:text-tinta"
          >
            <IconeFechar className="h-[1.125rem] w-[1.125rem]" />
          </button>
        </div>
        <div id={`${id}-texto`} className="mt-1.5 space-y-2 text-[0.9375rem] leading-relaxed">
          {texto.corpo}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={aoDispensarTodas}
            className="-ml-3 inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm text-tinta-suave transition-colors duration-150 hover:bg-tinta/7 hover:text-tinta"
          >
            dispensar todas
          </button>
          <button
            type="button"
            onClick={aoDispensar}
            className="-mr-3 inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-bold text-destaque transition-colors duration-150 hover:bg-destaque/8"
          >
            entendi
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-borda bg-papel px-1.5 py-px font-sans text-[0.8125rem] text-tinta">
      {children}
    </kbd>
  );
}

const CAMINHOS: { Icone: (props: PropsIcone) => ReactNode; nome: string; descricao: string }[] = [
  { Icone: IconeInicio, nome: "Início", descricao: "o livro que se folheia" },
  { Icone: IconeExplorar, nome: "Explorar", descricao: "poetas, formas, rengas e antologias" },
  { Icone: IconeAvisos, nome: "Avisos", descricao: "quem curtiu, comentou ou seguiu você" },
  { Icone: IconeMensagens, nome: "Mensagens", descricao: "as conversas a dois" },
  { Icone: IconePerfil, nome: "Perfil", descricao: "seus poemas, rascunhos e preferências" },
];

const TEXTOS: Record<Dica, (duplo: boolean, lugar: LugarDasDicas) => { titulo: string; corpo: ReactNode }> = {
  virar_pagina: (duplo) => ({
    titulo: "Cada poema é uma página",
    corpo: duplo ? (
      <p>
        Para folhear, use as setas <Tecla>←</Tecla> <Tecla>→</Tecla>, a seta no canto da página ou arraste a folha
        pelo pé. No touchpad, deslize dois dedos para o lado.
      </p>
    ) : (
      <p>
        Para folhear, arraste a folha para o lado ou toque na seta do canto. Depois de cada poema vem a página da
        conversa sobre ele.
      </p>
    ),
  }),
  acoes: (duplo) => ({
    titulo: duplo ? "Na página ao lado, a conversa" : "Aqui, a conversa sobre o poema",
    corpo: (
      <>
        <p>Curta, reposte, cite, guarde numa antologia ou comente.</p>
        <p>Para falar de um trecho, selecione os versos no próprio poema: o comentário fica preso a eles.</p>
      </>
    ),
  }),
  lombada: (duplo) => ({
    titulo: duplo ? "Na lombada, os caminhos" : "Na borda do livro, os caminhos",
    corpo: (
      <ul className="space-y-1.5">
        {CAMINHOS.map(({ Icone, nome, descricao }) => (
          <li key={nome} className="flex items-baseline gap-2.5">
            <Icone className="h-4 w-4 shrink-0 translate-y-0.5 text-tinta-suave" />
            <span>
              <span className="font-semibold">{nome}</span>
              <span className="text-tinta-suave">: {descricao}</span>
            </span>
          </li>
        ))}
      </ul>
    ),
  }),
  escrever: (_, lugar) => ({
    titulo: lugar === "escrever" ? "Um poema, ou uma renga" : "Para escrever",
    corpo:
      lugar === "escrever" ? (
        <p>
          O poema não tem limite de tamanho, e as quebras de linha ficam como você deixar. Troque para Renga para
          começar um poema a várias mãos: você escreve a primeira estrofe, e outros poetas continuam, um de cada vez.
        </p>
      ) : (
        <p>
          Este botão abre uma página em branco para o seu poema, sem limite de tamanho. No alto dela, troque Poema por
          Renga para começar um poema a várias mãos: você escreve a primeira estrofe, e outros poetas continuam.
        </p>
      ),
  }),
};

// Nas Preferências: zera as dicas vistas, que voltam aos poucos, a partir do Início.
export function ReverAsDicas() {
  const [estado, setEstado] = useState<"parado" | "zerando" | "pronto" | "erro">("parado");

  async function rever() {
    setEstado("zerando");
    try {
      await zerarDicas();
      window.dispatchEvent(new Event(EVENTO_DICAS_ZERADAS));
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <section aria-labelledby="dicas-do-livro" className="px-4 pt-6 pb-10">
      <h2 id="dicas-do-livro" className="border-b border-borda pb-2 text-sm font-semibold">
        Dicas do livro
      </h2>
      <p className="mt-3 max-w-[56ch] text-sm text-tinta-suave">
        As notas sobre folhear, conversar, a lombada e escrever aparecem uma vez cada. Para lê-las de novo, elas voltam
        aos poucos, a partir do Início.
      </p>
      <button
        type="button"
        onClick={rever}
        disabled={estado === "zerando"}
        className="-ml-4 mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold text-destaque transition-colors duration-150 hover:bg-destaque/8 disabled:cursor-wait disabled:opacity-60"
      >
        {estado === "zerando" ? "um instante..." : "rever as dicas"}
      </button>
      <p role="status" className="text-sm text-tinta-suave">
        {estado === "pronto" && "Pronto: as dicas voltam a aparecer, uma de cada vez."}
        {estado === "erro" && <span className="text-destaque">Não deu para rever as dicas. Tente de novo.</span>}
      </p>
    </section>
  );
}
