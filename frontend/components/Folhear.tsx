"use client";
// O folhear entre seções: ao ir de uma parte do livro para outra (um marcador da
// lombada, um poema do feed, um autor, um comentário), o livro passa várias
// folhas, como quem procura a página, até a página nova estar carregada; só
// então a última folha assenta com ela. Assim nunca há o corte seco da troca de
// rota nem o esqueleto cinza à vista.
//
// Como funciona: uma camada por cima das folhas (.folhear, em globals.css) com
// cópias estáticas das páginas. A primeira folha que gira é a página de onde se
// saiu (cópia do DOM, com a rolagem de onde a pessoa estava); as do meio são
// folhas impressas ao longe (só os versos, sem texto); a última traz a página
// nova, copiada quando ela está pronta: a rota já mudou e não há nenhum
// .esqueleto (components/Esqueleto.tsx) à vista. Ao deitar, a camada some e a
// página de verdade, que já estava por baixo, fica no lugar.
//
// Começa no clique de um link do Verso para outra rota, no voltar e avançar
// (do navegador ou do botão "voltar", com as folhas passando para trás) e, nas
// trocas por código (router.push), quando a página nova chega ainda
// carregando. Links cujo onClick pode segurar a navegação levam
// data-sem-folhear (o seletor Poema · Renga · Antologia), para o livro não
// folhear à toa. Com prefers-reduced-motion, nada gira: a página de onde se
// saiu fica até a nova estar pronta e some num fade curto.

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

// Uma folha nova a cada INTERVALO; cada uma leva GIRO para virar, e a última,
// que assenta a página nova, GIRO_FINAL (o --virada do globals.css).
const INTERVALO = 130;
const GIRO = 520;
const GIRO_FINAL = 680;
// Folhas impressas no mínimo, para o gesto se ler como folhear mesmo quando a
// página nova já está pronta.
const MINIMO = 2;
// Passou disso sem a página nova ficar pronta, mostra o que houver.
const LIMITE = 8000;
const CURVA = "cubic-bezier(0.4, 0.06, 0.2, 1)";
// Rotas fora do livro (Layout.tsx): para elas não se folheia.
const FORA_DO_LIVRO = /^\/(login|cadastro|boas-vindas)(\/|$)/;

type Lado = "e" | "d" | "u";

type Corrida = {
  origem: string;
  // A rota no passo anterior: a página nova só vale depois de a rota parar de
  // mudar (um redirecionamento passa por outra antes).
  ultima: string;
  inicio: number;
  sentido: 1 | -1;
  impressas: number;
  // Cada folha nova gira por baixo das que já estão no ar (frente) e deita por
  // cima das que já deitaram (verso).
  n: number;
  folhas: HTMLElement[][];
  relogio: ReturnType<typeof setTimeout> | null;
  terminando: boolean;
};

function aleatorio(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Uma página impressa vista de passagem: o título e umas estrofes, só as linhas.
function paginaImpressa(lado: Lado): HTMLElement {
  const pagina = document.createElement("div");
  pagina.className = `pagina pagina-${lado}`;
  const versos = document.createElement("div");
  versos.className = "folhear-versos";
  const titulo = document.createElement("span");
  titulo.className = "folhear-titulo";
  titulo.style.width = `${aleatorio(28, 48)}%`;
  versos.append(titulo);
  const estrofes = Math.round(aleatorio(3, 5));
  for (let i = 0; i < estrofes; i++) {
    const linhas = Math.round(aleatorio(3, 5));
    for (let j = 0; j < linhas; j++) {
      const verso = document.createElement("span");
      verso.style.width = `${aleatorio(34, 82)}%`;
      versos.append(verso);
    }
    const pausa = document.createElement("i");
    versos.append(pausa);
  }
  pagina.append(versos);
  return pagina;
}

// As páginas à vista do livro de verdade (as seções de components/CadernoFolhas.tsx).
function paginasAVista(miolo: HTMLElement | null): HTMLElement[] {
  if (!miolo) return [];
  return Array.from(miolo.querySelectorAll<HTMLElement>(":scope > .caderno > section[data-a-vista]"));
}

function paginaDoLado(paginas: HTMLElement[], lado: Lado): HTMLElement | undefined {
  return paginas.find((p) => p.classList.contains(`pagina-${lado}`));
}

// Uma cópia parada da página: sem ids (não colidem com os da página de verdade),
// sem animações e com a rolagem de onde a página estava.
function copiar(pagina: HTMLElement | undefined, lado: Lado): HTMLElement {
  if (!pagina) return paginaImpressa(lado);
  const copia = pagina.cloneNode(true) as HTMLElement;
  copia.removeAttribute("data-a-vista");
  copia.removeAttribute("aria-label");
  copia.style.zIndex = "";
  copia.classList.add("folhear-copia");
  copia.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  const rolagem = pagina.querySelector<HTMLElement>(".pagina-rolagem")?.scrollTop ?? 0;
  copia.dataset.rolagem = String(rolagem);
  return copia;
}

function acertarRolagem(copia: HTMLElement) {
  const rolagem = Number(copia.dataset.rolagem ?? 0);
  const area = copia.querySelector<HTMLElement>(".pagina-rolagem");
  if (area && rolagem) area.scrollTop = rolagem;
}

export function Folhear({ miolo, caminho, duplo }: { miolo: RefObject<HTMLElement | null>; caminho: string; duplo: boolean }) {
  const palco = useRef<HTMLDivElement>(null);
  const corrida = useRef<Corrida | null>(null);
  const duploAgora = useRef(duplo);
  duploAgora.current = duplo;
  const anterior = useRef(caminho);
  const salvaguarda = useRef<ReturnType<typeof setTimeout> | null>(null);

  function sombra(): string {
    return document.documentElement.dataset.tema === "escuro" ? "0 0 2rem rgb(0 0 0 / 0.5)" : "0 0 2rem rgb(31 27 22 / 0.12)";
  }

  function pousar(el: HTMLElement, z: number) {
    el.style.zIndex = String(z);
    palco.current?.append(el);
    acertarRolagem(el);
  }

  // Uma folha. Para a frente (sentido 1), ela sai da direita e deita na
  // esquerda: a frente gira pela lombada e o verso chega na página da esquerda.
  // Para trás (-1), o espelho: sai da esquerda e deita na direita. No celular só
  // há uma das faces: para a frente, a página sai; para trás, a página chega.
  // Devolve quando a folha deita.
  function virar(frente: HTMLElement | null, verso: HTMLElement | null, ms: number): Promise<void> {
    const c = corrida.current!;
    const s = c.sentido;
    c.n += 1;
    const opcoes: KeyframeAnimationOptions = { duration: ms, easing: CURVA, fill: "both" };
    const par: HTMLElement[] = [];
    let giro: Animation | null = null;
    if (frente) {
      pousar(frente, 1000 - c.n);
      frente.style.transformOrigin = s === 1 ? "left center" : "right center";
      giro = frente.animate(
        [
          { transform: "rotateY(0deg)", boxShadow: sombra() },
          { transform: `rotateY(${-180 * s}deg)`, boxShadow: sombra() },
        ],
        opcoes,
      );
      par.push(frente);
    }
    if (verso) {
      pousar(verso, 10 + c.n);
      verso.style.transformOrigin = s === 1 ? "right center" : "left center";
      const chegada = verso.animate(
        [
          { transform: `rotateY(${180 * s}deg)`, boxShadow: sombra() },
          { transform: "rotateY(0deg)", boxShadow: "0 0 0 transparent" },
        ],
        opcoes,
      );
      giro ??= chegada;
      par.push(verso);
    }
    c.folhas.push(par);
    return (giro?.finished ?? Promise.resolve()).then(
      () => {
        // A folha deitou: as que deitaram antes dela ficaram cobertas, saem.
        const i = c.folhas.indexOf(par);
        c.folhas.splice(0, i).forEach((velhas) => velhas.forEach((el) => el.remove()));
      },
      () => undefined,
    );
  }

  // Os lados da folha que gira: a página de onde ela sai e a página onde deita.
  function lados(): { sai: Lado; deita: Lado } {
    return corrida.current?.sentido === -1 ? { sai: "e", deita: "d" } : { sai: "d", deita: "e" };
  }

  function pronta(c: Corrida): boolean {
    const aqui = window.location.pathname;
    const parada = aqui === c.ultima;
    c.ultima = aqui;
    if (aqui === c.origem || !parada) return false;
    const paginas = paginasAVista(miolo.current);
    return paginas.length > 0 && !paginas.some((p) => p.querySelector(".esqueleto"));
  }

  function encerrar() {
    const c = corrida.current;
    if (c?.relogio) clearTimeout(c.relogio);
    if (salvaguarda.current) clearTimeout(salvaguarda.current);
    corrida.current = null;
    if (palco.current) {
      palco.current.replaceChildren();
      palco.current.hidden = true;
    }
  }

  function passo() {
    const c = corrida.current;
    if (!c || c.terminando) return;
    const esgotou = performance.now() - c.inicio > LIMITE;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      if (pronta(c) || esgotou) {
        c.terminando = true;
        palco.current
          ?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "both" })
          .finished.then(encerrar, encerrar);
        return;
      }
      c.relogio = setTimeout(passo, 100);
      return;
    }
    if ((c.impressas >= MINIMO && pronta(c)) || esgotou) {
      assentar();
      return;
    }
    c.impressas += 1;
    const { sai, deita } = lados();
    if (duploAgora.current) void virar(paginaImpressa(sai), paginaImpressa(deita), GIRO);
    else if (c.sentido === 1) void virar(paginaImpressa("u"), null, GIRO);
    else void virar(null, paginaImpressa("u"), GIRO);
    c.relogio = setTimeout(passo, INTERVALO);
  }

  // A última folha: por baixo dela já está a cópia da página nova do lado de
  // onde ela sai, e o verso traz a do lado onde ela deita. No celular, para a
  // frente a folha sai de cima da página nova; para trás, é ela que chega.
  function assentar() {
    const c = corrida.current!;
    c.terminando = true;
    const paginas = paginasAVista(miolo.current);
    const { sai, deita } = lados();
    if (duploAgora.current) {
      pousar(copiar(paginaDoLado(paginas, sai), sai), 2);
      void virar(paginaImpressa(sai), copiar(paginaDoLado(paginas, deita), deita), GIRO_FINAL).then(encerrar);
    } else if (c.sentido === 1) {
      pousar(copiar(paginaDoLado(paginas, "u"), "u"), 2);
      void virar(paginaImpressa("u"), null, GIRO_FINAL).then(encerrar);
    } else {
      void virar(null, copiar(paginaDoLado(paginas, "u"), "u"), GIRO_FINAL).then(encerrar);
    }
  }

  // `deOnde`: a página de onde se sai ainda está à vista (o clique, o voltar) e
  // vira a primeira folha; senão, ela já trocou e o folhear começa em páginas
  // impressas. `sentido`: -1 no voltar, quando as folhas passam para trás.
  function comecar(deOnde: boolean, sentido: 1 | -1 = 1) {
    const tela = palco.current;
    if (!tela || corrida.current) return;
    corrida.current = {
      origem: anterior.current,
      ultima: window.location.pathname,
      inicio: performance.now(),
      sentido,
      impressas: 0,
      n: 0,
      folhas: [],
      relogio: null,
      terminando: false,
    };
    tela.replaceChildren();
    tela.hidden = false;
    tela.getAnimations().forEach((a) => a.cancel());
    const paginas = deOnde ? paginasAVista(miolo.current) : [];
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { sai, deita } = lados();
    if (duploAgora.current) {
      pousar(copiar(paginaDoLado(paginas, deita), deita), 1);
      pousar(paginaImpressa(sai), 1);
      if (reduzido) pousar(copiar(paginaDoLado(paginas, sai), sai), 2);
      else void virar(copiar(paginaDoLado(paginas, sai), sai), paginaImpressa(deita), GIRO);
    } else if (reduzido || sentido === -1) {
      // Para trás no celular, as folhas chegam por cima da página de onde se sai.
      pousar(copiar(paginaDoLado(paginas, "u"), "u"), 1);
    } else {
      pousar(paginaImpressa("u"), 1);
      void virar(copiar(paginaDoLado(paginas, "u"), "u"), null, GIRO);
    }
    corrida.current.relogio = setTimeout(passo, reduzido ? 100 : INTERVALO);
    // Se a aba for para o fundo no meio, as animações param: a camada não fica presa.
    salvaguarda.current = setTimeout(encerrar, LIMITE + 3000);
  }

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.closest("[data-sem-folhear], .folhear")) return;
      const destino = new URL(link.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname || FORA_DO_LIVRO.test(destino.pathname)) return;
      comecar(true);
    }
    // O voltar e o avançar (do navegador ou o router.back() do "voltar" da
    // página): o Next troca a página já no popstate, antes de qualquer ouvinte
    // nosso; o evento "navigate" da Navigation API vem antes, com a página de
    // onde se sai ainda à vista. Sem a API, vale o caminho da troca por código.
    const navegacao = (window as unknown as { navigation?: EventTarget }).navigation;
    function aoNavegar(e: Event) {
      const { navigationType, destination } = e as Event & { navigationType: string; destination: { url: string; index: number } };
      if (navigationType !== "traverse") return;
      const destino = new URL(destination.url);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname || FORA_DO_LIVRO.test(destino.pathname)) return;
      const daqui = (navegacao as { currentEntry?: { index: number } } | undefined)?.currentEntry?.index ?? 0;
      comecar(true, destination.index < daqui ? -1 : 1);
    }
    document.addEventListener("click", aoClicar, true);
    navegacao?.addEventListener("navigate", aoNavegar);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      navegacao?.removeEventListener("navigate", aoNavegar);
      encerrar();
    };
  }, []);

  // A troca por código (router.push, o "voltar" de uma página): se a página nova
  // chegou carregando, o livro folheia até ela ficar pronta.
  useLayoutEffect(() => {
    if (caminho === anterior.current) return;
    const sem = !corrida.current;
    if (sem && !FORA_DO_LIVRO.test(caminho) && paginasAVista(miolo.current).some((p) => p.querySelector(".esqueleto"))) {
      comecar(false);
    }
    anterior.current = caminho;
  }, [caminho]);

  return <div ref={palco} aria-hidden="true" hidden className="folhear" />;
}
