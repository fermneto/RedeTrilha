"use client";
// Uma lista paginada por cursor que recomeça da primeira página (`recarregar`,
// que devolve a página, para quem quer olhar o que chegou) e cresce com
// "carregar mais" (nada sem próxima página). As falhas vão para quem chamou.

import { useCallback, useState } from "react";

export type ListaPorCursor<T> = { itens: T[]; cursor: string | null };
type Pagina<T> = { items: T[]; proximo_cursor: string | null };

export function useListaPorCursor<T>(buscar: (cursor: string | null) => Promise<Pagina<T>>) {
  const [lista, setLista] = useState<ListaPorCursor<T> | null>(null);

  const recarregar = useCallback(async () => {
    const p = await buscar(null);
    setLista({ itens: p.items, cursor: p.proximo_cursor });
    return p;
  }, [buscar]);

  async function carregarMais() {
    if (!lista?.cursor) return;
    const p = await buscar(lista.cursor);
    setLista({ itens: [...lista.itens, ...p.items], cursor: p.proximo_cursor });
  }

  return { lista, recarregar, carregarMais };
}
