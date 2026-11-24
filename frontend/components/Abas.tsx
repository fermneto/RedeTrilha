"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DefinicaoDeAba<V extends string> = { valor: V; rotulo: string };

// Abas no padrão do WAI-ARIA: as setas trocam de aba, e cada painel só monta na
// primeira vez que abre (depois fica escondido, sem perder a rolagem já carregada).
export function Abas<V extends string>({
  abas,
  atual,
  aoMudar,
  rotulo,
  bordaEmCima = false,
  children,
}: {
  abas: readonly DefinicaoDeAba<V>[];
  atual: V;
  aoMudar: (aba: V) => void;
  rotulo: string;
  bordaEmCima?: boolean;
  children: (aba: V) => React.ReactNode;
}) {
  const id = useId();
  const [abertas, setAbertas] = useState<Set<V>>(new Set([atual]));
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setAbertas((a) => (a.has(atual) ? a : new Set(a).add(atual)));
  }, [atual]);

  function aoTeclar(e: React.KeyboardEvent) {
    const i = abas.findIndex((a) => a.valor === atual);
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const proxima = abas[(i + passo + abas.length) % abas.length].valor;
    aoMudar(proxima);
    botoes.current[proxima]?.focus();
  }

  return (
    <section>
      <div
        role="tablist"
        aria-label={rotulo}
        onKeyDown={aoTeclar}
        className={`flex border-borda ${bordaEmCima ? "border-y" : "border-b"}`}
      >
        {abas.map(({ valor, rotulo }) => {
          const ativa = valor === atual;
          return (
            <button
              key={valor}
              ref={(el) => {
                botoes.current[valor] = el;
              }}
              id={`${id}-aba-${valor}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`${id}-painel-${valor}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudar(valor)}
              className={`realce flex min-h-13 flex-1 cursor-pointer items-center justify-center text-[0.9375rem] ${
                ativa ? "font-bold text-tinta" : "text-tinta-suave"
              }`}
            >
              <span
                className={`flex h-full items-center border-b-4 py-3 ${ativa ? "border-destaque" : "border-transparent"}`}
              >
                {rotulo}
              </span>
            </button>
          );
        })}
      </div>
      {abas.map(({ valor }) => (
        <div
          key={valor}
          id={`${id}-painel-${valor}`}
          role="tabpanel"
          aria-labelledby={`${id}-aba-${valor}`}
          hidden={valor !== atual}
        >
          {abertas.has(valor) && children(valor)}
        </div>
      ))}
    </section>
  );
}
