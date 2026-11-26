"use client";
// A capa do livro fechado: o mesmo pano da capa do Caderno (.capa, em
// globals.css), com o nome do Verso gravado e o fio da lombada embaixo, nada mais.
//
// Na entrada (login e cadastro), a CapaDaEntrada fica por trás do formulário,
// como um livro fechado com o formulário apoiado nele. Ela é a própria capa do
// livro aberto em escala (a metade direita do Caderno no desktop, de 1024 px, e
// a tela inteira no celular), recortada no tamanho do bloco do formulário.
// Assim, ao crescer, o nome e o pano não mudam de proporção.
//
// Ao entrar (só depois de o login dar certo), o formulário chama useAbrirCapa(),
// e a sequência é:
//   1. o formulário (e a marca) somem num fade, deixando a capa limpa com o
//      nome gravado, e os blocos de poemas da vitrine deslizam para fora da
//      tela, para a esquerda ([data-sai] na página);
//   2. uma cópia da capa por cima de tudo (fixa, aqui no Layout, que não
//      desmonta entre as rotas) cresce do lugar dela até a metade direita do
//      livro aberto (no celular, até a tela inteira). Ao assentar, o token é
//      gravado e a navegação acontece por baixo do papel;
//   3. quando a rota de destino montou, a capa gira na dobra como a capa de um
//      livro: descobre a página da direita por baixo dela e o verso dela deita
//      à esquerda como a página da esquerda lisa, que só então ganha o
//      conteúdo e a lombada (o feed, ou as boas-vindas no cadastro).
// No fim, o foco vai para a página de destino.
//
// Ao sair (useFecharCapa, no "Sair" do MenuDoPerfil), o caminho inverso: o papel
// e a guarda voltam sobre a página da esquerda, a capa gira de volta na dobra e
// fecha sobre a da direita; com o livro fechado, o token sai e o login monta por
// baixo; a capa encolhe até o lugar do formulário, a vitrine volta deslizando
// e o formulário aparece sobre ela, com o foco no primeiro campo. Quem cai no
// login por sessão expirada (401) ou sem token vai direto, sem animação.
//
// A capa é decorativa: aria-hidden,
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

// O recorte da capa grande no formato da capa da entrada (o meio dela) e a escala
// que põe esse recorte no tamanho da capa da entrada.
function recorteDaCapa(capa: Caixa, entrada: { w: number; h: number }) {
  const razao = entrada.w / entrada.h;
  const larga = capa.w / capa.h > razao;
  const w = larga ? capa.h * razao : capa.w;
  const h = larga ? capa.h : capa.w / razao;
  return { x: (capa.w - w) / 2, y: (capa.h - h) / 2, w, h, escala: entrada.h / h };
}

const CANTOS_DO_LIVRO = [2, 10, 10, 2];
const CANTO_PEQUENO = 12;

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

// A capa da entrada, por trás do formulário: a capa do livro inteira, em escala,
// recortada no tamanho do bloco do formulário (que mede a caixa dela). Antes da
// medida, só o pano; o nome, por trás do formulário, aparece quando ele sai.
export function CapaDaEntrada({ className = "" }: { className?: string }) {
  const janela = useJanela();
  const caixa = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setTamanho({ w: el.offsetWidth, h: el.offsetHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const capa = janela && capaDoLivro(janela.largura, janela.altura);
  const r = capa && tamanho && tamanho.h > 0 ? recorteDaCapa(capa, tamanho) : null;
  return (
    <div
      ref={caixa}
      aria-hidden="true"
      data-capa-da-entrada=""
      className={`capa overflow-hidden ${className}`}
      style={{ borderRadius: CANTO_PEQUENO }}
    >
      {capa && r && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${-r.x * r.escala}px, ${-r.y * r.escala}px) scale(${r.escala})` }}
        >
          <Pano capa={capa} estilo={{ boxShadow: "none" }} />
        </div>
      )}
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

type PedidoDeSaida = {
  // Apaga o token e navega para o login: roda quando a capa já fechou o livro.
  navegar: () => void | Promise<void>;
};

type Fechamento = {
  fase: "cobrindo" | "esperando" | "encolhendo";
  reduzido: boolean;
  janela: { largura: number; altura: number };
  // A capa fechada sobre o livro e, já no login, a capa da entrada.
  para: Caixa;
  de: Caixa | null;
};

type Contexto = { abrir: (pedido: Pedido) => void; fechar: (pedido: PedidoDeSaida) => void };

// Sem o provedor (ou sem a capa na tela), só navega.
const ContextoDaCapa = createContext<Contexto>({
  abrir: (pedido) => pedido.navegar(),
  fechar: (pedido) => void pedido.navegar(),
});

export function useAbrirCapa(): (pedido: Pedido) => void {
  return useContext(ContextoDaCapa).abrir;
}

// O inverso da entrada, no "Sair": a capa volta da esquerda e fecha o livro,
// o token sai e o login monta por baixo dela; ela encolhe até o lugar do
// formulário, a vitrine volta deslizando e o formulário aparece sobre a capa.
export function useFecharCapa(): (pedido: PedidoDeSaida) => void {
  return useContext(ContextoDaCapa).fechar;
}

// Sair acelera (a vitrine vai embora); chegar desacelera (a capa assenta).
const CURVA_DE_SAIDA = "cubic-bezier(0.45, 0, 0.8, 0.3)";
const CURVA_DE_MUDANCA = "cubic-bezier(0.65, 0, 0.35, 1)";
// A capa é mais pesada que uma folha: começa devagar, como quem a levanta, e deita
// sem quicar.
const CURVA_DA_CAPA = "cubic-bezier(0.55, 0.05, 0.2, 1)";
const CURVA_DE_FECHAR = "cubic-bezier(0.3, 0, 0.2, 1)";
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

// O inverso do passo 1, na tela de login recém-montada: a vitrine volta
// deslizando da esquerda e o formulário aparece depois de a capa assentar. As
// animações já nascem no estado de partida (fill both), antes do papel sair.
function encherAPagina(atrasoDoFormulario: number): Animation[] {
  const animacoes: Animation[] = [];
  document.querySelectorAll<HTMLElement>("[data-sai]").forEach((el) => {
    if (el.dataset.sai === "sumir") {
      animacoes.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 260,
          delay: atrasoDoFormulario,
          easing: "ease-out",
          fill: "both",
        }),
      );
      return;
    }
    animacoes.push(
      el.animate([{ transform: "translateX(calc(-100vw - 100%))" }, { transform: "translateX(0)" }], {
        duration: 640,
        delay: 240,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      }),
    );
  });
  return animacoes;
}

const semSessaoNoServidor = () => null;

export function ProvedorDaCapa({ children }: { children: ReactNode }) {
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const navegar = useRef<(() => void) | null>(null);
  const sair = useRef<(() => void | Promise<void>) | null>(null);

  const fechar = useCallback((pedido: PedidoDeSaida) => {
    // Só fecha o livro que está aberto na tela (o Caderno).
    if (!document.querySelector(".miolo")) {
      void pedido.navegar();
      return;
    }
    const janela = { largura: window.innerWidth, altura: window.innerHeight };
    sair.current = pedido.navegar;
    setFechamento({
      fase: "cobrindo",
      reduzido: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      janela,
      para: capaDoLivro(janela.largura, janela.altura),
      de: null,
    });
  }, []);

  // O livro está fechado: apaga o token e vai para o login por baixo da capa.
  const fechouOLivro = useCallback(() => {
    const ir = sair.current;
    sair.current = null;
    setFechamento((f) => (f ? { ...f, fase: "esperando" } : f));
    void ir?.();
  }, []);

  const chegouAoLogin = useCallback((de: Caixa | null) => {
    setFechamento((f) => (f ? { ...f, de, fase: "encolhendo" } : f));
  }, []);

  // A capa assentou no lugar do formulário: o foco vai para o primeiro campo.
  const fechou = useCallback(() => {
    setFechamento(null);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("main input, main textarea")?.focus({ preventScroll: true });
    });
  }, []);

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
    <ContextoDaCapa.Provider value={{ abrir, fechar }}>
      {children}
      {fechamento && (
        <CapaQueFecha fechamento={fechamento} aoFechar={fechouOLivro} aoChegar={chegouAoLogin} aoTerminar={fechou} />
      )}
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
  const r = recorteDaCapa(para, de);
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

  // 3. Abrir, como um livro: nada do livro aparece antes do giro. O papel cobre
  // tudo fora da capa; a capa levanta na dobra e descobre a página da direita
  // por baixo dela (com a sombra que projeta diminuindo); o verso dela, a guarda,
  // deita à esquerda como a página da esquerda ainda lisa. Só então a guarda e o
  // papel se desfazem num crossfade curto, e a página da esquerda e a lombada
  // ganham o conteúdo (ou o esqueleto, se o feed ainda estiver chegando).
  useEffect(() => {
    if (fase !== "abrindo") return;
    let vivo = true;
    if (reduzido) {
      const some = raiz.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" });
      terminar([some], 600).then(() => {
        if (vivo) aoAbrir();
      });
    } else {
      const tempo = { duration: GIRO, delay: 80, easing: CURVA_DA_CAPA, fill: "both" as const };
      const giro = [
        folha.current?.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], tempo),
        sombra.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0, offset: 0.75 }, { opacity: 0 }], tempo),
      ];
      // O crossfade começa quando a capa já está quase deitada (a cauda da curva
      // é só assentar), para a página lisa não ficar esperando.
      const crossfade = { duration: 280, delay: 80 + GIRO * 0.8, easing: "ease-out", fill: "both" as const };
      const revelar = [
        veu.current?.animate([{ opacity: 1 }, { opacity: 0 }], crossfade),
        guarda.current?.animate([{ opacity: 1 }, { opacity: 0 }], crossfade),
      ];
      terminar([...giro, ...revelar], GIRO + 900).then(() => {
        if (vivo) aoAbrir();
      });
    }
    return () => {
      vivo = false;
    };
  }, [fase]);

  const crescendo = fase === "crescendo";
  return (
    <CamadaDoLivro
      partes={{ raiz, veu, sombra, capa, folha, frente, guarda }}
      janela={janela}
      para={para}
      sombraFechada={crescendo && !reduzido}
      veuEstilo={{ clipPath: fase === "abrindo" && !reduzido ? furoNoPapel(para) : undefined }}
      capaEstilo={{
        transform: crescendo && !reduzido ? inicio : undefined,
        opacity: crescendo && reduzido ? 0 : undefined,
      }}
      frenteEstilo={{
        clipPath: crescendo && !reduzido ? recortePequeno : undefined,
        boxShadow: crescendo && !reduzido ? "none" : undefined,
      }}
    />
  );
}

// O papel com um furo onde está a capa: cobre o livro todo, menos o que a capa
// cobre, para o giro dela descobrir (ou cobrir) só a página da direita.
function furoNoPapel(para: Caixa): string {
  const [x1, y1, x2, y2] = [para.x, para.y, para.x + para.w, para.y + para.h].map((n) => `${n}px`);
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1})`;
}

// A geometria de crescer e encolher: o recorte da capa grande no formato da
// capa da entrada, em escala, sobre ela.
function caminhoDaCapa(para: Caixa, de: Caixa, largura: number) {
  const r = recorteDaCapa(para, de);
  const fim = cantos(largura);
  return {
    pequena: `translate(${de.x - para.x - r.x * r.escala}px, ${de.y - para.y - r.y * r.escala}px) scale(${r.escala})`,
    recortePequeno: `inset(${r.y}px ${r.x}px ${r.y}px ${r.x}px round ${CANTO_PEQUENO / r.escala}px)`,
    recorteGrande: `inset(0px 0px 0px 0px round ${px(fim)})`,
  };
}

type Partes = Record<
  "raiz" | "veu" | "sombra" | "capa" | "folha" | "frente" | "guarda",
  React.RefObject<HTMLDivElement | null>
>;

function usePartes(): Partes {
  return {
    raiz: useRef<HTMLDivElement>(null),
    veu: useRef<HTMLDivElement>(null),
    sombra: useRef<HTMLDivElement>(null),
    capa: useRef<HTMLDivElement>(null),
    folha: useRef<HTMLDivElement>(null),
    frente: useRef<HTMLDivElement>(null),
    guarda: useRef<HTMLDivElement>(null),
  };
}

// A camada por cima de tudo, a mesma na entrada e na saída: o papel (que
// esconde a página enquanto ela troca), a sombra que a capa deixa na página da
// direita e a capa, com a frente de pano e o verso de papel (a guarda).
function CamadaDoLivro({
  partes,
  janela,
  para,
  sombraFechada,
  veuEstilo,
  capaEstilo,
  folhaEstilo,
  frenteEstilo,
  guardaEstilo,
}: {
  partes: Partes;
  janela: { largura: number; altura: number };
  para: Caixa;
  sombraFechada: boolean;
  veuEstilo?: React.CSSProperties;
  capaEstilo?: React.CSSProperties;
  folhaEstilo?: React.CSSProperties;
  frenteEstilo?: React.CSSProperties;
  guardaEstilo?: React.CSSProperties;
}) {
  const caixa = (c: Caixa) => ({ left: c.x, top: c.y, width: c.w, height: c.h });
  const fim = px(cantos(janela.largura));
  return (
    <div ref={partes.raiz} aria-hidden="true" inert className="pointer-events-none fixed inset-0 z-[100]">
      <div ref={partes.veu} className="absolute inset-0 bg-papel" style={veuEstilo} />
      <div ref={partes.sombra} className="sombra-da-capa absolute" style={{ ...caixa(para), opacity: 0, borderRadius: fim }} />
      <div className={`absolute inset-0 ${sombraFechada ? "sombra-da-capa-fechada" : ""}`}>
        <div
          ref={partes.capa}
          className="absolute origin-top-left"
          style={{
            ...caixa(para),
            perspective: 2600,
            perspectiveOrigin: `${janela.largura / 2 - para.x}px ${janela.altura / 2 - para.y}px`,
            ...capaEstilo,
          }}
        >
          <div ref={partes.folha} className="absolute inset-0 origin-left [transform-style:preserve-3d]" style={folhaEstilo}>
            <Pano
              ref={partes.frente}
              capa={{ ...para, x: 0, y: 0 }}
              className="face-da-capa absolute inset-0"
              estilo={{ borderRadius: fim, ...frenteEstilo }}
            />
            <div
              ref={partes.guarda}
              className="guarda-da-capa face-da-capa absolute inset-0"
              style={{ borderRadius: fim, ...guardaEstilo }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const DEITADA = "rotateY(-180deg)";

function CapaQueFecha({
  fechamento,
  aoFechar,
  aoChegar,
  aoTerminar,
}: {
  fechamento: Fechamento;
  aoFechar: () => void;
  aoChegar: (de: Caixa | null) => void;
  aoTerminar: () => void;
}) {
  const { fase, reduzido, janela, para, de } = fechamento;
  const partes = usePartes();
  const { raiz, veu, sombra, capa, folha, frente, guarda } = partes;

  const caminho = usePathname();
  const logado = useSyncExternalStore<boolean | null>(assinarSessao, temToken, semSessaoNoServidor);
  const noLogin = caminho === "/login" && logado === false;

  // 1. Cobrir e fechar. O papel volta sobre tudo fora da capa e a guarda volta
  // a ser a página da esquerda lisa (um crossfade curto, o inverso do fim da
  // abertura); depois a capa levanta da esquerda, gira na dobra e desce sobre a
  // página da direita, com a sombra crescendo por baixo dela.
  useEffect(() => {
    if (fase !== "cobrindo") return;
    let vivo = true;
    let anim: (Animation | undefined)[];
    if (reduzido) {
      anim = [raiz.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out", fill: "forwards" })];
    } else {
      // No celular a capa está fora da tela, à esquerda: não há o que cobrir antes.
      const duplo = janela.largura >= LARGURA_DUPLA;
      const cobrir = { duration: 280, easing: "ease-out", fill: "both" as const };
      // Ao fechar, a capa sai logo do lugar (a mão já está nela) e desce assentando.
      const tempo = { duration: GIRO, delay: duplo ? 200 : 0, easing: CURVA_DE_FECHAR, fill: "both" as const };
      anim = [
        veu.current?.animate([{ opacity: 0 }, { opacity: 1 }], cobrir),
        guarda.current?.animate([{ opacity: 0 }, { opacity: 1 }], cobrir),
        folha.current?.animate([{ transform: DEITADA }, { transform: "rotateY(0deg)" }], tempo),
        sombra.current?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], tempo),
      ];
    }
    terminar(anim, reduzido ? 500 : GIRO + 1000).then(() => {
      if (vivo) aoFechar();
    });
    return () => {
      vivo = false;
    };
    // Uma vez por fase: as medidas e os avisos não mudam enquanto o fechamento dura.
  }, [fase]);

  // 2. Esperar o login montar por baixo (dois quadros para pintar) e medir a
  // capa da entrada. Se ele não chegar, a capa sai assim mesmo.
  useEffect(() => {
    if (fase !== "esperando") return;
    const medir = () => {
      const alvo = document.querySelector<HTMLElement>("[data-capa-da-entrada]");
      const r = alvo?.getBoundingClientRect();
      aoChegar(r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    if (noLogin) {
      let quadro = requestAnimationFrame(() => {
        quadro = requestAnimationFrame(medir);
      });
      return () => cancelAnimationFrame(quadro);
    }
    const relogio = setTimeout(medir, 3000);
    return () => clearTimeout(relogio);
  }, [fase, noLogin, aoChegar]);

  // 3. Encolher: a capa desliza do livro até o lugar do formulário, a vitrine
  // volta pela esquerda e, com a capa assentada, o formulário aparece sobre ela.
  useEffect(() => {
    if (fase !== "encolhendo") return;
    let vivo = true;
    const capaDaEntrada = document.querySelector<HTMLElement>("[data-capa-da-entrada]");
    if (reduzido || !de) {
      const some = raiz.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" });
      terminar([some], 600).then(() => {
        if (vivo) aoTerminar();
      });
      return () => {
        vivo = false;
      };
    }
    const { pequena, recortePequeno, recorteGrande } = caminhoDaCapa(para, de, janela.largura);
    // A capa da entrada fica escondida até a que encolhe pousar sobre ela.
    if (capaDaEntrada) capaDaEntrada.style.visibility = "hidden";
    encherAPagina(CRESCER - 40);
    const tempo = { duration: CRESCER, easing: CURVA_DE_MUDANCA, fill: "forwards" as const };
    const anim = [
      veu.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "forwards" }),
      capa.current?.animate([{ transform: "none" }, { transform: pequena }], tempo),
      frente.current?.animate([{ clipPath: recorteGrande }, { clipPath: recortePequeno }], tempo),
    ];
    terminar(anim, CRESCER + 600).then(() => {
      if (capaDaEntrada) capaDaEntrada.style.visibility = "";
      if (vivo) aoTerminar();
    });
    return () => {
      vivo = false;
    };
  }, [fase]);

  const cobrindo = fase === "cobrindo";
  const encolhendo = fase === "encolhendo";
  return (
    <CamadaDoLivro
      partes={partes}
      janela={janela}
      para={para}
      sombraFechada={encolhendo && !reduzido}
      veuEstilo={{ clipPath: cobrindo && !reduzido ? furoNoPapel(para) : undefined, opacity: cobrindo && !reduzido ? 0 : undefined }}
      folhaEstilo={{ transform: cobrindo && !reduzido ? DEITADA : undefined }}
      frenteEstilo={{ boxShadow: encolhendo && !reduzido ? "none" : undefined }}
      guardaEstilo={{ opacity: cobrindo && !reduzido ? 0 : undefined }}
    />
  );
}
