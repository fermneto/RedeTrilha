"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import { PoemaCard } from "@/components/PoemaCard";
import { buscarEu, buscarPoema, caminhoDoLogin, temToken, type Post } from "@/lib/api";

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
      router.replace(caminhoDoLogin());
      return;
    }
    carregarPoema();
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => setEuId(null));
  }, [carregarPoema, router]);

  if (erro) return <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>;
  if (!poema) return <p className="text-sm text-tinta-suave">carregando...</p>;

  return (
    <div className="space-y-10">
      <PoemaCard post={poema} linkarTitulo={false} inteiro />
      <ArvoreComentarios postId={poema.id} euId={euId} aoMudar={carregarPoema} />
    </div>
  );
}
