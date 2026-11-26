"use client";
// "Mais de Fulano", no pé da página do poema e da renga: outros poemas da
// pessoa, como o índice de um livro (o título, ou o primeiro verso, e o começo
// do poema). Vem da primeira página do perfil dela; sem outros poemas ali, o
// bloco não aparece.

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { VersoFormatado } from "@/components/TextoFormatado";
import { buscarPoemasDoPerfil, outrosPoemas, type Alvo, type Post, type User } from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

const QUANTOS = 3;
// A página do perfil de onde saem: folga para os reposts e as rengas que ficam de fora.
const DO_PERFIL = 20;

export function MaisDoAutor({ autor, aberto }: { autor: User; aberto: Alvo }) {
  const [poemas, setPoemas] = useState<Post[]>([]);
  const idDoTitulo = useId();

  useEffect(() => {
    let vivo = true;
    buscarPoemasDoPerfil(autor.username, null, DO_PERFIL)
      .then((pagina) => {
        if (vivo) setPoemas(outrosPoemas(pagina.items, autor.id, aberto, QUANTOS));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [autor.username, autor.id, aberto.tipo, aberto.id]);

  if (poemas.length === 0) return null;
  return (
    <section aria-labelledby={idDoTitulo} className="mt-12">
      <h2 id={idDoTitulo} className="text-sm font-bold">
        Mais de {autor.name}
      </h2>
      <ul className="mt-2">
        {poemas.map((poema) => {
          const primeiro = primeiroVerso(poema.texto);
          return (
            <li key={poema.id}>
              <Link href={`/poema/${poema.id}`} className="group realce -mx-2 block rounded-lg px-2 py-2.5">
                {poema.titulo && (
                  <span className="block font-serifada font-semibold break-words group-hover:underline">
                    {poema.titulo}
                  </span>
                )}
                <span
                  className={`block truncate font-serifada text-[0.9375rem] whitespace-pre ${
                    poema.titulo ? "text-tinta-suave" : "italic group-hover:underline"
                  }`}
                >
                  {primeiro ? <VersoFormatado linha={primeiro} /> : "poema sem título"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/u/${autor.username}`}
        className="mt-1 inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-destaque hover:underline"
      >
        todos os poemas de {autor.name}
      </Link>
    </section>
  );
}

// O primeiro verso com texto, com as marcas de formatação e os recuos dele.
function primeiroVerso(texto: string): string {
  return texto.split("\n").find((linha) => textoSemMarcas(linha).trim() !== "") ?? "";
}
