"use client";
// O link "Perfil" do Nav aponta para cá: descobre o meu username em /auth/eu e
// redireciona para /u/{username}.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buscarEu, caminhoDoLogin, mensagemDeFalha, temToken } from "@/lib/api";

export default function MeuPerfilPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    buscarEu()
      .then((eu) => router.replace(`/u/${eu.username}`))
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para abrir o perfil")));
  }, [router]);

  if (erro) return <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>;
  return <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>;
}
