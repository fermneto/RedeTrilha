// O documento do editor de poemas (ProseMirror) e a conversão com o texto salvo
// (#137). Cada verso é um bloco: Enter abre o verso seguinte, a linha em branco
// é um verso vazio e a marca nunca passa de um verso para o outro, como no
// formato salvo (lib/marcas.ts). Só há as quatro marcas do Verso: o que vier de
// fora (títulos, listas, links, cores) não tem onde entrar.

import { Fragment, type Node as NoDoEditor, Schema, Slice } from "prosemirror-model";

import { analisarTexto, escreverTexto, type Marca, MARCAS, type Segmento } from "@/lib/marcas";

export const esquema = new Schema({
  nodes: {
    doc: { content: "verso+" },
    // data-verso marca o HTML copiado do próprio editor: só ele cola com formatação.
    verso: {
      content: "text*",
      marks: "_",
      parseDOM: [{ tag: "p", preserveWhitespace: "full" }],
      toDOM: () => ["p", { "data-verso": "" }, 0],
    },
    text: {},
  },
  marks: {
    negrito: { parseDOM: [{ tag: "strong" }, { tag: "b" }], toDOM: () => ["strong", 0] },
    italico: { parseDOM: [{ tag: "em" }, { tag: "i" }], toDOM: () => ["em", 0] },
    sublinhado: { parseDOM: [{ tag: "u" }], toDOM: () => ["u", 0] },
    tachado: { parseDOM: [{ tag: "s" }, { tag: "del" }], toDOM: () => ["s", 0] },
  },
});

function verso(segmentos: Segmento[]): NoDoEditor {
  return esquema.node(
    "verso",
    null,
    segmentos.map((s) => esquema.text(s.texto, s.marcas.map((m) => esquema.mark(m)))),
  );
}

export function docDoTexto(texto: string): NoDoEditor {
  return esquema.node("doc", null, analisarTexto(texto).map(verso));
}

export function textoDoDoc(doc: NoDoEditor): string {
  const linhas: Segmento[][] = [];
  doc.forEach((bloco) => {
    const segmentos: Segmento[] = [];
    bloco.forEach((no) => {
      const nomes = no.marks.map((m) => m.type.name as Marca);
      segmentos.push({ texto: no.text ?? "", marcas: MARCAS.filter((m) => nomes.includes(m)) });
    });
    linhas.push(segmentos);
  });
  return escreverTexto(linhas);
}

// Texto colado de fora: entra puro, um verso por linha, sem nenhuma marca.
// Aberto nas pontas: a primeira e a última linha se juntam ao verso do cursor.
export function versosColados(texto: string): Slice {
  const versos = texto
    .split(/\r\n|\r|\n/)
    .map((linha) => esquema.node("verso", null, linha ? [esquema.text(linha)] : []));
  return new Slice(Fragment.from(versos), 1, 1);
}

// O texto que vai para a área de transferência ao copiar do editor: limpo, sem
// os delimitadores, um verso por linha.
export function textoCopiado(slice: Slice): string {
  return slice.content.textBetween(0, slice.content.size, "\n");
}
