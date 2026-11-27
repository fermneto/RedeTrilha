"use client";
// As páginas que pedem login: sem token, vão ao login (e voltam depois).
// `useSessaoObrigatoria` também devolve quem está logado (null até chegar ou se
// a busca falhar). Quem busca mais coisas no próprio efeito usa `exigirLogin`.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buscarEu, exigirLogin, type User } from "@/lib/api";

export function useLoginObrigatorio(): void {
  const router = useRouter();
  useEffect(() => {
    exigirLogin(router);
  }, [router]);
}

export function useSessaoObrigatoria(): User | null {
  const router = useRouter();
  const [eu, setEu] = useState<User | null>(null);
  useEffect(() => {
    if (!exigirLogin(router)) return;
    buscarEu()
      .then(setEu)
      .catch(() => setEu(null));
  }, [router]);
  return eu;
}
