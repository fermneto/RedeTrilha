"use client";
// Nova antologia, pelo seletor de formato do "Escrever" (FormatoDeEscrita): nome,
// descrição e o switch Pública/Privada, e daí para a antologia recém-criada.
// Cancelar volta para onde a pessoa estava (ou para o início, se abriu direto).

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AntologiaFormulario } from "@/components/AntologiaFormulario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { FormatoDeEscrita } from "@/components/FormatoDeEscrita";
import { caminhoDoLogin, criarAntologia, temToken } from "@/lib/api";

export default function NovaAntologiaPage() {
  const router = useRouter();

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  return (
    <div>
      <CabecalhoPagina titulo="Escrever" voltar />
      <FormatoDeEscrita atual="antologia" />
      <div className="px-4 py-5">
        <p className="mb-5 text-sm text-tinta-suave">
          Reúna os poemas que você ama, como &ldquo;Poemas de chuva&rdquo; ou &ldquo;Para ler no ônibus&rdquo;. Depois,
          o &ldquo;adicionar à antologia&rdquo; de cada poema a enche.
        </p>
        <AntologiaFormulario
          textoDoBotao="Criar antologia"
          aoEnviar={async (dados) => {
            const nova = await criarAntologia(dados);
            router.push(`/antologias/${nova.id}`);
          }}
          aoCancelar={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        />
      </div>
    </div>
  );
}
