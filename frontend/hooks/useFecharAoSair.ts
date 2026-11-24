"use client";
// Fecha algo aberto (popover, confirmação inline) com Esc ou com um clique fora
// da `caixa`. Só escuta enquanto `aberto`; `aoFechar` recebe o evento, para quem
// quer devolver o foco só no Esc.

import { useEffect, useRef } from "react";

export function useFecharAoSair(
  aberto: boolean,
  caixa: React.RefObject<HTMLElement | null>,
  aoFechar: (e: KeyboardEvent | PointerEvent) => void,
): void {
  // Ref: trocar a função a cada render não refaz os listeners.
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    function cliqueFora(e: PointerEvent) {
      if (!caixa.current?.contains(e.target as Node)) fechar.current(e);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") fechar.current(e);
    }
    document.addEventListener("pointerdown", cliqueFora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", cliqueFora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, caixa]);
}
