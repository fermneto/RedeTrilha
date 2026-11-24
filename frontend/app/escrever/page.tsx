"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Compositor } from "@/components/Compositor";
import { caminhoDoLogin, temToken, textoDaCitacaoDeVersos } from "@/lib/api";

// useSearchParams precisa de Suspense no build estático do Next.
export default function EscreverPage() {
  return (
    <Suspense>
      <Escrever />
    </Suspense>
  );
}

function Escrever() {
  const router = useRouter();
  const busca = useSearchParams();
  const citar = Number(busca.get("citar"));
  const citarId = Number.isInteger(citar) && citar > 0 ? citar : null;
  // "citar estes versos", na página do poema: os versos vêm no parâmetro `versos`.
  const versos = citarId === null ? null : busca.get("versos");

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  return (
    <div>
      <CabecalhoPagina titulo={citarId === null ? "Escrever" : "Citar poema"} />
      <div className="px-4 py-5">
        <Compositor
          key={citarId ?? "novo"}
          citarId={citarId}
          textoInicial={versos ? textoDaCitacaoDeVersos(versos) : undefined}
        />
      </div>
    </div>
  );
}
