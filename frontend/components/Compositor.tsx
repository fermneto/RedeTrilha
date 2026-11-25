"use client";
// Compositor de poema: título opcional, corpo e forma. Com `citarId`, vira
// citação (POST /posts com repost_de_id) e mostra o original embaixo. Com
// `rascunhoId`, abre o rascunho (de poema ou de citação); "salvar rascunho"
// guarda sem publicar. O corpo é o editor de poemas (negrito, itálico,
// sublinhado e tachado, #137); o texto guardado é o de lib/marcas.ts.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { EditorDePoema } from "@/components/EditorDePoema";
import { OficinaMarcas, OficinaPainel, useOficina } from "@/components/OficinaMarcas";
import { PoemaCard } from "@/components/PoemaCard";
import {
  buscarPoema,
  buscarRascunho,
  criarRascunho,
  editarRascunho,
  FORMAS,
  IDIOMAS_DO_COMPOSITOR,
  mensagemDeFalha,
  nomeDaForma,
  nomeDoIdioma,
  publicarPoema,
  publicarRascunho,
  type Post,
} from "@/lib/api";

// Valor do <select> para "outra" língua: vai como null (desconhecida).
const OUTRA = "";

type Props = {
  citarId: number | null;
  // Na citação de versos (#71), o corpo já começa com eles.
  textoInicial?: string;
  rascunhoId?: number | null;
  // Chamado quando o rascunho aberto é de citação (a página troca o título).
  aoAbrirCitacao?: () => void;
};

export function Compositor({ citarId, textoInicial = "", rascunhoId = null, aoAbrirCitacao }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState(textoInicial);
  const [forma, setForma] = useState("");
  const [idioma, setIdioma] = useState<string>(IDIOMAS_DO_COMPOSITOR[0]);
  const [original, setOriginal] = useState<Post | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // O rascunho aberto ou o criado no primeiro "salvar rascunho" (null: nenhum).
  const [rascunho, setRascunho] = useState<number | null>(rascunhoId);
  const [salvo, setSalvo] = useState(false);
  // O poema citado: o da URL ou o do rascunho aberto. `citadoRemovido`: o
  // original foi apagado enquanto a citação era rascunho.
  const [citado, setCitado] = useState<number | null>(citarId);
  const [citadoRemovido, setCitadoRemovido] = useState(false);
  const citacao = citado !== null || citadoRemovido;
  const corpo = useRef<HTMLElement | null>(null);
  const id = useId();
  const oficina = useOficina(texto, forma);

  useEffect(() => {
    if (citado === null) return;
    buscarPoema(citado)
      .then(setOriginal)
      .catch((e) => setErro(mensagemDeFalha(e, "não achei o poema citado")));
  }, [citado]);

  useEffect(() => {
    if (rascunhoId === null) return;
    buscarRascunho(rascunhoId)
      .then((r) => {
        setTitulo(r.titulo ?? "");
        setTexto(r.texto);
        setForma(r.forma ?? "");
        setIdioma(r.idioma ?? OUTRA);
        setCitado(r.repost_de_id);
        setCitadoRemovido(r.repost_removido);
        if (r.repost_de_id !== null || r.repost_removido) aoAbrirCitacao?.();
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não achei o rascunho")));
  }, [rascunhoId]);

  function dadosDoRascunho() {
    return {
      titulo: titulo.trim() ? titulo : null,
      texto,
      forma: forma || null,
      idioma: idioma === OUTRA ? null : idioma,
    };
  }

  // Guarda sem publicar; o rascunho fica só para o autor (página Rascunhos).
  async function salvarRascunho() {
    if (!texto.trim()) {
      setErro("o poema não pode ficar vazio");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const salvoAgora =
        rascunho === null
          ? await criarRascunho({ ...dadosDoRascunho(), ...(citado !== null && { repost_de_id: citado }) })
          : await editarRascunho(rascunho, dadosDoRascunho());
      setRascunho(salvoAgora.id);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para salvar o rascunho"));
    } finally {
      setEnviando(false);
    }
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
      if (rascunho !== null) {
        await editarRascunho(rascunho, dadosDoRascunho());
        const publicado = await publicarRascunho(rascunho);
        router.push(`/poema/${publicado.id}`);
        return;
      }
      const novo = await publicarPoema({
        titulo: titulo.trim() ? titulo : null,
        texto,
        forma: forma || null,
        idioma: idioma === OUTRA ? null : idioma,
        ...(citado !== null && { repost_de_id: citado }),
      });
      router.push(`/poema/${novo.id}`);
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para publicar"));
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

      <div>
        <EditorDePoema
          valor={texto}
          aoMudar={(novo) => {
            setTexto(novo);
            setSalvo(false);
          }}
          rotulo={citacao ? "seu comentário sobre o poema" : "poema"}
          idRotulo={`${id}-rotulo`}
          idAjuda={`${id}-ajuda`}
          classe={campo}
          refEditavel={corpo}
          aoLado={<OficinaMarcas oficina={oficina} texto={texto} campo={corpo} />}
        />
        <span id={`${id}-ajuda`} className="mt-1 block text-xs text-tinta-suave">
          Quebras de linha e recuos ficam como você escreveu. Tab insere um recuo; Esc e depois
          Tab sai do campo. Para formatar, selecione o trecho.
        </span>
      </div>

      <OficinaPainel oficina={oficina} />

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

      {original && <PoemaCard post={original} aninhado semCritica />}
      {citadoRemovido && (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
          poema removido pelo autor
        </p>
      )}

      {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
      >
        {enviando ? "publicando..." : citacao ? "publicar citação" : "publicar"}
      </button>
      <button
        type="button"
        onClick={salvarRascunho}
        disabled={enviando}
        className="ml-3 min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-bold transition-colors duration-150 hover:border-destaque disabled:cursor-wait disabled:opacity-50"
      >
        salvar rascunho
      </button>
      {salvo && (
        <p role="status" className="text-sm text-tinta-suave">
          rascunho salvo. Só você vê; ele fica em <Link href="/rascunhos" className="underline">Rascunhos</Link>.
        </p>
      )}
    </form>
  );
}
