"use client";
// Corpo do poema na página dele, verso a verso (#71): o número de cada verso é um
// botão que seleciona o trecho a comentar ou citar, e os versos com críticas
// ganham uma marca com quantas são, que filtra os comentários por aquele verso.
// As linhas em branco entre estrofes contam na numeração, como no backend, mas
// não têm botão: um trecho só de linhas em branco não se comenta.

import Link from "next/link";

import { IconeComentar } from "@/components/icones/IconeComentar";
import {
  caminhoDaCitacaoDeVersos,
  referenciaDosVersos,
  selecionarVerso,
  trechoDosVersos,
  versosDoPoema,
  type Post,
  type SelecaoDeVersos,
} from "@/lib/api";

type Props = {
  poema: Post;
  // verso -> quantas críticas atuais o cobrem.
  marcas: Map<number, number>;
  selecao: SelecaoDeVersos | null;
  aoSelecionar: (selecao: SelecaoDeVersos | null) => void;
  // "comentar estes versos": a página leva ao formulário de comentário.
  aoComentar: () => void;
  // Clique na marca: só os comentários daquele verso.
  aoFiltrar: (verso: number) => void;
};

export function VersosComentaveis({ poema, marcas, selecao, aoSelecionar, aoComentar, aoFiltrar }: Props) {
  const versos = versosDoPoema(poema.texto);
  const selecionado = (n: number) => selecao !== null && selecao.inicio <= n && n <= selecao.fim;
  const acao =
    "inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-destaque hover:bg-destaque/10";

  return (
    <div className={poema.titulo ? "mt-2" : "mt-1"}>
      <p className="sr-only">
        Toque no número de um verso para selecioná-lo; depois, no de outro verso para estender o trecho.
      </p>
      <ol className="poema-corpo">
        {versos.map((linha, i) => {
          const n = i + 1;
          const vazia = linha.trim() === "";
          const marca = vazia ? 0 : (marcas.get(n) ?? 0);
          return (
            <li
              key={n}
              className={`flex items-baseline gap-1 rounded ${selecionado(n) ? "bg-destaque/10" : ""}`}
            >
              <span className="w-8 shrink-0 text-right">
                {!vazia && (
                  <button
                    type="button"
                    onClick={() => aoSelecionar(selecionarVerso(selecao, n))}
                    aria-pressed={selecionado(n)}
                    aria-label={`verso ${n}`}
                    className={`min-w-8 cursor-pointer rounded px-1 font-sans text-xs tabular-nums hover:text-destaque ${
                      selecionado(n) ? "font-semibold text-destaque" : "text-tinta-suave/60"
                    }`}
                  >
                    {n}
                  </button>
                )}
              </span>
              <span className="min-h-[1lh] min-w-0 flex-1">{linha}</span>
              {marca > 0 && (
                <button
                  type="button"
                  onClick={() => aoFiltrar(n)}
                  aria-label={`ver ${marca === 1 ? "o comentário" : `os ${marca} comentários`} sobre o verso ${n}`}
                  title={`comentários sobre o verso ${n}`}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-full px-1.5 font-sans text-xs text-tinta-suave tabular-nums hover:bg-destaque/10 hover:text-destaque"
                >
                  <IconeComentar className="h-3.5 w-3.5" />
                  {marca}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {selecao && (
        <div
          role="group"
          aria-label="versos selecionados"
          className="mt-2 flex flex-wrap items-center gap-x-1 rounded-xl border border-borda bg-papel-alto px-2 py-1"
        >
          <span className="px-1 text-sm text-tinta-suave">{referenciaDosVersos(selecao)}</span>
          <button type="button" onClick={aoComentar} className={acao}>
            comentar estes versos
          </button>
          <Link href={caminhoDaCitacaoDeVersos(poema.id, trechoDosVersos(poema.texto, selecao))} className={acao}>
            citar estes versos
          </Link>
          <button type="button" onClick={() => aoSelecionar(null)} className={`${acao} text-tinta-suave`}>
            limpar
          </button>
        </div>
      )}
    </div>
  );
}
