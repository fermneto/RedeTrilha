"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import { PoemaCard } from "@/components/PoemaCard";
import { buscarComentarios, buscarPoema, temToken, type Comentario, type Post } from "@/lib/api";

export default function PoemaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [poema, setPoema] = useState<Post | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroComentarios, setErroComentarios] = useState<string | null>(null);

  // Recarrega o poema junto, para o contador de comentários acompanhar a árvore.
  // Os dois pedidos falham separados: sem comentários, o poema ainda aparece.
  const carregar = useCallback(async () => {
    const [p, c] = await Promise.allSettled([buscarPoema(id), buscarComentarios(id)]);
    if (p.status === "fulfilled") {
      setPoema(p.value);
      setErro(null);
    } else {
      setErro(p.reason instanceof Error ? p.reason.message : "não deu para carregar o poema");
    }
    if (c.status === "fulfilled") {
      setComentarios(c.value);
      setErroComentarios(null);
    } else {
      setErroComentarios(
        c.reason instanceof Error ? c.reason.message : "não deu para carregar os comentários",
      );
    }
  }, [id]);

  useEffect(() => {
    if (!temToken()) {
      router.replace("/login");
      return;
    }
    carregar();
  }, [carregar, router]);

  if (erro) return <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>;
  if (!poema) return <p className="text-sm text-tinta-suave">carregando...</p>;

  return (
    <div className="space-y-10">
      <PoemaCard post={poema} linkarTitulo={false} />
      <ArvoreComentarios postId={poema.id} comentarios={comentarios} aoComentar={carregar} />
      {erroComentarios && <p className="text-sm text-destaque">{erroComentarios}</p>}
    </div>
  );
}
