"use client";
// Oficina do compositor: sílabas poéticas e rimas ao lado de cada verso, mais um
// aviso leve de forma (soneto, haicai). Só no compositor: o leitor nunca vê as
// marcas e nada disso vai para o poema publicado. A análise vem de
// POST /oficina/analise (backend/app/core/metrica.py), que mede o texto sem o
// negrito, o itálico, o sublinhado e o tachado (core/marcas.py).

import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

import {
  type AnaliseDoRascunho,
  analisarRascunho,
  marcaDoVerso,
  OFICINA_MAX_CARACTERES,
} from "@/lib/api";

export type OpcoesDaOficina = { silabas: boolean; rimas: boolean };
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

export type Oficina = {
  opcoes: OpcoesDaOficina;
  alternar: (opcao: Opcao) => void;
  analise: AnaliseDoRascunho | null;
  longoDemais: boolean;
};

// Estado dos toggles (lembrado no localStorage) e a análise do texto, com debounce.
export function useOficina(texto: string, forma: string): Oficina {
  const [opcoes, setOpcoes] = useState<OpcoesDaOficina>(PADRAO);
  const [analise, setAnalise] = useState<AnaliseDoRascunho | null>(null);
  const longoDemais = texto.length > OFICINA_MAX_CARACTERES;
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

// Toggles, esquema de rimas e aviso de forma, logo abaixo do corpo do poema.
export function OficinaPainel({ oficina }: { oficina: Oficina }) {
  const { opcoes, alternar, analise, longoDemais } = oficina;
  const botao = (opcao: Opcao, rotulo: string) => (
    <button
      type="button"
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
        {botao("silabas", "sílabas")}
        {botao("rimas", "rimas")}
        {opcoes.rimas && analise?.esquema && (
          <span className="tabular-nums" title="esquema de rimas">
            {analise.esquema}
          </span>
        )}
      </div>
      {longoDemais && (opcoes.silabas || opcoes.rimas) && (
        <p>Texto longo demais para a oficina marcar (até {OFICINA_MAX_CARACTERES} caracteres).</p>
      )}
      {(opcoes.silabas || opcoes.rimas) && analise?.aviso && <p role="status">{analise.aviso}</p>}
    </div>
  );
}
