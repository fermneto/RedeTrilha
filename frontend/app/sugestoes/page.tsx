"use client";
// Quem seguir fora do onboarding: a tela do "ver mais" no Descobrir, no Seguindo
// vazio e no bloco do "Para você", dentro do layout do site. O último passo do
// onboarding é a mesma grade em tela cheia (/boas-vindas/quem-seguir), com a mesma
// busca por nome ou @username (components/GradeDeSugestoes.tsx). "pular" (ou
// "continuar", depois de seguir alguém) leva ao Início, que abre no "Para você".

import Link from "next/link";
import { useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { GradeDeSugestoes } from "@/components/GradeDeSugestoes";
import { caminhoDosGostos } from "@/lib/api";

export default function SugestoesPage() {
  const [seguidas, setSeguidas] = useState(0);

  return (
    <div>
      <title>Quem seguir · Verso</title>
      <CabecalhoPagina titulo="Quem seguir" voltar />
      <div className="linha-da-folha flex flex-wrap items-center justify-between gap-3 border-b border-borda py-3">
        <p className="text-sm text-tinta-suave">
          Siga poetas para ver os poemas deles na aba Seguindo.{" "}
          <Link href={caminhoDosGostos("/sugestoes")} className="underline">
            Ajustar o que você gosta
          </Link>
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-borda px-4 text-sm font-bold hover:border-destaque hover:text-destaque"
        >
          {seguidas > 0 ? "continuar" : "pular"}
        </Link>
      </div>
      <div className="p-4">
        <GradeDeSugestoes colunas="grid-cols-1 sm:grid-cols-2" aoSeguir={(novo) => setSeguidas((n) => n + (novo ? 1 : -1))} />
      </div>
    </div>
  );
}
