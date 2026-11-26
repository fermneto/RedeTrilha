"use client";
// A capa do livro fechado: o mesmo pano da capa do Caderno (.capa, em
// globals.css), com o nome do Verso gravado e o fio da lombada embaixo, nada mais.
//
// Na tela de entrada (login e cadastro) a CapaDaEntrada fica à direita do
// formulário: no desktop (de 1024 px), exatamente onde fica a metade direita do
// livro aberto do Caderno; no celular, uma faixa no alto da tela.
//
// Ao entrar (só depois de o login dar certo), o formulário chama useAbrirCapa():
// uma cópia da capa por cima de tudo (fixa, no Layout, que não desmonta entre as
// rotas) fecha o livro sobre a tela (no desktop, o papel cobre o formulário; no
// celular, a faixa desce até cobrir a tela), e só então grava o token e navega.
// A capa espera a rota de destino montar por baixo dela e gira na dobra como a
// capa de um livro, revelando o livro já aberto no feed (ou as boas-vindas, no
// cadastro). No fim, o foco vai para a página de destino. A capa é decorativa:
// aria-hidden, inert e sem receber clique nem foco. Com prefers-reduced-motion,
// sem giro: a capa aparece e some num fade curto.
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
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { DUPLO } from "@/components/CadernoFolhas";
import { assinarSessao, temToken } from "@/lib/api";

// O nome centrado na capa; no desktop, um pouco acima do meio. A mesma caixa na
// capa da entrada e na que abre, para a troca de uma pela outra não se ver.
const CENTRO = "flex items-center justify-center lg:pb-[12vh]";

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

// A capa da tela de entrada. As medidas do desktop repetem as do Caderno: a
// lombada (5.25rem) e a sobra da capa à direita (7 px); a dobra é o meio do miolo.
export function CapaDaEntrada() {
  return (
    <div
      aria-hidden="true"
      data-capa-da-entrada=""
      className={`capa relative h-[clamp(10rem,30vh,15rem)] shrink-0 lg:absolute lg:inset-y-0 lg:right-0 lg:left-[var(--dobra)] lg:h-auto lg:rounded-[0.125rem_0.625rem_0.625rem_0.125rem] ${CENTRO}`}
    >
      <Gravura />
    </div>
  );
}

type Caixa = { x: number; y: number; w: number; h: number };

type Pedido = {
  // A rota para onde a capa abre.
  destino: string;
  // Grava o token e navega: roda quando a capa já cobre a tela.
  navegar: () => void;
};

type Abertura = {
  fase: "fechando" | "esperando" | "abrindo";
  duplo: boolean;
  reduzido: boolean;
  // Onde a capa estava na tela de entrada e onde fica fechada sobre o livro.
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

const CURVA_DA_TAMPA = "cubic-bezier(0.65, 0, 0.35, 1)";
// A capa é mais pesada que uma folha: começa devagar, como quem a levanta, e deita
// sem quicar.
const CURVA_DA_CAPA = "cubic-bezier(0.55, 0.05, 0.2, 1)";
const GIRO = 1000;

// Cada animação termina pelo `finished` ou, se a aba estiver em segundo plano,
// pelo relógio.
function terminar(animacoes: (Animation | undefined)[], limite: number): Promise<void> {
  const todas = Promise.all(animacoes.filter(Boolean).map((a) => a!.finished.catch(() => undefined)));
  return Promise.race([todas.then(() => undefined), new Promise<void>((ok) => setTimeout(ok, limite))]);
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
    const duplo = window.matchMedia(DUPLO).matches;
    const r = capa.getBoundingClientRect();
    const de = { x: r.left, y: r.top, w: r.width, h: r.height };
    navegar.current = pedido.navegar;
    setAbertura({
      fase: "fechando",
      duplo,
      reduzido: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      de,
      // No desktop a capa da entrada já está no lugar da capa do livro; no
      // celular, o livro fechado ocupa a tela.
      para: duplo ? de : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
      alvo: new URL(pedido.destino, window.location.href).pathname,
    });
  }, []);

  const avancar = useCallback((fase: Abertura["fase"]) => {
    setAbertura((a) => (a ? { ...a, fase } : a));
  }, []);

  const fechouSobreATela = useCallback(() => {
    const ir = navegar.current;
    navegar.current = null;
    avancar("esperando");
    ir?.();
  }, [avancar]);

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
        <CapaQueAbre abertura={abertura} aoFechar={fechouSobreATela} aoChegar={() => avancar("abrindo")} aoAbrir={abriu} />
      )}
    </ContextoDaCapa.Provider>
  );
}

function CapaQueAbre({
  abertura,
  aoFechar,
  aoChegar,
  aoAbrir,
}: {
  abertura: Abertura;
  aoFechar: () => void;
  aoChegar: () => void;
  aoAbrir: () => void;
}) {
  const { fase, duplo, reduzido, de, para, alvo } = abertura;
  const raiz = useRef<HTMLDivElement>(null);
  const veu = useRef<HTMLDivElement>(null);
  const sombra = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const frente = useRef<HTMLDivElement>(null);
  const guarda = useRef<HTMLDivElement>(null);

  const caminho = usePathname();
  const logado = useSyncExternalStore<boolean | null>(assinarSessao, temToken, semSessaoNoServidor);
  const chegou = caminho === alvo && logado === true;

  // O recorte da capa na tela de entrada, dentro da capa fechada (no celular, a
  // faixa do alto; no desktop, a capa inteira).
  const recorte = `inset(${Math.max(0, de.y - para.y)}px ${Math.max(0, para.x + para.w - (de.x + de.w))}px ${Math.max(
    0,
    para.y + para.h - (de.y + de.h),
  )}px ${Math.max(0, de.x - para.x)}px)`;

  // Fechar: o papel cobre o formulário e, no celular, a capa desce sobre a tela.
  useEffect(() => {
    if (fase !== "fechando") return;
    // Com movimento reduzido no celular, a própria capa aparece por cima de tudo
    // num fade; o papel por baixo dela só apagaria a faixa da entrada.
    const anim: (Animation | undefined)[] = [
      reduzido && !duplo
        ? undefined
        : veu.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: reduzido ? 150 : 200,
            easing: "ease-out",
            fill: "forwards",
          }),
    ];
    let tampa: Animation | undefined;
    if (reduzido && !duplo) {
      anim.push(folha.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out", fill: "forwards" }));
    } else if (!duplo) {
      tampa = frente.current?.animate([{ clipPath: recorte }, { clipPath: "inset(0px 0px 0px 0px)" }], {
        duration: 380,
        easing: CURVA_DA_TAMPA,
        fill: "forwards",
      });
      anim.push(tampa);
    }
    let vivo = true;
    terminar(anim, 700).then(() => {
      if (!vivo) return;
      if (frente.current) frente.current.style.clipPath = "none";
      tampa?.cancel();
      aoFechar();
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

  // Abrir: o papel some e mostra a metade esquerda do livro; a capa levanta na
  // dobra, deixando a sombra na página da direita, e deita à esquerda.
  useEffect(() => {
    if (fase !== "abrindo") return;
    let anim: (Animation | undefined)[];
    if (reduzido) {
      anim = [raiz.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" })];
    } else {
      const atraso = duplo ? 160 : 40;
      const tempo = { duration: GIRO, delay: atraso, easing: CURVA_DA_CAPA, fill: "both" as const };
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
  const cantos = duplo ? "0.125rem 0.625rem 0.625rem 0.125rem" : undefined;

  return (
    <div ref={raiz} aria-hidden="true" inert className="capa-que-abre pointer-events-none fixed inset-0 z-[100]">
      <div ref={veu} className="absolute inset-0 bg-papel" style={{ opacity: 0 }} />
      <div ref={sombra} className="sombra-da-capa absolute" style={{ ...caixa(para), opacity: 0, borderRadius: cantos }} />
      <div
        ref={folha}
        className="absolute [transform-style:preserve-3d]"
        style={{ ...caixa(para), transformOrigin: "left center", opacity: reduzido && !duplo && fase === "fechando" ? 0 : undefined }}
      >
        <div
          ref={frente}
          className="capa face-da-capa absolute inset-0"
          style={{ borderRadius: cantos, clipPath: fase === "fechando" && !reduzido && !duplo ? recorte : undefined }}
        >
          <div className={`absolute ${CENTRO}`} style={caixa({ x: de.x - para.x, y: de.y - para.y, w: de.w, h: de.h })}>
            <Gravura />
          </div>
        </div>
        <div ref={guarda} className="guarda-da-capa face-da-capa absolute inset-0" style={{ borderRadius: cantos }} />
      </div>
    </div>
  );
}
