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
// Selecionar versos num card fora daqui (feed, perfil...) traz para esta página
// com ?versos=2-4: a página passa a seleção pedida e ela chega já "fixa", com o
// foco no campo de comentário, como depois de "comentar estes versos".
// A página da renga usa o mesmo corpo: o texto é o das estrofes juntas (uma linha
// em branco entre elas), o autor de cada estrofe vem embaixo do último verso dela
// (`rodape`) e não há "citar estes versos" (a citação cita poemas).

import Link from "next/link";
import { type ReactNode, useEffect, useRef } from "react";

import { IconeComentar } from "@/components/icones/IconeComentar";
import { VersoFormatado } from "@/components/TextoFormatado";
import {
  caminhoDaCitacaoDeVersos,
  caminhoDaCitacaoDeVersosDaRenga,
  referenciaDosVersos,
  selecionarVerso,
  trechoDosVersos,
  versosDaSelecao,
  versosDoPoema,
  versosTocados,
  type Alvo,
  type SelecaoDeVersos,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

function caminhoDeCitarVersos(alvo: Alvo, trecho: string): string {
  return alvo.tipo === "poema"
    ? caminhoDaCitacaoDeVersos(alvo.id, trecho)
    : caminhoDaCitacaoDeVersosDaRenga(alvo.id, trecho);
}

type Props = {
  // O texto cujos versos se numeram (o do poema ou o da renga).
  texto: string;
  // Com título acima, o corpo respira um pouco mais.
  comTitulo?: boolean;
  // O poema ou a renga de "citar estes versos"; null tira o botão.
  citar: Alvo | null;
  // Embaixo de um verso, fora da seleção (o autor da estrofe na renga).
  rodape?: Map<number, ReactNode>;
  // verso -> quantas críticas o cobrem.
  marcas: Map<number, number>;
  selecao: SelecaoDeVersos | null;
  aoSelecionar: (selecao: SelecaoDeVersos | null) => void;
  // "comentar estes versos": a página leva ao formulário de comentário (sem
  // animação quando a página já abre com os versos pedidos).
  aoComentar: (suave: boolean) => void;
  // Clique na marca: só os comentários daquele verso.
  aoFiltrar: (verso: number) => void;
  // Versos pedidos pela URL (já validados): entram selecionados e com o campo de comentário focado.
  selecaoPedida?: SelecaoDeVersos | null;
};

// A barra dos versos selecionados, aqui e no corpo do poema nos cards.
export const CLASSE_DA_BARRA_DE_VERSOS =
  "mt-2 flex flex-wrap items-center gap-x-1 rounded-xl border border-borda bg-papel-alto px-2 py-1";
export const CLASSE_DA_ACAO_DE_VERSOS =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-destaque hover:bg-destaque/10";

export function VersosComentaveis({
  texto,
  comTitulo = false,
  citar,
  rodape,
  marcas,
  selecao,
  aoSelecionar,
  aoComentar,
  aoFiltrar,
  selecaoPedida = null,
}: Props) {
  const versos = versosDoPoema(texto);
  const visiveis = versosDoPoema(textoSemMarcas(texto));
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
      const tocados = versosTocados(selecaoDeTexto, lista.current.querySelectorAll<HTMLLIElement>("li[data-verso]"));
      const nova = versosDaSelecao(textoSemMarcas(texto), tocados);
      if (nova) {
        origem.current = "texto";
        if (nova.inicio !== selecao?.inicio || nova.fim !== selecao?.fim) aoSelecionar(nova);
      } else if (selecao && origem.current === "texto") {
        aoSelecionar(null);
      }
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, [texto, selecao, aoSelecionar]);

  useEffect(() => {
    if (!selecaoPedida) return;
    origem.current = "fixa";
    aoSelecionar(selecaoPedida);
    // Um quadro depois, com o trecho citado já acima do campo: a rolagem feita
    // na montagem da página se perdia. Sem cancelar na limpeza: a página apaga o
    // pedido logo depois, e isso refaz este efeito antes do quadro.
    requestAnimationFrame(() => aoComentar(false));
    // Só quando o pedido chega; as funções da página mudam a cada render.
  }, [selecaoPedida]);

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
  const acao = CLASSE_DA_ACAO_DE_VERSOS;

  return (
    <div ref={corpo} className={comTitulo ? "mt-2" : "mt-1"}>
      <p className="sr-only">
        Para {citar === null ? "comentar" : "comentar ou citar"} versos, selecione o texto deles, ou ative o número do primeiro verso e
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
                {rodape?.get(n) && <span className="block select-none">{rodape.get(n)}</span>}
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
          className={CLASSE_DA_BARRA_DE_VERSOS}
        >
          <span className="px-1 text-sm text-tinta-suave">{referenciaDosVersos(selecao)}</span>
          <button
            type="button"
            onClick={() => {
              origem.current = "fixa";
              aoComentar(true);
            }}
            className={acao}
          >
            comentar estes versos
          </button>
          {citar !== null && (
            <Link href={caminhoDeCitarVersos(citar, trechoDosVersos(texto, selecao))} className={acao}>
              citar estes versos
            </Link>
          )}
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
