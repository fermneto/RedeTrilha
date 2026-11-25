// Exibição do texto do poema com negrito, itálico, sublinhado e tachado (#137).
// O texto vira elementos React (<strong>, <em>, <u>, <s>) a partir de
// lib/marcas.ts: nada de HTML vindo do texto é interpretado, então "<script>"
// aparece como foi escrito. Quem usa põe o resultado num elemento com
// whitespace-pre-wrap (a classe poema-corpo): as quebras e os recuos ficam.
// Copiar o poema (Ctrl+C) dá o texto limpo, sem os delimitadores.

import { Fragment, type ReactNode } from "react";

import { analisarLinha, type Segmento } from "@/lib/marcas";

function Pedaco({ segmento }: { segmento: Segmento }) {
  const { texto, marcas } = segmento;
  let no: ReactNode = texto;
  if (marcas.includes("tachado")) no = <s>{no}</s>;
  if (marcas.includes("sublinhado")) no = <u>{no}</u>;
  if (marcas.includes("italico")) no = <em>{no}</em>;
  if (marcas.includes("negrito")) no = <strong className="font-bold">{no}</strong>;
  return <>{no}</>;
}

// Um verso só (uma linha de texto.split("\n")).
export function VersoFormatado({ linha }: { linha: string }) {
  return (
    <>
      {analisarLinha(linha).map((segmento, i) => (
        <Pedaco key={i} segmento={segmento} />
      ))}
    </>
  );
}

// O texto inteiro, verso a verso, com as quebras de linha de volta entre eles.
export function TextoFormatado({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <Fragment key={i}>
          {i > 0 && "\n"}
          <VersoFormatado linha={linha} />
        </Fragment>
      ))}
    </>
  );
}
