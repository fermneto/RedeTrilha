"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Compositor } from "@/components/Compositor";
import { FormatoDeEscrita } from "@/components/FormatoDeEscrita";
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
  const params = useSearchParams();
  const citarId = idDoParametro(params.get("citar"));
  // "citar estes versos", na página do poema: os versos vêm no parâmetro `versos`.
  const versos = citarId === null ? null : params.get("versos");
  // /escrever?rascunho=3 abre o rascunho no compositor (vindo da aba Rascunhos do perfil).
  const rascunhoId = citarId === null ? idDoParametro(params.get("rascunho")) : null;
  // Rascunho de citação: o compositor avisa ao carregar, e o título vira "Citar poema".
  const [rascunhoDeCitacao, setRascunhoDeCitacao] = useState(false);

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  // O seletor Poema · Renga · Antologia só num poema novo: citação e rascunho já
  // têm formato.
  const poemaNovo = citarId === null && rascunhoId === null;

  return (
    <div>
      <CabecalhoPagina titulo={citarId === null && !rascunhoDeCitacao ? "Escrever" : "Citar poema"} />
      {poemaNovo && <FormatoDeEscrita atual="poema" />}
      <div className="px-4 py-5">
        <Compositor
          key={citarId ?? (rascunhoId !== null ? `rascunho-${rascunhoId}` : "novo")}
          citarId={citarId}
          textoInicial={versos ? textoDaCitacaoDeVersos(versos) : undefined}
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
