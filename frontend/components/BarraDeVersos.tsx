"use client";
// Selecionar versos num card (feed, perfil, antologias...), fora da página do
// poema ou da renga: o texto selecionado com o mouse ou o toque vira os versos
// inteiros que ele toca e aparece a barra "comentar estes versos / citar estes
// versos / limpar". Comentar leva à página, com ?versos=, onde a crítica é escrita
// (#71). A barra some com "limpar", Esc ou um toque fora dela. Serve ao PoemaCard
// e ao RengaCard.

import Link from "next/link";
import { type RefObject, useEffect, useRef, useState } from "react";

import { CLASSE_DA_ACAO_DE_VERSOS, CLASSE_DA_BARRA_DE_VERSOS } from "@/components/VersosComentaveis";
import { referenciaDosVersos, versosDaSelecao, versosTocados, type SelecaoDeVersos } from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

// A seleção de versos dentro de `corpo` (cada linha com data-verso), contra `texto`.
// Só a seleção que começa no corpo conta: a de fora (ou a que começa noutro card)
// não mexe aqui. Seleção recolhida não apaga a barra: no toque, ela se desfaz no
// mesmo toque que vai à barra; quem apaga é o toque fora dela.
export function useVersosSelecionados(corpo: RefObject<HTMLElement | null>, texto: string, ativo: boolean) {
  const barra = useRef<HTMLDivElement>(null);
  const [selecao, setSelecao] = useState<SelecaoDeVersos | null>(null);

  useEffect(() => {
    if (!ativo) return;
    function aoMudarSelecao() {
      const doc = document.getSelection();
      const elemento = corpo.current;
      if (!doc || !elemento || doc.isCollapsed || !doc.anchorNode || !elemento.contains(doc.anchorNode)) return;
      const nova = versosDaSelecao(
        textoSemMarcas(texto),
        versosTocados(doc, elemento.querySelectorAll<HTMLElement>("[data-verso]")),
      );
      setSelecao((atual) => (nova && atual?.inicio === nova.inicio && atual.fim === nova.fim ? atual : nova));
    }
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, [ativo, texto, corpo]);

  useEffect(() => {
    if (!selecao) return;
    function aoTocar(e: PointerEvent) {
      if (!barra.current?.contains(e.target as Node)) setSelecao(null);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      document.getSelection()?.removeAllRanges();
      setSelecao(null);
    }
    document.addEventListener("pointerdown", aoTocar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [selecao]);

  return { selecao, limpar: () => setSelecao(null), barra };
}

export function BarraDeVersos({
  texto,
  selecao,
  barra,
  caminhoDaCritica,
  caminhoDaCitacao,
  aoLimpar,
}: {
  // O texto do corpo, para mostrar os números de verso (a seleção é de linhas).
  texto: string;
  selecao: SelecaoDeVersos;
  barra: RefObject<HTMLDivElement | null>;
  caminhoDaCritica: string;
  // null: sem "citar estes versos" (a renga não se cita).
  caminhoDaCitacao: string | null;
  aoLimpar: () => void;
}) {
  return (
    <div ref={barra} role="group" aria-label="versos selecionados" className={CLASSE_DA_BARRA_DE_VERSOS}>
      <span className="px-1 text-sm text-tinta-suave">{referenciaDosVersos(texto, selecao)}</span>
      <Link href={caminhoDaCritica} className={CLASSE_DA_ACAO_DE_VERSOS}>
        comentar estes versos
      </Link>
      {caminhoDaCitacao !== null && (
        <Link href={caminhoDaCitacao} className={CLASSE_DA_ACAO_DE_VERSOS}>
          citar estes versos
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          document.getSelection()?.removeAllRanges();
          aoLimpar();
        }}
        className={`${CLASSE_DA_ACAO_DE_VERSOS} text-tinta-suave`}
      >
        limpar
      </button>
    </div>
  );
}
