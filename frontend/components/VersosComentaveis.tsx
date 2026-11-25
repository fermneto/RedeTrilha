"use client";
// Corpo do poema na página dele, verso a verso (#71). O leitor seleciona o texto
// como em qualquer página (arrastando com o mouse ou segurando no toque) e a
// seleção vira os versos inteiros que ela toca, com a barra "comentar estes
// versos / citar estes versos". Pelo teclado, o número de cada verso é um botão
// que faz a mesma seleção. Os versos com críticas ganham uma marca com quantas
// são, que filtra os comentários por aquele verso. As linhas em branco entre
// estrofes contam na numeração, como no backend, mas não se selecionam sozinhas.
// A numeração e a seleção usam o texto sem as marcas de formatação (mesmo número
// de linhas); o verso aparece formatado, e "citar estes versos" leva as marcas.

import Link from "next/link";
import { useEffect, useRef } from "react";

import { IconeComentar } from "@/components/icones/IconeComentar";
import { VersoFormatado } from "@/components/TextoFormatado";
import {
  caminhoDaCitacaoDeVersos,
  referenciaDosVersos,
  selecionarVerso,
  trechoDosVersos,
  versosDaSelecao,
  versosDoPoema,
  type Post,
  type SelecaoDeVersos,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

type Props = {
  poema: Post;
  // verso -> quantas críticas o cobrem.
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
  const visiveis = versosDoPoema(textoSemMarcas(poema.texto));
  const lista = useRef<HTMLOListElement>(null);
  // O poema e a barra: um clique aqui dentro não desfaz a seleção feita pelos números.
  const corpo = useRef<HTMLDivElement>(null);
  // De onde veio a seleção de versos. "texto": da seleção do navegador, e some
  // com ela (clique fora), como seleção de texto comum. "numero": dos botões de
  // número (teclado): some com clique fora do poema e da barra. Esc desfaz as
  // duas. "fixa": o leitor
  // clicou em "comentar estes versos"; o foco vai para o campo de comentário e a
  // seleção fica até ele comentar, "limpar" ou selecionar outros versos.
  const origem = useRef<"texto" | "numero" | "fixa">("texto");

  useEffect(() => {
    function aoMudarSelecao() {
      const selecaoDeTexto = document.getSelection();
      if (!selecaoDeTexto || !lista.current) return;
      const tocados = selecaoDeTexto.isCollapsed
        ? []
        : Array.from(lista.current.querySelectorAll<HTMLLIElement>("li[data-verso]"))
            .filter((li) => selecaoDeTexto.containsNode(li, true))
            .map((li) => Number(li.dataset.verso));
      const nova = versosDaSelecao(textoSemMarcas(poema.texto), tocados);
      if (nova) {
        origem.current = "texto";
        if (nova.inicio !== selecao?.inicio || nova.fim !== selecao?.fim) aoSelecionar(nova);
      } else if (selecao && origem.current === "texto") {
        aoSelecionar(null);
      }
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, [poema.texto, selecao, aoSelecionar]);

  useEffect(() => {
    if (!selecao) return;
    function aoClicar(e: MouseEvent) {
      if (origem.current === "numero" && !corpo.current?.contains(e.target as Node)) aoSelecionar(null);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape" || origem.current === "fixa") return;
      document.getSelection()?.removeAllRanges();
      aoSelecionar(null);
    }
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [selecao, aoSelecionar]);

  const selecionado = (n: number) => selecao !== null && selecao.inicio <= n && n <= selecao.fim;
  const acao =
    "inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-destaque hover:bg-destaque/10";

  return (
    <div ref={corpo} className={poema.titulo ? "mt-2" : "mt-1"}>
      <p className="sr-only">
        Para comentar ou citar versos, selecione o texto deles, ou ative o número do primeiro verso e
        depois o do último.
      </p>
      <ol ref={lista} className="poema-corpo">
        {versos.map((linha, i) => {
          const n = i + 1;
          const vazia = visiveis[i].trim() === "";
          const marca = vazia ? 0 : (marcas.get(n) ?? 0);
          return (
            <li
              key={n}
              data-verso={n}
              className={`flex items-baseline gap-1 rounded ${selecionado(n) ? "bg-destaque/10" : ""}`}
            >
              <span className="w-8 shrink-0 text-right select-none">
                {!vazia && (
                  <button
                    type="button"
                    // Sem mexer na seleção do navegador ao apertar; o clique a descarta.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      origem.current = "numero";
                      document.getSelection()?.removeAllRanges();
                      aoSelecionar(selecionarVerso(selecao, n));
                    }}
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
              <span className="min-h-[1lh] min-w-0 flex-1">
                <VersoFormatado linha={linha} />
              </span>
              {marca > 0 && (
                <button
                  type="button"
                  onClick={() => aoFiltrar(n)}
                  aria-label={`ver ${marca === 1 ? "o comentário" : `os ${marca} comentários`} sobre o verso ${n}`}
                  title={`comentários sobre o verso ${n}`}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-full select-none px-1.5 font-sans text-xs text-tinta-suave tabular-nums hover:bg-destaque/10 hover:text-destaque"
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
        // O mousedown na barra não pode desfazer a seleção do navegador (e, com
        // ela, a dos versos) antes do clique chegar ao botão.
        <div
          role="group"
          aria-label="versos selecionados"
          onMouseDown={(e) => e.preventDefault()}
          className="mt-2 flex flex-wrap items-center gap-x-1 rounded-xl border border-borda bg-papel-alto px-2 py-1"
        >
          <span className="px-1 text-sm text-tinta-suave">{referenciaDosVersos(selecao)}</span>
          <button
            type="button"
            onClick={() => {
              origem.current = "fixa";
              aoComentar();
            }}
            className={acao}
          >
            comentar estes versos
          </button>
          <Link href={caminhoDaCitacaoDeVersos(poema.id, trechoDosVersos(poema.texto, selecao))} className={acao}>
            citar estes versos
          </Link>
          <button
            type="button"
            onClick={() => {
              document.getSelection()?.removeAllRanges();
              aoSelecionar(null);
            }}
            className={`${acao} text-tinta-suave`}
          >
            limpar
          </button>
        </div>
      )}
    </div>
  );
}
