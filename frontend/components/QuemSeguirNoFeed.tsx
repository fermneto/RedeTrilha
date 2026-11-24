"use client";
// Bloco "Quem seguir" no meio do "Para você", como no X. É só do front: não é um
// item do feed, então não mexe no cursor nem no contrato do FeedPage. O bloco de
// número `indice` (0, 1, 2...) mostra as sugestões seguintes às do bloco anterior;
// sem sugestões (ou se a rota falha), some.

import Link from "next/link";
import { useEffect, useState } from "react";

import { LinhaPoeta } from "@/components/ColunaDireita";
import { buscarSugestoes, type Sugestao } from "@/lib/api";

// PROVISÓRIO: quantos perfis em cada bloco.
export const PERFIS_NO_BLOCO = 3;

export function QuemSeguirNoFeed({ indice }: { indice: number }) {
  const [contas, setContas] = useState<Sugestao[]>([]);

  useEffect(() => {
    let vivo = true;
    buscarSugestoes(indice * PERFIS_NO_BLOCO, PERFIS_NO_BLOCO)
      .then((p) => vivo && setContas(p.items))
      .catch(() => vivo && setContas([]));
    return () => {
      vivo = false;
    };
  }, [indice]);

  if (contas.length === 0) return null;
  return (
    <section aria-label="Quem seguir" className="py-2">
      <h2 className="px-4 pt-2 pb-1 text-xl">Quem seguir</h2>
      <ul>
        {contas.map((conta) => (
          <li key={conta.id}>
            <LinhaPoeta poeta={conta} />
          </li>
        ))}
      </ul>
      <Link
        href="/sugestoes"
        className="realce flex min-h-11 items-center px-4 text-sm font-semibold text-destaque"
      >
        ver mais
      </Link>
    </section>
  );
}
