"use client";
// O esqueleto do carregamento fica na tela pelo menos `ms` (500 ms): com a API
// rápida, ele só piscaria. Devolve true enquanto carrega e até completar `ms`
// desde que o carregamento começou; o conteúdo entra depois, com o fade de
// .surgir (globals.css). Se o dado já estava pronto na montagem, não atrasa nada.
// Só a tela espera: a busca segue no tempo dela.

import { useEffect, useRef, useState } from "react";

const ESPERA_MINIMA_MS = 500;

export function useEsperaMinima(carregando: boolean, ms = ESPERA_MINIMA_MS): boolean {
  const [segurando, setSegurando] = useState(carregando);
  // Quando o carregamento atual começou; null fora de um carregamento.
  const inicio = useRef<number | null>(carregando ? Date.now() : null);

  useEffect(() => {
    if (carregando) {
      inicio.current ??= Date.now();
      setSegurando(true);
      return;
    }
    const comeco = inicio.current;
    inicio.current = null;
    const falta = comeco === null ? 0 : ms - (Date.now() - comeco);
    if (falta <= 0) {
      setSegurando(false);
      return;
    }
    const espera = setTimeout(() => setSegurando(false), falta);
    return () => clearTimeout(espera);
  }, [carregando, ms]);

  return carregando || segurando;
}

// Nas listas que crescem (rolagem infinita, "ver mais"), os itens que já estão
// na tela continuam nela enquanto o esqueleto do pé espera; os novos entram
// quando ele libera. Se a lista recomeça do zero (uma busca nova), nada fica.
export function useItensLiberados<T>(itens: T[], esperando: boolean, chave: (item: T) => string | number): T[] {
  const [liberados, setLiberados] = useState<Set<string | number>>(() => new Set());

  useEffect(() => {
    if (!esperando || itens.length === 0) setLiberados(new Set(itens.map(chave)));
    // Sem a `chave` nas dependências: ela é uma função pura do item, e quem chama
    // passa uma nova a cada render.
  }, [itens, esperando]);

  return esperando ? itens.filter((item) => liberados.has(chave(item))) : itens;
}
