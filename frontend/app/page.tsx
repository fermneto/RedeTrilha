"use client";
// Feed com rolagem infinita, como no X: 20 poemas por vez (ver ListaDePoemas).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ListaDePoemas } from "@/components/ListaDePoemas";
import { buscarFeed, temToken } from "@/lib/api";

const POR_PAGINA = 20;

function buscarPagina(cursor: string | null) {
  return buscarFeed(cursor, POR_PAGINA);
}

export default function FeedPage() {
  const router = useRouter();

  useEffect(() => {
    if (!temToken()) router.replace("/login");
  }, [router]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Feed</h1>
      <ListaDePoemas
        buscar={buscarPagina}
        textoDoFim="fim do feed"
        vazio={
          <p className="text-tinta-suave">
            Seu feed está vazio. <Link href="/escrever" className="underline">Escreva um poema</Link> ou
            siga outros poetas.
          </p>
        }
      />
    </div>
  );
}
