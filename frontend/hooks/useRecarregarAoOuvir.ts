"use client";
// Carrega ao abrir e recarrega a cada evento do stream que `ouvir` aceita. Vários
// eventos juntos (uma mensagem e a leitura dela) viram uma busca só. Sem token,
// não faz nada: a página já mandou para o login. `ouvir` deve ser estável (fora
// do componente), para não refazer a conexão a cada render.

import { useEffect } from "react";

import { ouvirMensagens, temToken, type EventoDeMensagem } from "@/lib/api";

const ESPERA_MS = 250;

export function useRecarregarAoOuvir(recarregar: () => void, ouvir: (evento: EventoDeMensagem) => boolean): void {
  useEffect(() => {
    if (!temToken()) return;
    recarregar();
    let espera: ReturnType<typeof setTimeout> | null = null;
    const cancelar = ouvirMensagens((evento) => {
      if (!ouvir(evento)) return;
      if (espera) clearTimeout(espera);
      espera = setTimeout(recarregar, ESPERA_MS);
    });
    return () => {
      cancelar();
      if (espera) clearTimeout(espera);
    };
  }, [recarregar, ouvir]);
}
