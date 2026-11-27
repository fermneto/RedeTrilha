"use client";
// Um botão que chama o backend (apagar, tirar, salvar): `ocupado` desde o clique,
// e na falha volta a valer, com o erro (o `detail` do backend ou `falha`). No
// sucesso continua ocupado: quem chamou sai da tela ou some com o item.

import { useState } from "react";

import { mensagemDeFalha } from "@/lib/api";

export function useAcaoAssincrona(falha: string) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeFalha(e, falha));
      setOcupado(false);
    }
  }

  return { ocupado, erro, executar };
}
