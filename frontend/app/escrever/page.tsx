"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Compositor } from "@/components/Compositor";
import { temToken } from "@/lib/api";

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
  const citar = Number(useSearchParams().get("citar"));
  const citarId = Number.isInteger(citar) && citar > 0 ? citar : null;

  useEffect(() => {
    if (!temToken()) router.replace("/login");
  }, [router]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">{citarId === null ? "Escrever" : "Citar poema"}</h1>
      <Compositor key={citarId ?? "novo"} citarId={citarId} />
    </div>
  );
}
