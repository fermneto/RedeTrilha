// Uma linha do "índice" no pé da página do poema (Mais do autor, Da mesma
// forma): o título, ou o primeiro verso, e o começo do poema, em serifada.

import Link from "next/link";

import { VersoFormatado } from "@/components/TextoFormatado";
import type { Post } from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

export function ItemDoIndice({ poema, comAutor = false }: { poema: Post; comAutor?: boolean }) {
  const primeiro = primeiroVerso(poema.texto);
  return (
    <li>
      <Link href={`/poema/${poema.id}`} className="group realce -mx-2 block rounded-lg px-2 py-2.5">
        {poema.titulo && (
          <span className="block font-serifada font-semibold break-words group-hover:underline">{poema.titulo}</span>
        )}
        <span
          className={`block truncate font-serifada text-[0.9375rem] whitespace-pre ${
            poema.titulo ? "text-tinta-suave" : "italic group-hover:underline"
          }`}
        >
          {primeiro ? <VersoFormatado linha={primeiro} /> : "poema sem título"}
        </span>
        {comAutor && <span className="block text-[0.8125rem] text-tinta-suave">{poema.autor.name}</span>}
      </Link>
    </li>
  );
}

// O primeiro verso com texto, com as marcas de formatação e os recuos dele.
function primeiroVerso(texto: string): string {
  return texto.split("\n").find((linha) => textoSemMarcas(linha).trim() !== "") ?? "";
}
