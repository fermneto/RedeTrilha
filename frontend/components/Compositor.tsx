"use client";
// Compositor de poema: título opcional, corpo e forma. Com `citarId`, vira
// citação (POST /posts com repost_de_id) e mostra o original embaixo.

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PoemaCard } from "@/components/PoemaCard";
import {
  buscarPoema,
  FORMAS,
  IDIOMAS_DO_COMPOSITOR,
  nomeDaForma,
  nomeDoIdioma,
  publicarPoema,
  type Post,
} from "@/lib/api";

// Valor do <select> para "outra" língua: vai como null (desconhecida).
const OUTRA = "";

// `textoInicial`: na citação de versos (#71), o corpo já começa com eles.
export function Compositor({ citarId, textoInicial = "" }: { citarId: number | null; textoInicial?: string }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState(textoInicial);
  const [forma, setForma] = useState("");
  const [idioma, setIdioma] = useState<string>(IDIOMAS_DO_COMPOSITOR[0]);
  const [original, setOriginal] = useState<Post | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const corpo = useRef<HTMLTextAreaElement>(null);
  // Depois de Esc, o próximo Tab sai do campo (para quem navega só pelo teclado).
  const liberarTab = useRef(false);
  // Onde o cursor fica depois do recuo inserido pelo Tab (null: nada pendente).
  const cursorDoRecuo = useRef<number | null>(null);

  // Ao trocar o value, o navegador joga o cursor para o fim do texto. Acerta a
  // posição no mesmo commit, antes de pintar e antes da próxima tecla: num
  // requestAnimationFrame, o que se digitava logo depois do Tab ia para o fim.
  useLayoutEffect(() => {
    if (cursorDoRecuo.current === null) return;
    corpo.current?.setSelectionRange(cursorDoRecuo.current, cursorDoRecuo.current);
    cursorDoRecuo.current = null;
  }, [texto]);

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
    const { value, selectionStart: inicio, selectionEnd: fim } = campo;
    cursorDoRecuo.current = inicio + 1;
    setTexto(value.slice(0, inicio) + "\t" + value.slice(fim));
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
        idioma: idioma === OUTRA ? null : idioma,
        ...(citarId !== null && { repost_de_id: citarId }),
      });
      router.push(`/poema/${novo.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "não deu para publicar");
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded-xl border border-borda bg-papel-alto px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";
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

      {/* Discreto: quase todo poema é em português, o padrão. */}
      <label className="flex items-center gap-2 text-xs text-tinta-suave">
        língua do poema
        <select
          value={idioma}
          onChange={(e) => setIdioma(e.target.value)}
          className="min-h-11 cursor-pointer rounded-lg border border-borda bg-papel-alto px-2 text-xs text-tinta focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none"
        >
          {IDIOMAS_DO_COMPOSITOR.map((codigo) => (
            <option key={codigo} value={codigo}>
              {nomeDoIdioma(codigo)}
            </option>
          ))}
          <option value={OUTRA}>outra</option>
        </select>
      </label>

      {original && <PoemaCard post={original} aninhado />}

      {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
      >
        {enviando ? "publicando..." : citarId === null ? "publicar" : "publicar citação"}
      </button>
    </form>
  );
}
