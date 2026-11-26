"use client";
// As páginas de uma lista paginada por cursor (o feed), sem rolagem: quem usa
// pede a próxima com `carregarMais` (o caderno pede quando a folha à vista chega
// perto do fim do que já veio). Mesma regra da ListaDePoemas: um pedido por vez,
// sem repetir poema nem renga (`juntarAoFeed`: um repost conta como o original e
// soma quem repostou no rótulo da primeira ocorrência), e o erro para os pedidos
// até "tentar de novo".

import { useCallback, useEffect, useRef, useState } from "react";

import { juntarAoFeed, mensagemDeFalha, type FeedPage, type ItemDoFeed } from "@/lib/api";

export function useFeedPorCursor(buscar: (cursor: string | null) => Promise<FeedPage>) {
  const [itens, setItens] = useState<ItemDoFeed[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ref e não estado: evita dois pedidos da mesma página antes do re-render.
  const pedindo = useRef(false);

  const carregarMais = useCallback(async () => {
    if (pedindo.current || fim || erro) return;
    pedindo.current = true;
    try {
      const pagina = await buscar(cursor);
      setItens((atuais) => juntarAoFeed(atuais, pagina.items));
      setCursor(pagina.proximo_cursor);
      setFim(pagina.proximo_cursor === null);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar os poemas"));
    } finally {
      pedindo.current = false;
    }
  }, [buscar, cursor, fim, erro]);

  useEffect(() => {
    if (itens.length === 0 && !fim) carregarMais();
  }, [itens.length, fim, carregarMais]);

  return { itens, fim, erro, carregarMais, tentarDeNovo: () => setErro(null) };
}
