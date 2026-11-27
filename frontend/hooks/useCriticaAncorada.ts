"use client";
// A crítica ancorada (#71) de um poema ou de uma renga, do lado da página: os
// versos selecionados, as marcas por verso, o filtro pela marca e os versos
// pedidos por ?versos=2-4 (de "comentar estes versos" num card). `texto` é o
// texto comentado, ou null enquanto ele não chegou.
// Chame na página, acima do caderno: os efeitos daqui rodam depois dos dos
// versos (VersosComentaveis), que aplicam o pedido antes de ele se apagar.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buscarVersosComentados,
  lerVersosDaUrl,
  type AlvoDosComentarios,
  type SelecaoDeVersos,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

export type CriticaAncorada = {
  selecao: SelecaoDeVersos | null;
  setSelecao: (s: SelecaoDeVersos | null) => void;
  marcas: Map<number, number>;
  // Também chamado depois de comentar ou apagar.
  carregarMarcas: () => Promise<void>;
  verso: number | null;
  setVerso: (verso: number | null) => void;
  pedida: SelecaoDeVersos | null;
};

export function useCriticaAncorada(alvo: AlvoDosComentarios, texto: string | null): CriticaAncorada {
  const { tipo, id } = alvo;
  const [selecao, setSelecao] = useState<SelecaoDeVersos | null>(null);
  const [marcas, setMarcas] = useState<Map<number, number>>(new Map());
  const [verso, setVerso] = useState<number | null>(null);
  // Lido uma vez, quando o texto chega, e passado uma vez aos versos.
  const [pedida, setPedida] = useState<SelecaoDeVersos | null>(null);
  const leuAUrl = useRef(false);

  // Sem as marcas, o texto continua legível: só não mostra os números.
  const carregarMarcas = useCallback(
    () =>
      buscarVersosComentados({ tipo, id })
        .then(({ items }) => setMarcas(new Map(items.map((m) => [m.verso, m.comentarios]))))
        .catch(() => setMarcas(new Map())),
    [tipo, id],
  );

  useEffect(() => {
    if (texto === null || leuAUrl.current) return;
    leuAUrl.current = true;
    const versos = new URLSearchParams(window.location.search).get("versos");
    setPedida(lerVersosDaUrl(versos, textoSemMarcas(texto)));
  }, [texto]);

  // Os versos aplicam o pedido no mesmo commit (o efeito do filho roda antes);
  // depois ele se apaga, para não voltar quando o original reaparece após a tradução.
  useEffect(() => {
    if (pedida) setPedida(null);
  }, [pedida]);

  return { selecao, setSelecao, marcas, carregarMarcas, verso, setVerso, pedida };
}
