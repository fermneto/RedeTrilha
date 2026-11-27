"use client";
// Último passo do onboarding, em tela cheia: a grade de quem seguir. "pular" (ou
// "continuar", depois de seguir alguém) leva ao Início, que abre no "Para você".
// "voltar" reabre a região; "Ajustar o que você gosta" abre só os gostos e volta
// para cá ao salvar.

import Link from "next/link";
import { useState } from "react";

import { GradeDeSugestoes } from "@/components/GradeDeSugestoes";
import { AberturaDoPasso, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, TelaDeBoasVindas } from "@/components/TelaDeBoasVindas";
import { caminhoDosGostos, QUEM_SEGUIR_NO_ONBOARDING } from "@/lib/api";
import { noPlural } from "@/lib/numeros";

// Os dois passos de /boas-vindas mais este.
const PASSOS_DO_ONBOARDING = 3;
// "voltar" reabre /boas-vindas na região, com o que já foi salvo marcado.
const VOLTAR_PARA_A_REGIAO = "/boas-vindas?passo=regiao";

export default function QuemSeguirNoOnboardingPage() {
  const [seguidas, setSeguidas] = useState(0);

  return (
    <TelaDeBoasVindas
      passo={PASSOS_DO_ONBOARDING}
      total={PASSOS_DO_ONBOARDING}
      largura="larga"
      acoes={
        <>
          <Link href={VOLTAR_PARA_A_REGIAO} className={`${BOTAO_SECUNDARIO} -ml-4`}>
            voltar
          </Link>
          <div className="flex items-center gap-3">
            <p
              aria-live="polite"
              className={`text-sm text-tinta-suave tabular-nums ${seguidas > 0 ? "" : "hidden sm:block"}`}
            >
              {seguidas > 0 ? `você segue ${seguidas} ${noPlural(seguidas, "poeta", "poetas")}` : "siga quantos quiser"}
            </p>
            <Link href="/" className={seguidas > 0 ? BOTAO_PRIMARIO : `${BOTAO_SECUNDARIO} -mr-4`}>
              {seguidas > 0 ? "continuar" : "pular"}
            </Link>
          </div>
        </>
      }
    >
      <title>Quem seguir · Verso</title>
      <AberturaDoPasso titulo="Quem seguir">
        Siga poetas para ver os poemas deles na aba Seguindo.{" "}
        <Link href={caminhoDosGostos(QUEM_SEGUIR_NO_ONBOARDING)} className="text-tinta underline">
          Ajustar o que você gosta
        </Link>
      </AberturaDoPasso>
      <GradeDeSugestoes
        colunas="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aoSeguir={(novo) => setSeguidas((n) => n + (novo ? 1 : -1))}
      />
    </TelaDeBoasVindas>
  );
}
