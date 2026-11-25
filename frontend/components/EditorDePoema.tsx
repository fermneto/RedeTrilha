"use client";
// Editor de poemas com negrito, itálico, sublinhado e tachado (#137), como no
// Google Docs: seleciona, aperta Ctrl+B (ou o botão B) e o trecho já aparece em
// negrito. O que sai é texto, no formato de lib/marcas.ts.
//
// Configurado para poesia: cada Enter é um verso novo (sem margem de
// parágrafo), as linhas em branco e os recuos ficam (white-space: pre-wrap), Tab
// insere um recuo (Esc e depois Tab sai do campo) e o que se cola de fora entra
// como texto puro. Feito direto sobre o ProseMirror (sem Tiptap): o documento é
// só versos e quatro marcas, e o resto do Tiptap não teria uso aqui.

import { baseKeymap, splitBlockKeepMarks, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { MarkType } from "prosemirror-model";
import { type Command, EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

import { docDoTexto, esquema, textoCopiado, textoDoDoc, versosColados } from "@/lib/editorDePoema";
import type { Marca } from "@/lib/marcas";

type Botao = { marca: Marca; rotulo: string; letra: string; atalho: string; teclas: string; estilo: string };

const BOTOES: Botao[] = [
  { marca: "negrito", rotulo: "negrito", letra: "B", atalho: "Ctrl+B", teclas: "Control+B Meta+B", estilo: "font-bold" },
  { marca: "italico", rotulo: "itálico", letra: "I", atalho: "Ctrl+I", teclas: "Control+I Meta+I", estilo: "italic" },
  {
    marca: "sublinhado",
    rotulo: "sublinhado",
    letra: "U",
    atalho: "Ctrl+U",
    teclas: "Control+U Meta+U",
    estilo: "underline underline-offset-2",
  },
  {
    marca: "tachado",
    rotulo: "tachado",
    letra: "S",
    atalho: "Ctrl+Shift+X",
    teclas: "Control+Shift+X Meta+Shift+X",
    estilo: "line-through",
  },
];

function alternar(marca: Marca): Command {
  return toggleMark(esquema.marks[marca]);
}

function plugins() {
  return [
    history(),
    keymap({
      "Mod-b": alternar("negrito"),
      "Mod-i": alternar("italico"),
      "Mod-u": alternar("sublinhado"),
      "Mod-Shift-x": alternar("tachado"),
      "Mod-Shift-X": alternar("tachado"),
      // O atalho do Google Docs para tachado.
      "Alt-Shift-5": alternar("tachado"),
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      // Enter é quebra de verso; o negrito continua no verso seguinte, como no Docs.
      Enter: splitBlockKeepMarks,
      "Shift-Enter": splitBlockKeepMarks,
    }),
    keymap(baseKeymap),
  ];
}

function ativa(estado: EditorState, tipo: MarkType): boolean {
  const { empty, from, to, $from } = estado.selection;
  if (empty) return Boolean(tipo.isInSet(estado.storedMarks ?? $from.marks()));
  return estado.doc.rangeHasMark(from, to, tipo);
}

type Props = {
  valor: string;
  aoMudar: (texto: string) => void;
  // Rótulo do campo, na linha da barra B I U S. Sem ele, `idRotulo` é o de um
  // elemento da página (o título da seção, na renga).
  rotulo?: ReactNode;
  idRotulo: string;
  idAjuda?: string;
  invalido?: boolean;
  // Altura mínima, em linhas; o campo cresce com o poema.
  linhas?: number;
  classe?: string;
  // O elemento editável (a oficina mede a altura de cada verso nele).
  refEditavel?: RefObject<HTMLElement | null>;
  // Ao lado do campo (as marcas da oficina).
  aoLado?: ReactNode;
};

export function EditorDePoema({
  valor,
  aoMudar,
  rotulo,
  idRotulo,
  idAjuda,
  invalido = false,
  linhas = 12,
  classe = "",
  refEditavel,
  aoLado,
}: Props) {
  const montagem = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const [estado, setEstado] = useState<EditorState | null>(null);
  // O último texto que o editor mandou: o `valor` igual a ele não recria o documento.
  const ultimo = useRef(valor);
  const aoMudarAtual = useRef(aoMudar);
  aoMudarAtual.current = aoMudar;
  // Depois de Esc, o próximo Tab sai do campo (para quem navega só pelo teclado).
  const liberarTab = useRef(false);
  const [foco, setFoco] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  const atributos = {
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": idRotulo,
    ...(idAjuda ? { "aria-describedby": idAjuda } : {}),
    ...(invalido ? { "aria-invalid": "true" } : {}),
    spellcheck: "true",
    class: `editor-poema poema-corpo ${classe}`,
    style: `min-height: calc(${linhas} * 1.75em + 1rem)`,
  };

  useLayoutEffect(() => {
    if (!montagem.current) return;
    const view: EditorView = new EditorView(montagem.current, {
      state: EditorState.create({ doc: docDoTexto(valor), plugins: plugins() }),
      attributes: atributos,
      dispatchTransaction(tr) {
        const novo = view.state.apply(tr);
        view.updateState(novo);
        setEstado(novo);
        if (!tr.docChanged) return;
        const texto = textoDoDoc(novo.doc);
        if (texto === ultimo.current) return;
        ultimo.current = texto;
        aoMudarAtual.current(texto);
      },
      handleKeyDown(v, e) {
        if (e.key === "Escape") {
          liberarTab.current = true;
          return false;
        }
        if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || liberarTab.current) {
          liberarTab.current = false;
          return false;
        }
        v.dispatch(v.state.tr.insertText("\t").scrollIntoView());
        return true;
      },
      // Colar de fora entra como texto puro; do próprio editor (data-verso), com a formatação.
      handlePaste(v, e) {
        if ((e.clipboardData?.getData("text/html") ?? "").includes("data-verso")) return false;
        const texto = e.clipboardData?.getData("text/plain") ?? "";
        if (texto) v.dispatch(v.state.tr.replaceSelection(versosColados(texto)).scrollIntoView());
        return true;
      },
      handleDrop(v, e, _slice, movido) {
        if (movido) return false;
        const dados = (e as DragEvent).dataTransfer;
        if ((dados?.getData("text/html") ?? "").includes("data-verso")) return false;
        const texto = dados?.getData("text/plain") ?? "";
        const onde = v.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY });
        if (texto && onde) v.dispatch(v.state.tr.replaceRange(onde.pos, onde.pos, versosColados(texto)));
        return true;
      },
      clipboardTextSerializer: textoCopiado,
    });
    vista.current = view;
    if (refEditavel) refEditavel.current = view.dom;
    setEstado(view.state);
    return () => {
      view.destroy();
      vista.current = null;
      if (refEditavel) refEditavel.current = null;
    };
    // O editor nasce uma vez; o valor e os atributos mudam pelos efeitos abaixo.
  }, []);

  // O valor mudou por fora (rascunho aberto, estrofe enviada): troca o documento.
  useEffect(() => {
    const view = vista.current;
    if (!view || valor === ultimo.current) return;
    ultimo.current = valor;
    const novo = EditorState.create({ doc: docDoTexto(valor), plugins: view.state.plugins });
    view.updateState(novo);
    setEstado(novo);
  }, [valor]);

  useEffect(() => {
    vista.current?.setProps({ attributes: atributos });
  }, [idRotulo, idAjuda, invalido, linhas, classe]);

  function aplicar(marca: Marca) {
    const view = vista.current;
    if (!view) return;
    alternar(marca)(view.state, view.dispatch);
    view.focus();
  }

  // Uma parada de Tab só na barra; as setas andam entre os botões.
  function aoTeclarNaBarra(e: React.KeyboardEvent) {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let proximo = foco;
    if (passo) proximo = (foco + passo + BOTOES.length) % BOTOES.length;
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = BOTOES.length - 1;
    else return;
    e.preventDefault();
    setFoco(proximo);
    botoes.current[proximo]?.focus();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        {rotulo !== undefined ? (
          <span id={idRotulo} className="text-sm" onClick={() => vista.current?.focus()}>
            {rotulo}
          </span>
        ) : (
          <span />
        )}
        <div
          role="toolbar"
          aria-label="formatação do texto"
          onKeyDown={aoTeclarNaBarra}
          className="-mb-0.5 flex items-center gap-0.5"
        >
          {BOTOES.map((b, i) => {
            const ligado = estado !== null && ativa(estado, esquema.marks[b.marca]);
            return (
              <button
                key={b.marca}
                ref={(el) => {
                  botoes.current[i] = el;
                }}
                type="button"
                tabIndex={i === foco ? 0 : -1}
                aria-pressed={ligado}
                aria-label={b.rotulo}
                aria-keyshortcuts={b.teclas}
                title={`${b.rotulo} (${b.atalho})`}
                // Sem tirar o foco nem a seleção do texto ao apertar.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setFoco(i);
                  aplicar(b.marca);
                }}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg font-serifada text-[1.0625rem] leading-none transition-colors duration-150 ${b.estilo} ${
                  ligado
                    ? "bg-destaque/10 text-destaque"
                    : "text-tinta-suave hover:bg-tinta/5 hover:text-tinta"
                }`}
              >
                {b.letra}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-2">
        <div ref={montagem} className="min-w-0 flex-1" />
        {aoLado}
      </div>
    </div>
  );
}
