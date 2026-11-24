"use client";
// Árvore de comentários: cada comentário renderiza as próprias respostas
// (recursão) e pode ser respondido em qualquer nível.

import Link from "next/link";
import { useState } from "react";

import { comentar, formatarData, type Comentario } from "@/lib/api";

type Props = {
  postId: number;
  comentarios: Comentario[];
  // Chamado depois de cada comentário publicado, para recarregar a árvore.
  aoComentar: () => void;
};

export function ArvoreComentarios({ postId, comentarios, aoComentar }: Props) {
  return (
    <section id="comentarios" className="space-y-4">
      <h2 className="text-xl">Comentários</h2>
      <FormComentario postId={postId} parentId={null} aoComentar={aoComentar} />
      {comentarios.length === 0 ? (
        <p className="text-sm text-tinta-suave">Ainda não há comentários.</p>
      ) : (
        <ListaComentarios postId={postId} comentarios={comentarios} aoComentar={aoComentar} />
      )}
    </section>
  );
}

function ListaComentarios({ postId, comentarios, aoComentar }: Props) {
  return (
    <ul className="space-y-3">
      {comentarios.map((c) => (
        <li key={c.id}>
          <ItemComentario postId={postId} comentario={c} aoComentar={aoComentar} />
        </li>
      ))}
    </ul>
  );
}

function ItemComentario({
  postId,
  comentario,
  aoComentar,
}: {
  postId: number;
  comentario: Comentario;
  aoComentar: () => void;
}) {
  const [respondendo, setRespondendo] = useState(false);
  return (
    <div>
      <div className="rounded-md border border-borda bg-papel-alto p-3">
        <p className="text-xs text-tinta-suave">
          <Link href={`/u/${comentario.autor.username}`} className="font-medium text-tinta hover:underline">
            {comentario.autor.name}
          </Link>{" "}
          @{comentario.autor.username} ·{" "}
          <time dateTime={comentario.created_at}>
            {formatarData(comentario.created_at)}
          </time>
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{comentario.texto}</p>
        <button
          type="button"
          onClick={() => setRespondendo((r) => !r)}
          className="mt-1 cursor-pointer text-xs text-tinta-suave hover:text-tinta"
        >
          {respondendo ? "cancelar" : "responder"}
        </button>
      </div>
      {respondendo && (
        <div className="mt-2 ml-4">
          <FormComentario
            postId={postId}
            parentId={comentario.id}
            aoComentar={() => {
              setRespondendo(false);
              aoComentar();
            }}
          />
        </div>
      )}
      {comentario.respostas.length > 0 && (
        <div className="mt-3 ml-4 border-l border-borda pl-3">
          <ListaComentarios postId={postId} comentarios={comentario.respostas} aoComentar={aoComentar} />
        </div>
      )}
    </div>
  );
}

function FormComentario({
  postId,
  parentId,
  aoComentar,
}: {
  postId: number;
  parentId: number | null;
  aoComentar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await comentar(postId, texto, parentId);
      setTexto("");
      aoComentar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não deu para comentar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        rows={parentId === null ? 3 : 2}
        placeholder={parentId === null ? "Comente o poema" : "Sua resposta"}
        className="w-full rounded border border-borda bg-papel px-3 py-2 text-sm text-tinta"
      />
      {erro && <p className="text-xs text-destaque">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="cursor-pointer rounded bg-tinta px-3 py-1.5 text-sm text-papel disabled:opacity-50"
      >
        {enviando ? "enviando..." : parentId === null ? "comentar" : "responder"}
      </button>
    </form>
  );
}
