"use client";
// O Acervo virou uma aba do Explorar (/explorar?aba=acervo, decisão 17). A rota fica
// para os links antigos e redireciona para lá, levando os filtros e a página.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { caminhoDoAcervo, lerFiltrosDoAcervo } from "@/lib/api";

// useSearchParams precisa de Suspense no build estático do Next.
export default function AcervoPage() {
  return (
    <Suspense>
      <IrAoAcervoDoExplorar />
    </Suspense>
  );
}

function IrAoAcervoDoExplorar() {
  const router = useRouter();
  const busca = useSearchParams();
  const { filtros, pagina } = lerFiltrosDoAcervo(busca);
  const destino = caminhoDoAcervo(filtros, pagina);

  useEffect(() => {
    router.replace(destino);
  }, [router, destino]);

  return <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>;
}
