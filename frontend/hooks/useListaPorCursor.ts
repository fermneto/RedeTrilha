"use client";
// Uma lista paginada por cursor que recomeça da primeira página (`recarregar`,
// que devolve a página, para quem quer olhar o que chegou) e cresce com
// "carregar mais" (nada sem próxima página). As falhas vão para quem chamou.
//
// Depois de um "carregar mais", recarregar não joga fora o que já veio: a
// primeira página entra no topo e o resto continua embaixo, sem repetir (`chave`),
// com o mesmo cursor. Assim a recarga do stream (que vem ao conectar) não volta
// a lista para a página 1 de quem já desceu.

import { useCallback, useRef, useState } from "react";

export type ListaPorCursor<T> = { itens: T[]; cursor: string | null };
type Pagina<T> = { items: T[]; proximo_cursor: string | null };

function semRepetir<T>(primeiros: T[], depois: T[], chave: (item: T) => string | number): T[] {
  const vistos = new Set(primeiros.map(chave));
  return [...primeiros, ...depois.filter((item) => !vistos.has(chave(item)))];
}

export function useListaPorCursor<T>(
  buscar: (cursor: string | null) => Promise<Pagina<T>>,
  chave: (item: T) => string | number,
) {
  const [lista, setLista] = useState<ListaPorCursor<T> | null>(null);
  // Já carregou mais que a primeira página?
  const desceu = useRef(false);

  const recarregar = useCallback(async () => {
    const p = await buscar(null);
    setLista((atual) =>
      atual && desceu.current
        ? { itens: semRepetir(p.items, atual.itens, chave), cursor: atual.cursor }
        : { itens: p.items, cursor: p.proximo_cursor },
    );
    return p;
  }, [buscar, chave]);

  async function carregarMais() {
    if (!lista?.cursor) return;
    const p = await buscar(lista.cursor);
    desceu.current = true;
    setLista((atual) => ({ itens: semRepetir(atual?.itens ?? [], p.items, chave), cursor: p.proximo_cursor }));
  }

  return { lista, recarregar, carregarMais };
}
