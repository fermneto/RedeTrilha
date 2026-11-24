"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Compositor } from "@/components/Compositor";
import { caminhoDoLogin, temToken } from "@/lib/api";

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
  const params = useSearchParams();
  const citarId = idDoParametro(params.get("citar"));
  // /escrever?rascunho=3 abre o rascunho no compositor (vindo da página Rascunhos).
  const rascunhoId = citarId === null ? idDoParametro(params.get("rascunho")) : null;
  // Rascunho de citação: o compositor avisa ao carregar, e o título vira "Citar poema".
  const [rascunhoDeCitacao, setRascunhoDeCitacao] = useState(false);

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  return (
    <div>
      <CabecalhoPagina titulo={citarId === null && !rascunhoDeCitacao ? "Escrever" : "Citar poema"} />
      <div className="px-4 py-5">
        <Compositor
          key={citarId ?? (rascunhoId !== null ? `rascunho-${rascunhoId}` : "novo")}
          citarId={citarId}
          rascunhoId={rascunhoId}
          aoAbrirCitacao={() => setRascunhoDeCitacao(true)}
        />
      </div>
    </div>
  );
}

function idDoParametro(valor: string | null): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
