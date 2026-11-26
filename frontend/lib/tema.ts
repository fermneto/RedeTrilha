// O tema do Verso: claro (a paleta do vídeo de entrega), escuro ou o do sistema.
// A escolha fica no navegador (localStorage), e não na conta: assim ela vale
// antes da primeira pintura, sem piscar o tema errado, e também na tela de
// entrada. O <html> recebe data-tema="claro" ou "escuro" (globals.css troca as
// cores por ele): o SCRIPT_DO_TEMA roda no <head>, antes do corpo, e
// aplicarTema() refaz isso quando a pessoa muda nas Preferências.

export type Tema = "sistema" | "claro" | "escuro";

export const TEMAS: readonly Tema[] = ["sistema", "claro", "escuro"];

const CHAVE = "tema";
const ESCURO = "(prefers-color-scheme: dark)";
// A cor da barra do navegador no celular: o papel de cada tema.
const COR_DA_BARRA = { claro: "#faf7f0", escuro: "#17150f" } as const;

export function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function resolver(tema: Tema): "claro" | "escuro" {
  if (tema !== "sistema") return tema;
  return window.matchMedia(ESCURO).matches ? "escuro" : "claro";
}

function pintar(tema: Tema) {
  const final = resolver(tema);
  document.documentElement.dataset.tema = final;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = COR_DA_BARRA[final];
  });
}

export function aplicarTema(tema: Tema) {
  try {
    if (tema === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem localStorage (modo privado restrito): vale só nesta página.
  }
  pintar(tema);
}

// Repinta já (a barra do navegador) e, no tema do sistema, acompanha a troca do
// sistema (e a escolha feita em outra aba).
export function acompanharTema(): () => void {
  const consulta = window.matchMedia(ESCURO);
  const aoMudar = () => pintar(temaGuardado());
  aoMudar();
  const aoGuardar = (e: StorageEvent) => {
    if (e.key === CHAVE || e.key === null) aoMudar();
  };
  consulta.addEventListener("change", aoMudar);
  window.addEventListener("storage", aoGuardar);
  return () => {
    consulta.removeEventListener("change", aoMudar);
    window.removeEventListener("storage", aoGuardar);
  };
}

// O mesmo que pintar(temaGuardado()), em JS puro, para o <script> do <head>.
export const SCRIPT_DO_TEMA = `(function(){try{var t=localStorage.getItem(${JSON.stringify(CHAVE)});}catch(e){}var f=t==="claro"||t==="escuro"?t:(matchMedia(${JSON.stringify(ESCURO)}).matches?"escuro":"claro");document.documentElement.dataset.tema=f;})();`;
