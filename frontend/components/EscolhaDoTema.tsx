"use client";
// Nas Preferências: o tema do Verso, claro, escuro ou o do sistema (o padrão).
// A escolha vale na hora e fica neste navegador (lib/tema.ts).

import { useEffect, useState } from "react";

import { aplicarTema, type Tema, TEMAS, temaGuardado } from "@/lib/tema";

const ROTULOS: Record<Tema, string> = { sistema: "Sistema", claro: "Claro", escuro: "Escuro" };

export function EscolhaDoTema() {
  // Até montar, nada marcado: a escolha só existe no navegador.
  const [tema, setTema] = useState<Tema | null>(null);
  useEffect(() => setTema(temaGuardado()), []);

  function escolher(novo: Tema) {
    setTema(novo);
    aplicarTema(novo);
  }

  return (
    <section aria-labelledby="aparencia" className="px-4 pt-6">
      <h2 id="aparencia" className="border-b border-borda pb-2 text-sm font-semibold">
        Aparência
      </h2>
      <p id="aparencia-texto" className="mt-3 max-w-[56ch] text-sm text-tinta-suave">
        O papel claro ou escuro. Em Sistema, o Verso acompanha o seu aparelho. Vale neste navegador.
      </p>
      <div
        role="radiogroup"
        aria-labelledby="aparencia"
        aria-describedby="aparencia-texto"
        className="mt-3 inline-flex rounded-full border border-borda p-1"
      >
        {TEMAS.map((t) => (
          <label
            key={t}
            className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-destaque ${
              tema === t ? "bg-tinta font-semibold text-papel" : "text-tinta-suave hover:text-tinta"
            }`}
          >
            <input
              type="radio"
              name="tema"
              value={t}
              checked={tema === t}
              onChange={() => escolher(t)}
              className="sr-only"
            />
            {ROTULOS[t]}
          </label>
        ))}
      </div>
    </section>
  );
}
