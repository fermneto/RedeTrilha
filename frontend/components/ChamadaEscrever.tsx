"use client";
// Topo do feed e dos Rascunhos: o convite compacto para escrever. Leva ao compositor completo em
// /escrever, que tem título, forma e a regra do Tab.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { buscarEu, type User } from "@/lib/api";

export function ChamadaEscrever() {
  const [eu, setEu] = useState<User | null>(null);

  useEffect(() => {
    buscarEu()
      .then(setEu)
      .catch(() => setEu(null));
  }, []);

  return (
    <div className="flex items-center gap-3 border-b border-borda px-4 py-3">
      {eu ? <Avatar usuario={eu} /> : <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-full bg-borda" />}
      <Link
        href="/escrever"
        className="flex min-h-11 flex-1 items-center rounded-lg font-serifada text-lg text-tinta-suave italic transition-colors duration-150 hover:text-tinta"
      >
        O que você está escrevendo?
      </Link>
      <Link
        href="/escrever"
        tabIndex={-1}
        aria-hidden="true"
        className="flex h-9 items-center rounded-full bg-destaque px-4 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110"
      >
        Escrever
      </Link>
    </div>
  );
}
