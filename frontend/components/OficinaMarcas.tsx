"use client";
// Oficina do compositor: sílabas poéticas e rimas ao lado de cada verso, mais um
// aviso leve de forma (soneto, haicai). Só no compositor: o leitor nunca vê as
// marcas e nada disso vai para o poema publicado. A análise vem de
// POST /oficina/analise (backend/app/core/metrica.py), que mede o texto sem o
// negrito, o itálico, o sublinhado e o tachado (core/marcas.py).

import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { type AnaliseDoRascunho, analisarRascunho, marcaDoVerso } from "@/lib/api";
import { LIMITES } from "@/lib/vocabulario";

type OpcoesDaOficina = { silabas: boolean; rimas: boolean };
type Opcao = keyof OpcoesDaOficina;

// Para quem nunca mexeu, os dois toggles vêm ligados; quem desliga fica
// desligado (a escolha fica no navegador).
const PADRAO: OpcoesDaOficina = { silabas: true, rimas: true };
const CHAVES: Record<Opcao, string> = { silabas: "oficina.silabas", rimas: "oficina.rimas" };
// Espera depois da última tecla antes de pedir a análise.
const ESPERA_MS = 400;

function lerOpcoes(): OpcoesDaOficina {
  try {
    const salvo = (chave: Opcao) => localStorage.getItem(CHAVES[chave]);
    return {
      silabas: (salvo("silabas") ?? String(PADRAO.silabas)) === "true",
      rimas: (salvo("rimas") ?? String(PADRAO.rimas)) === "true",
    };
  } catch {
    return PADRAO;
  }
}

type Oficina = {
  opcoes: OpcoesDaOficina;
  alternar: (opcao: Opcao) => void;
  analise: AnaliseDoRascunho | null;
  longoDemais: boolean;
};

// Estado dos toggles (lembrado no localStorage) e a análise do texto, com debounce.
export function useOficina(texto: string, forma: string): Oficina {
  const [opcoes, setOpcoes] = useState<OpcoesDaOficina>(PADRAO);
  const [analise, setAnalise] = useState<AnaliseDoRascunho | null>(null);
  const longoDemais = texto.length > LIMITES.oficina_max_caracteres;
  // Com os dois toggles desligados não há análise, nem o aviso de forma.
  const ativa = opcoes.silabas || opcoes.rimas;

  // Lido só no navegador, depois de montar: no servidor não há localStorage.
  useEffect(() => setOpcoes(lerOpcoes()), []);

  useEffect(() => {
    if (!ativa || longoDemais || !texto.trim()) {
      setAnalise(null);
      return;
    }
    let valida = true;
    const espera = setTimeout(() => {
      analisarRascunho(texto, forma || null)
        .then((a) => valida && setAnalise(a))
        .catch(() => valida && setAnalise(null));
    }, ESPERA_MS);
    return () => {
      valida = false;
      clearTimeout(espera);
    };
  }, [texto, forma, ativa, longoDemais]);

  function alternar(opcao: Opcao) {
    const novas = { ...opcoes, [opcao]: !opcoes[opcao] };
    setOpcoes(novas);
    try {
      localStorage.setItem(CHAVES[opcao], String(novas[opcao]));
    } catch {
      // Navegador sem localStorage (aba anônima bloqueada): vale só nesta página.
    }
  }

  return { opcoes, alternar, analise, longoDemais };
}

// A coluna de marcas ao lado do editor (components/EditorDePoema.tsx). Cada verso
// é um bloco do editor, então a altura de cada um (com as quebras automáticas)
// se lê direto dele, e cada marca fica na primeira linha do seu verso. O editor
// cresce com o poema, sem rolagem própria: a coluna rola junto com a página.
export function OficinaMarcas({
  oficina,
  texto,
  campo,
}: {
  oficina: Oficina;
  texto: string;
  campo: RefObject<HTMLElement | null>;
}) {
  const [topos, setTopos] = useState<number[]>([]);
  const [alturaDaLinha, setAlturaDaLinha] = useState<string>("normal");
  const { opcoes, analise } = oficina;
  const linhas = texto.split("\n");
  const ligada = opcoes.silabas || opcoes.rimas;

  useLayoutEffect(() => {
    const editor = campo.current;
    if (!ligada || !editor) return;
    function medir() {
      if (!editor) return;
      const estilo = getComputedStyle(editor);
      const borda = parseFloat(estilo.borderTopWidth) || 0;
      setAlturaDaLinha(estilo.lineHeight);
      setTopos(Array.from(editor.children, (verso) => (verso as HTMLElement).offsetTop + borda));
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(editor);
    return () => observador.disconnect();
  }, [ligada, texto, campo]);

  if (!ligada) return null;
  // Análise de um texto com outro número de linhas: espera a próxima, para não
  // pôr a marca no verso errado.
  const alinhada = analise !== null && analise.versos.length === linhas.length;

  return (
    <div aria-hidden className="relative w-14 shrink-0">
      {alinhada &&
        analise.versos.map((verso, i) => {
          const marca = marcaDoVerso(verso, opcoes);
          if (!marca || topos[i] === undefined) return null;
          const toante = opcoes.rimas && verso.tipo_rima === "toante";
          return (
            <span
              key={i}
              title={toante ? "rima toante" : undefined}
              className={`absolute left-0 text-xs whitespace-nowrap text-tinta-suave tabular-nums ${toante ? "italic" : ""}`}
              style={{ top: topos[i], lineHeight: alturaDaLinha }}
            >
              {marca}
            </span>
          );
        })}
    </div>
  );
}

// "?" ao lado de "oficina": abre uma explicação curta, sem ocupar espaço na tela
// (fica sobreposta). Abre por clique ou toque, fecha com Esc, de novo no "?" ou
// clicando fora; o foco volta para o botão.
function AjudaDaOficina() {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idPopover = useId();

  useEffect(() => {
    if (!aberta) return;
    function fora(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberta(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAberta(false);
      botao.current?.focus();
    }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta]);

  return (
    <span ref={raiz} className="relative inline-flex">
      <button
        ref={botao}
        type="button"
        aria-label="o que é a oficina"
        aria-expanded={aberta}
        aria-controls={idPopover}
        onClick={() => setAberta((a) => !a)}
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full border border-borda font-serifada text-xs text-tinta-suave transition-colors duration-150 hover:border-destaque hover:text-tinta"
      >
        ?
      </button>
      {aberta && (
        <div
          id={idPopover}
          role="note"
          className="absolute top-full left-0 z-20 mt-2 w-72 max-w-[85vw] space-y-1.5 rounded-lg border border-borda bg-papel-alto p-3 font-serifada text-sm leading-snug text-tinta shadow-lg"
        >
          <p>
            Ajuda de escrita, só para você: não vai para o poema publicado. Conta as sílabas
            poéticas (escansão) de cada verso e marca o esquema de rimas ao lado do texto.
          </p>
          <p className="text-tinta-suave">
            Ex.: <span className="tabular-nums">7 A · 7 B · 7 A · 7 B</span> (sete sílabas por
            verso, rimas ABAB).
          </p>
        </div>
      )}
    </span>
  );
}

// Toggles, esquema de rimas e aviso de forma, logo abaixo do corpo do poema.
export function OficinaPainel({ oficina }: { oficina: Oficina }) {
  const { opcoes, alternar, analise, longoDemais } = oficina;
  const botao = (opcao: Opcao, rotulo: string, dica: string) => (
    <button
      type="button"
      title={dica}
      aria-pressed={opcoes[opcao]}
      onClick={() => alternar(opcao)}
      className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs transition-colors duration-150 ${
        opcoes[opcao] ? "border-destaque bg-destaque/10 text-tinta" : "border-borda text-tinta-suave"
      }`}
    >
      {rotulo}
    </button>
  );
  return (
    <div className="space-y-2 text-xs text-tinta-suave">
      <div className="flex flex-wrap items-center gap-2">
        oficina
        <AjudaDaOficina />
        {botao("silabas", "sílabas", "contar as sílabas poéticas de cada verso")}
        {botao("rimas", "rimas", "marcar o esquema de rimas (ABAB)")}
        {opcoes.rimas && analise?.esquema && (
          <span className="tabular-nums" title="esquema de rimas">
            {analise.esquema}
          </span>
        )}
      </div>
      {longoDemais && (opcoes.silabas || opcoes.rimas) && (
        <p>Texto longo demais para a oficina marcar (até {LIMITES.oficina_max_caracteres} caracteres).</p>
      )}
      {(opcoes.silabas || opcoes.rimas) && analise?.aviso && <p role="status">{analise.aviso}</p>}
    </div>
  );
}
