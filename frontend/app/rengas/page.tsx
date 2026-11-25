"use client";
// As rengas viraram uma aba do Explorar (/explorar?aba=rengas). A rota fica para
// os links antigos e redireciona para lá, levando o filtro e a página.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { caminhoDasRengas, lerPagina, lerSituacao } from "@/components/ListaDeRengas";

// useSearchParams precisa de Suspense no build estático do Next.
export default function RengasPage() {
  return (
    <Suspense>
      <IrAsRengasDoExplorar />
    </Suspense>
  );
}

function IrAsRengasDoExplorar() {
  const router = useRouter();
  const busca = useSearchParams();
  const destino = caminhoDasRengas(lerSituacao(busca.get("situacao")), lerPagina(busca.get("pagina")));

  useEffect(() => {
    router.replace(destino);
  }, [router, destino]);

  return <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>;
}
