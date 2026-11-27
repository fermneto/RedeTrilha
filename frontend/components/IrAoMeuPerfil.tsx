"use client";
// Leva ao meu perfil (/u/{username}), opcionalmente numa aba: descobre o meu
// username em /auth/eu e troca a URL sem deixar a rota antiga no histórico.
// Usado por /perfil e pelas rotas que viraram abas do perfil (/rascunhos e
// /antologias), para os links antigos e os favoritos continuarem funcionando.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvisoDeErro } from "@/components/AvisoDeErro";
import { buscarEu, caminhoDoLogin, mensagemDeFalha, temToken } from "@/lib/api";

export function IrAoMeuPerfil({ aba }: { aba?: "rascunhos" | "antologias" }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    buscarEu()
      .then((eu) => router.replace(`/u/${encodeURIComponent(eu.username)}${aba ? `?aba=${aba}` : ""}`))
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para abrir o perfil")));
  }, [router, aba]);

  if (erro) return <AvisoDeErro className="m-4">{erro}</AvisoDeErro>;
  return <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>;
}
