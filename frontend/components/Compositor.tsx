"use client";
// Compositor de poema: título opcional, corpo e forma. Com `citarId`, vira
// citação (POST /posts com repost_de_id) e mostra o original embaixo.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PoemaCard } from "@/components/PoemaCard";
import { buscarPoema, FORMAS, nomeDaForma, publicarPoema, type Post } from "@/lib/api";

export function Compositor({ citarId }: { citarId: number | null }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [forma, setForma] = useState("");
  const [original, setOriginal] = useState<Post | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const corpo = useRef<HTMLTextAreaElement>(null);
  // Depois de Esc, o próximo Tab sai do campo (para quem navega só pelo teclado).
  const liberarTab = useRef(false);

  useEffect(() => {
    if (citarId === null) return;
    buscarPoema(citarId)
      .then(setOriginal)
      .catch((e) => setErro(e instanceof Error ? e.message : "não achei o poema citado"));
  }, [citarId]);

  // Tab no corpo insere um recuo em vez de pular para o próximo campo.
  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      liberarTab.current = true;
      return;
    }
    if (e.key !== "Tab" || e.shiftKey || liberarTab.current) {
      liberarTab.current = false;
      return;
    }
    e.preventDefault();
    const campo = e.currentTarget;
    const { selectionStart: inicio, selectionEnd: fim } = campo;
    setTexto(texto.slice(0, inicio) + "\t" + texto.slice(fim));
    requestAnimationFrame(() => {
      corpo.current?.setSelectionRange(inicio + 1, inicio + 1);
    });
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      setErro("o poema não pode ficar vazio");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const novo = await publicarPoema({
        titulo: titulo.trim() ? titulo : null,
        texto,
        forma: forma || null,
        ...(citarId !== null && { repost_de_id: citarId }),
      });
      router.push(`/poema/${novo.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não deu para publicar");
      setEnviando(false);
    }
  }

  const campo = "w-full rounded border border-borda bg-papel px-3 py-2 text-tinta";
  return (
    <form onSubmit={publicar} className="space-y-4">
      <label className="block text-sm">
        título (opcional)
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={200}
          className={`${campo} poema-titulo mt-1`}
        />
      </label>

      <label className="block text-sm">
        {citarId === null ? "poema" : "seu comentário sobre o poema"}
        <textarea
          ref={corpo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          required
          rows={12}
          spellCheck
          className={`${campo} poema-corpo mt-1 resize-y`}
          style={{ tabSize: 4 }}
        />
        <span className="mt-1 block text-xs text-tinta-suave">
          Quebras de linha e recuos ficam como você escreveu. Tab insere um recuo; Esc e depois
          Tab sai do campo.
        </span>
      </label>

      <label className="block text-sm">
        forma (opcional)
        <select value={forma} onChange={(e) => setForma(e.target.value)} className={`${campo} mt-1`}>
          <option value="">sem forma</option>
          {FORMAS.map((f) => (
            <option key={f} value={f}>
              {nomeDaForma(f)}
            </option>
          ))}
        </select>
      </label>

      {original && <PoemaCard post={original} aninhado />}

      {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="cursor-pointer rounded bg-tinta px-4 py-2 text-sm text-papel disabled:opacity-50"
      >
        {enviando ? "publicando..." : citarId === null ? "publicar" : "publicar citação"}
      </button>
    </form>
  );
}
