"use client";
// "Da mesma forma", abaixo do "Mais do autor": poemas de outras pessoas na
// mesma forma (soneto, haicai...), tirados do Explorar. Sem forma que diga
// algo ("outro") ou sem poemas de outros, o bloco não aparece.

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { ItemDoIndice } from "@/components/ItemDoIndice";
import { buscarExplorar, caminhoDaForma, nomeDaForma, poemasDeOutraPessoa, type Post } from "@/lib/api";

const QUANTOS = 3;
// A página do Explorar de onde saem: folga para os do próprio autor e o aberto.
const DO_EXPLORAR = 12;

export function DaMesmaForma({ poema }: { poema: Post }) {
  const forma = poema.forma && poema.forma !== "outro" ? poema.forma : null;
  const [poemas, setPoemas] = useState<Post[]>([]);
  const idDoTitulo = useId();

  useEffect(() => {
    if (!forma) return;
    let vivo = true;
    buscarExplorar({ tag: null, forma }, null, DO_EXPLORAR)
      .then((pagina) => {
        if (vivo) setPoemas(poemasDeOutraPessoa(pagina.items, poema.autor_id, poema.id, QUANTOS));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [forma, poema.autor_id, poema.id]);

  if (!forma || poemas.length === 0) return null;
  return (
    <section aria-labelledby={idDoTitulo} className="mt-10">
      <h2 id={idDoTitulo} className="text-sm font-bold">
        Da mesma forma: {nomeDaForma(forma)}
      </h2>
      <ul className="mt-2">
        {poemas.map((p) => (
          <ItemDoIndice key={p.id} poema={p} comAutor />
        ))}
      </ul>
      <Link
        href={caminhoDaForma(forma)}
        className="mt-1 inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-destaque hover:underline"
      >
        mais poemas desta forma no Explorar
      </Link>
    </section>
  );
}
