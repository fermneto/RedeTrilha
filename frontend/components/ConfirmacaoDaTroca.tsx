"use client";
// Trocar o poema começado pela antologia: a mesma confirmação ali mesmo do
// ConfirmacaoInline, com três saídas em vez de "sim / não": "Descartar o poema?",
// e "salvar como rascunho", "descartar" e "continuar escrevendo". O foco abre em
// "continuar escrevendo" (Enter sem querer não perde nada); Esc ou clique fora
// também continuam escrevendo e devolvem o foco a quem abriu a pergunta.

import { useEffect, useRef } from "react";

import { useAcaoAssincrona } from "@/hooks/useAcaoAssincrona";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";

type Props = {
  aoSalvar: () => Promise<void>;
  aoDescartar: () => void;
  aoContinuar: (comTeclado: boolean) => void;
};

export function ConfirmacaoDaTroca({ aoSalvar, aoDescartar, aoContinuar }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const continuar = useRef<HTMLButtonElement>(null);
  const { ocupado: salvando, erro, executar } = useAcaoAssincrona("não deu para salvar o rascunho");

  useEffect(() => {
    continuar.current?.focus();
  }, []);

  useFecharAoSair(!salvando, caixa, (e) => aoContinuar(e.type === "keydown"));

  const salvar = () => executar(aoSalvar);

  const acao = "min-h-11 cursor-pointer disabled:cursor-default disabled:opacity-50";
  return (
    <div ref={caixa} role="group" aria-label="Descartar o poema?" className="mt-2 text-sm text-tinta-suave">
      {/* No celular, a pergunta numa linha e as três saídas embaixo; do sm em diante,
          tudo numa linha. */}
      <div className="flex flex-wrap items-center gap-x-4">
        <p className="w-full pt-1 text-tinta sm:w-auto sm:pt-0">Descartar o poema?</p>
        <button type="button" onClick={salvar} disabled={salvando} className={`${acao} text-destaque hover:underline`}>
          {salvando ? "salvando..." : "salvar como rascunho"}
        </button>
        <button type="button" onClick={aoDescartar} disabled={salvando} className={`${acao} hover:text-tinta`}>
          descartar
        </button>
        <button
          ref={continuar}
          type="button"
          onClick={() => aoContinuar(true)}
          disabled={salvando}
          className={`${acao} font-semibold text-tinta hover:underline`}
        >
          continuar escrevendo
        </button>
      </div>
      {erro && (
        <p role="alert" className="text-destaque">
          {erro}
        </p>
      )}
    </div>
  );
}
