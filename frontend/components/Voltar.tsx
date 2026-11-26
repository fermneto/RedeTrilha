"use client";
// O "voltar" das páginas de publicação (poema, renga, antologia), no canto do
// título da página. Com uma página do Verso antes, volta no histórico: do feed,
// o Início reabre na mesma aba e na mesma folha (lib/sessaoDoFeed.ts). Quem
// chegou por um link direto vai para o Início (lib/historico.ts).

import { useRouter } from "next/navigation";

import { IconeSeta } from "@/components/icones/IconeSeta";
import { temRotaAnterior } from "@/lib/historico";

export function Voltar() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (temRotaAnterior() ? router.back() : router.push("/"))}
      aria-label="voltar"
      title="voltar"
      className="-ml-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-tinta-suave transition-colors duration-150 hover:bg-tinta/7 hover:text-tinta"
    >
      <IconeSeta className="h-5 w-5 rotate-180" />
    </button>
  );
}
