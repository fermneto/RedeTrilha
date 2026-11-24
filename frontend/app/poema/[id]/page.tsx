"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { PoemaCard } from "@/components/PoemaCard";
import { buscarEu, buscarPoema, temToken, type Post } from "@/lib/api";

export default function PoemaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [poema, setPoema] = useState<Post | null>(null);
  const [euId, setEuId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Também chamado pela árvore depois de comentar ou apagar: o contador de
  // comentários do card vem do poema. A árvore se carrega sozinha.
  const carregarPoema = useCallback(async () => {
    try {
      setPoema(await buscarPoema(id));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para carregar o poema");
    }
  }, [id]);

  useEffect(() => {
    if (!temToken()) {
      router.replace("/login");
      return;
    }
    carregarPoema();
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => setEuId(null));
  }, [carregarPoema, router]);

  const cabecalho = <CabecalhoPagina titulo="Poema" comoTitulo={false} />;
  if (erro)
    return (
      <>
        {cabecalho}
        <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
      </>
    );
  if (!poema)
    return (
      <>
        {cabecalho}
        <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>
      </>
    );

  return (
    <div>
      {cabecalho}
      <div className="border-b border-borda">
        <PoemaCard post={poema} linkarTitulo={false} inteiro />
      </div>
      <div className="px-4 py-6">
        <ArvoreComentarios postId={poema.id} euId={euId} aoMudar={carregarPoema} />
      </div>
    </div>
  );
}
