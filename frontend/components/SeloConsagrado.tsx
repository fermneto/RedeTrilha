"use client";
// Selo de poeta consagrado: um lacre de cera (borda em dez lóbulos) com uma pena
// de escrever no meio, na cor de destaque. Fica logo depois do nome, na altura do
// texto. Não depende só da cor: a forma é própria, tem aria-label e um tooltip no
// hover e no foco com "domínio público" e os anos de vida.

import { useId } from "react";

import { anosDeVida, type User } from "@/lib/api";

export const ROTULO_CONSAGRADO = "Poeta consagrado (domínio público)";

// Lacre: círculo de borda ondulada (dez lóbulos, raio 8,9 a 10). Pena: bico de
// escrever com a fenda e o furo, vazado na cor do papel.
function Lacre({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M9.25 3.54Q12 .4 14.75 3.54Q18.82 2.62 19.2 6.77Q23.03 8.42 20.9 12Q23.03 15.58 19.2 17.23Q18.82 21.38 14.75 20.46Q12 23.6 9.25 20.46Q5.18 21.38 4.8 17.23Q.97 15.58 3.1 12Q.97 8.42 4.8 6.77Q5.18 2.62 9.25 3.54Z"
      />
      <path
        fill="var(--color-papel)"
        d="M12 17.25L8.9 12.4C8.9 10.5 10.1 8.9 12 7.6C13.9 8.9 15.1 10.5 15.1 12.4Z"
      />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M12 16.3V12.9" />
      <circle cx="12" cy="11.9" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function SeloConsagrado({ usuario, className = "h-[1.1em] w-[1.1em]" }: { usuario: User; className?: string }) {
  const id = useId();
  if (!usuario.consagrado) return null;
  const vida = anosDeVida(usuario);

  // Esc tira o foco, e com ele o tooltip (WCAG 1.4.13: dispensável sem mover o ponteiro).
  function aoTeclar(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Escape") e.currentTarget.blur();
  }

  return (
    <span
      role="img"
      aria-label={ROTULO_CONSAGRADO}
      aria-describedby={id}
      tabIndex={0}
      onKeyDown={aoTeclar}
      className="group/selo relative inline-flex shrink-0 cursor-help items-center rounded-full align-[-0.15em] text-destaque"
    >
      <Lacre className={className} />
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-1/2 z-40 mt-1.5 w-max max-w-56 -translate-x-1/2 rounded-lg bg-tinta px-2.5 py-1.5 text-left text-xs leading-snug font-medium tracking-normal text-papel opacity-0 shadow-[0_4px_16px_-4px_rgb(0_0_0/0.3)] transition-opacity duration-150 group-hover/selo:visible group-hover/selo:opacity-100 group-focus-visible/selo:visible group-focus-visible/selo:opacity-100"
      >
        Poeta consagrado · domínio público
        {vida && <span className="block font-normal tabular-nums opacity-80">{vida}</span>}
      </span>
    </span>
  );
}
