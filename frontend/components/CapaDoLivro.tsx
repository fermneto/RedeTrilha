"use client";
// A capa do livro fechado: o mesmo pano da capa do Caderno (.capa, em
// globals.css), com o nome do Verso gravado e o fio da lombada embaixo, nada mais.
//
// Na entrada (login e cadastro), a CapaDaEntrada fica pequena, abaixo do
// formulário. Ela é a própria capa do livro aberto em escala: a metade direita do
// Caderno no desktop (de 1024 px) e a tela inteira no celular, recortada no
// formato de um livro (3:4). Assim, ao crescer, nada muda de proporção.
//
// Ao entrar (só depois de o login dar certo), o formulário chama useAbrirCapa(),
// e a sequência é:
//   1. o formulário (e a marca) somem num fade e os blocos de poemas da vitrine
//      deslizam para fora da tela, para a esquerda ([data-sai] na página);
//   2. uma cópia da capa por cima de tudo (fixa, aqui no Layout, que não
//      desmonta entre as rotas) cresce do lugar dela até a metade direita do
//      livro aberto (no celular, até a tela inteira). Ao assentar, o token é
//      gravado e a navegação acontece por baixo do papel;
//   3. quando a rota de destino montou, o papel some, mostrando a metade
//      esquerda do livro, e a capa gira na dobra como a capa de um livro,
//      revelando a primeira página do feed (ou as boas-vindas, no cadastro).
// No fim, o foco vai para a página de destino. A capa é decorativa: aria-hidden,
// inert e sem receber clique nem foco. Com prefers-reduced-motion, sem deslizes
// nem giro: tudo some num fade curto, a capa aparece e some em fade.
//
// Por que uma camada no Layout, e não View Transitions: a página de destino busca
// dados depois de montar (o feed chega pelo esqueleto), o router do Next navega
// de forma assíncrona e o View Transitions congela a tela numa captura enquanto
// isso, e ainda falta em parte dos navegadores. A camada funciona em qualquer
// navegador, deixa a página viva por baixo e só abre quando a rota já está lá.

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { assinarSessao, temToken } from "@/lib/api";

type Caixa = { x: number; y: number; w: number; h: number };

// A partir daqui, a página dupla do Caderno (CadernoFolhas.tsx, DUPLO).
const LARGURA_DUPLA = 1024;
// O formato da capa pequena: um livro em pé.
const RAZAO = 3 / 4;

// Onde fica a capa fechada sobre o livro: no desktop, a metade direita do
// Caderno (h-dvh com px-6 py-5, até 1400 px; a lombada de 5.25rem à esquerda,
// a sobra de 7 px à direita e a dobra no meio do miolo); no celular, a tela.
function capaDoLivro(largura: number, altura: number): Caixa {
  if (largura < LARGURA_DUPLA) return { x: 0, y: 0, w: largura, h: altura };
  const livro = Math.min(largura - 48, 1400);
  const inicio = (largura - livro) / 2;
  const dobra = inicio + 84 + (livro - 84 - 7) / 2;
  return { x: dobra, y: 20, w: inicio + livro - dobra, h: altura - 40 };
}

// O recorte 3:4 no meio da capa grande e a escala que o põe no tamanho da pequena.
function recorteDaCapa(capa: Caixa, alturaPequena: number) {
  const larga = capa.w / capa.h > RAZAO;
  const w = larga ? capa.h * RAZAO : capa.w;
  const h = larga ? capa.h : capa.w / RAZAO;
  return { x: (capa.w - w) / 2, y: (capa.h - h) / 2, w, h, escala: alturaPequena / h };
}

// A altura da capa pequena. No celular, do tamanho de um livro na mão. No
// desktop, ela fica solta abaixo do formulário e ocupa a sobra até o pé da tela
// (sem passar dele nem criar rolagem), de 88 a 150 px.
function alturaPequena(largura: number, altura: number, topo: number | null): number {
  if (largura < LARGURA_DUPLA) return Math.round(Math.min(196, Math.max(150, altura * 0.22)));
  const sobra = topo === null ? altura * 0.16 : altura - topo - 20;
  return Math.round(Math.min(150, Math.max(88, sobra)));
}

const CANTOS_DO_LIVRO = [2, 10, 10, 2];
const CANTO_PEQUENO = 6;

function cantos(largura: number): number[] {
  return largura >= LARGURA_DUPLA ? CANTOS_DO_LIVRO : [0, 0, 0, 0];
}

const px = (lista: number[]) => lista.map((n) => `${n}px`).join(" ");

// O nome centrado na capa; no desktop, um pouco acima do meio. A mesma caixa na
// capa da entrada e na que abre, para a troca de uma pela outra não se ver.
function Gravura() {
  return (
    <span className="gravura-da-capa flex flex-col items-center">
      <span className="font-serifada text-[3.5rem] leading-none font-semibold tracking-tight italic lg:text-[clamp(4.5rem,6.5vw,6rem)]">
        Verso
      </span>
      <span className="mt-5 h-px w-10 bg-gravura/25 lg:mt-7 lg:w-14" />
    </span>
  );
}

function Pano({
  capa,
  estilo,
  className = "",
  ref,
}: {
  capa: Caixa;
  estilo?: React.CSSProperties;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={`capa flex items-center justify-center lg:pb-[12vh] ${className}`}
      style={{ width: capa.w, height: capa.h, ...estilo }}
    >
      <Gravura />
    </div>
  );
}

// O tamanho da janela, lido no navegador (no servidor, null).
function assinarJanela(avisar: () => void) {
  window.addEventListener("resize", avisar);
  return () => window.removeEventListener("resize", avisar);
}

function useJanela(): { largura: number; altura: number } | null {
  const chave = useSyncExternalStore(
    assinarJanela,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "",
  );
  if (!chave) return null;
  const [largura, altura] = chave.split("x").map(Number);
  return { largura, altura };
}

// A capa pequena da entrada: a capa do livro inteira, em escala, recortada em 3:4.
export function CapaDaEntrada({ className = "" }: { className?: string }) {
  const janela = useJanela();
  const caixa = useRef<HTMLDivElement>(null);
  // Onde começa a capa na página (o topo dela não depende da altura).
  const [topo, setTopo] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!caixa.current) return;
    setTopo(caixa.current.getBoundingClientRect().top + window.scrollY);
  }, [janela?.largura, janela?.altura]);

  if (!janela) {
    return (
      <div
        aria-hidden="true"
        className={`invisible aspect-[3/4] h-[clamp(9.375rem,22dvh,12.25rem)] lg:h-[clamp(5.5rem,16dvh,9.375rem)] ${className}`}
      />
    );
  }
  const capa = capaDoLivro(janela.largura, janela.altura);
  const altura = alturaPequena(janela.largura, janela.altura, topo);
  const r = recorteDaCapa(capa, altura);
  return (
    <div
      ref={caixa}
      aria-hidden="true"
      data-capa-da-entrada=""
      className={`sombra-da-capa-fechada ${topo === null ? "invisible" : ""} ${className}`}
      style={{ width: Math.round(altura * RAZAO), height: altura }}
    >
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: CANTO_PEQUENO }}>
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${-r.x * r.escala}px, ${-r.y * r.escala}px) scale(${r.escala})` }}
        >
          <Pano capa={capa} estilo={{ boxShadow: "none" }} />
        </div>
      </div>
    </div>
  );
}

type Pedido = {
  // A rota para onde a capa abre.
  destino: string;
  // Grava o token e navega: roda quando a capa já cobre a página.
  navegar: () => void;
};

type Abertura = {
  fase: "crescendo" | "esperando" | "abrindo";
  reduzido: boolean;
  janela: { largura: number; altura: number };
  // A capa pequena na tela e a capa fechada sobre o livro.
  de: Caixa;
  para: Caixa;
  // O pathname do destino: a capa abre quando a rota chega a ele.
  alvo: string;
};

// Sem o provedor (ou sem a capa na tela), só navega.
const ContextoDaCapa = createContext<(pedido: Pedido) => void>((pedido) => pedido.navegar());

export function useAbrirCapa(): (pedido: Pedido) => void {
  return useContext(ContextoDaCapa);
}

// Sair acelera (a vitrine vai embora); chegar desacelera (a capa assenta).
const CURVA_DE_SAIDA = "cubic-bezier(0.45, 0, 0.8, 0.3)";
const CURVA_DE_MUDANCA = "cubic-bezier(0.65, 0, 0.35, 1)";
// A capa é mais pesada que uma folha: começa devagar, como quem a levanta, e deita
// sem quicar.
const CURVA_DA_CAPA = "cubic-bezier(0.55, 0.05, 0.2, 1)";
const SAIDA = 520;
const CRESCER = 680;
const GIRO = 1000;

// Cada fase termina pelo `finished` das animações ou, se a aba estiver em
// segundo plano, pelo relógio.
function terminar(animacoes: (Animation | undefined)[], limite: number): Promise<void> {
  const todas = Promise.all(animacoes.filter(Boolean).map((a) => a!.finished.catch(() => undefined)));
  return Promise.race([todas.then(() => undefined), new Promise<void>((ok) => setTimeout(ok, limite))]);
}

// 1. O formulário some e a vitrine desliza para a esquerda, para fora da tela.
function esvaziarAPagina(reduzido: boolean): Promise<void> {
  const animacoes: Animation[] = [];
  const sumir = { duration: reduzido ? 160 : 220, easing: "ease-out", fill: "forwards" as const };
  document.querySelectorAll<HTMLElement>("[data-sai]").forEach((el) => {
    if (reduzido || el.dataset.sai === "sumir") {
      animacoes.push(el.animate([{ opacity: 1 }, { opacity: 0 }], sumir));
      return;
    }
    animacoes.push(
      el.animate([{ transform: "translateX(0)" }, { transform: "translateX(calc(-100vw - 100%))" }], {
        duration: SAIDA,
        delay: 120,
        easing: CURVA_DE_SAIDA,
        fill: "forwards",
      }),
    );
  });
  return terminar(animacoes, reduzido ? 400 : SAIDA + 500);
}

const semSessaoNoServidor = () => null;

export function ProvedorDaCapa({ children }: { children: ReactNode }) {
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const navegar = useRef<(() => void) | null>(null);

  const abrir = useCallback((pedido: Pedido) => {
    const capa = document.querySelector<HTMLElement>("[data-capa-da-entrada]");
    if (!capa) {
      pedido.navegar();
      return;
    }
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navegar.current = pedido.navegar;
    esvaziarAPagina(reduzido).then(() => {
      const r = capa.getBoundingClientRect();
      const janela = { largura: window.innerWidth, altura: window.innerHeight };
      setAbertura({
        fase: "crescendo",
        reduzido,
        janela,
        de: { x: r.left, y: r.top, w: r.width, h: r.height },
        para: capaDoLivro(janela.largura, janela.altura),
        alvo: new URL(pedido.destino, window.location.href).pathname,
      });
    });
  }, []);

  const avancar = useCallback((fase: Abertura["fase"]) => {
    setAbertura((a) => (a ? { ...a, fase } : a));
  }, []);

  // A capa já cobre a página: grava o token e navega por baixo dela.
  const irAoDestino = useCallback(() => {
    const ir = navegar.current;
    navegar.current = null;
    ir?.();
  }, []);

  const abriu = useCallback(() => {
    setAbertura(null);
    // O foco vai para a página de destino: a página à vista do Caderno ou o
    // <main> da tela (as boas-vindas).
    requestAnimationFrame(() => {
      const alvo =
        document.querySelector<HTMLElement>("[data-a-vista]") ?? document.querySelector<HTMLElement>("main");
      if (!alvo) return;
      if (!alvo.hasAttribute("tabindex")) {
        alvo.setAttribute("tabindex", "-1");
        alvo.style.outline = "none";
      }
      alvo.focus({ preventScroll: true });
    });
  }, []);

  return (
    <ContextoDaCapa.Provider value={abrir}>
      {children}
      {abertura && (
        <CapaQueAbre
          abertura={abertura}
          aoCobrir={irAoDestino}
          aoCrescer={() => avancar("esperando")}
          aoChegar={() => avancar("abrindo")}
          aoAbrir={abriu}
        />
      )}
    </ContextoDaCapa.Provider>
  );
}

function CapaQueAbre({
  abertura,
  aoCobrir,
  aoCrescer,
  aoChegar,
  aoAbrir,
}: {
  abertura: Abertura;
  aoCobrir: () => void;
  aoCrescer: () => void;
  aoChegar: () => void;
  aoAbrir: () => void;
}) {
  const { fase, reduzido, janela, de, para, alvo } = abertura;
  const raiz = useRef<HTMLDivElement>(null);
  const veu = useRef<HTMLDivElement>(null);
  const sombra = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const frente = useRef<HTMLDivElement>(null);
  const guarda = useRef<HTMLDivElement>(null);

  const caminho = usePathname();
  const logado = useSyncExternalStore<boolean | null>(assinarSessao, temToken, semSessaoNoServidor);
  const chegou = caminho === alvo && logado === true;

  // De onde a capa cresce: o recorte 3:4, em escala, sobre a capa pequena.
  const r = recorteDaCapa(para, de.h);
  const inicio = `translate(${de.x - para.x - r.x * r.escala}px, ${de.y - para.y - r.y * r.escala}px) scale(${r.escala})`;
  const fim = cantos(janela.largura);
  const recortePequeno = `inset(${r.y}px ${r.x}px ${r.y}px ${r.x}px round ${CANTO_PEQUENO / r.escala}px)`;
  const recorteGrande = `inset(0px 0px 0px 0px round ${px(fim)})`;

  // 2. A capa cresce até o lugar dela no livro; a página vai por baixo do papel.
  useEffect(() => {
    if (fase !== "crescendo") return;
    const anim: (Animation | undefined)[] = [];
    if (reduzido) {
      anim.push(capa.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out", fill: "forwards" }));
    } else {
      const tempo = { duration: CRESCER, easing: CURVA_DE_MUDANCA, fill: "forwards" as const };
      anim.push(
        capa.current?.animate([{ transform: inicio }, { transform: "none" }], tempo),
        frente.current?.animate([{ clipPath: recortePequeno }, { clipPath: recorteGrande }], tempo),
      );
    }
    let vivo = true;
    terminar(anim, CRESCER + 600).then(() => {
      if (!vivo) return;
      // Já no lugar e cobrindo a página: só agora navega, para o trabalho da rota
      // nova não roubar quadros do crescimento. O recorte e a sombra de filtro
      // saem no render da próxima fase; fica a sombra da .capa.
      aoCobrir();
      aoCrescer();
    });
    return () => {
      vivo = false;
    };
    // Uma vez por fase: as medidas e os avisos não mudam enquanto a abertura dura.
  }, [fase]);

  // Esperar: a rota de destino montou por baixo; dois quadros para ela pintar.
  // Se a rota não chegar (ou demorar), a capa abre assim mesmo.
  useEffect(() => {
    if (fase !== "esperando") return;
    if (chegou) {
      let quadro = requestAnimationFrame(() => {
        quadro = requestAnimationFrame(aoChegar);
      });
      return () => cancelAnimationFrame(quadro);
    }
    const relogio = setTimeout(aoChegar, 3000);
    return () => clearTimeout(relogio);
  }, [fase, chegou, aoChegar]);

  // 3. Abrir: o papel some e mostra a metade esquerda do livro; a capa levanta na
  // dobra, deixando a sombra na página da direita, e deita à esquerda.
  useEffect(() => {
    if (fase !== "abrindo") return;
    let anim: (Animation | undefined)[];
    if (reduzido) {
      anim = [raiz.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" })];
    } else {
      const tempo = { duration: GIRO, delay: 160, easing: CURVA_DA_CAPA, fill: "both" as const };
      anim = [
        veu.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: "ease-out", fill: "forwards" }),
        folha.current?.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], tempo),
        guarda.current?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.85 }, { opacity: 0 }], tempo),
        sombra.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0, offset: 0.8 }, { opacity: 0 }], tempo),
      ];
    }
    let vivo = true;
    terminar(anim, reduzido ? 600 : GIRO + 900).then(() => {
      if (vivo) aoAbrir();
    });
    return () => {
      vivo = false;
    };
  }, [fase]);

  const caixa = (c: Caixa) => ({ left: c.x, top: c.y, width: c.w, height: c.h });
  const crescendo = fase === "crescendo";

  return (
    <div ref={raiz} aria-hidden="true" inert className="pointer-events-none fixed inset-0 z-[100]">
      {/* A página já está vazia (o formulário sumiu, a vitrine saiu): o papel
          entra inteiro e a navegação acontece por baixo dele. */}
      <div ref={veu} className="absolute inset-0 bg-papel" />
      <div ref={sombra} className="sombra-da-capa absolute" style={{ ...caixa(para), opacity: 0, borderRadius: px(fim) }} />
      <div className={`absolute inset-0 ${crescendo && !reduzido ? "sombra-da-capa-fechada" : ""}`}>
        <div
          ref={capa}
          className="absolute origin-top-left"
          style={{
            ...caixa(para),
            transform: crescendo && !reduzido ? inicio : undefined,
            opacity: crescendo && reduzido ? 0 : undefined,
            perspective: 2600,
            perspectiveOrigin: `${janela.largura / 2 - para.x}px ${janela.altura / 2 - para.y}px`,
          }}
        >
          <div ref={folha} className="absolute inset-0 origin-left [transform-style:preserve-3d]">
            <Pano
              ref={frente}
              capa={{ ...para, x: 0, y: 0 }}
              className="face-da-capa absolute inset-0"
              estilo={{
                borderRadius: px(fim),
                clipPath: crescendo && !reduzido ? recortePequeno : undefined,
                boxShadow: crescendo && !reduzido ? "none" : undefined,
              }}
            />
            <div ref={guarda} className="guarda-da-capa face-da-capa absolute inset-0" style={{ borderRadius: px(fim) }} />
          </div>
        </div>
      </div>
    </div>
  );
}
