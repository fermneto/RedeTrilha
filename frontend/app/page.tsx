"use client";
// Feed com rolagem infinita, como no X: 20 poemas por vez (ver ListaDePoemas).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ChamadaEscrever } from "@/components/ChamadaEscrever";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { buscarFeed, caminhoDoLogin, temToken } from "@/lib/api";

const POR_PAGINA = 20;

function buscarPagina(cursor: string | null) {
  return buscarFeed(cursor, POR_PAGINA);
}

export default function FeedPage() {
  const router = useRouter();

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  return (
    <div>
      <CabecalhoPagina titulo="Início" />
      <ChamadaEscrever />
      <ListaDePoemas
        buscar={buscarPagina}
        textoDoFim="fim do feed"
        vazio={
          <p className="px-4 py-10 text-center text-tinta-suave">
            Seu feed está vazio. <Link href="/escrever" className="underline">Escreva um poema</Link> ou
            siga outros poetas.
          </p>
        }
      />
    </div>
  );
}
