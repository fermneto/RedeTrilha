"use client";
// Explorar: os poemas de todos, mais novos primeiro, filtrados por forma e por tag.
// Os filtros moram na URL (?tag=&forma=): a busca da coluna direita, o "Em alta"
// e as #tags do PoemaCard trazem para cá já filtrado.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EmAlta } from "@/components/ColunaDireita";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { buscarExplorar, caminhoDoLogin, FORMAS, nomeDaForma, normalizarTag, temToken } from "@/lib/api";

// Espera da digitação antes de filtrar pela tag.
const ESPERA_DA_TAG_MS = 400;

const chip =
  "min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150";
const chipLigado = "bg-tinta text-papel hover:bg-tinta/85";
const chipDesligado = "border border-borda text-tinta hover:border-destaque hover:text-destaque";

// useSearchParams precisa de Suspense no build estático do Next.
export default function ExplorarPage() {
  return (
    <Suspense>
      <Explorar />
    </Suspense>
  );
}

function Explorar() {
  const router = useRouter();
  const params = useSearchParams();
  const tag = normalizarTag(params.get("tag") ?? "");
  const formaDaUrl = params.get("forma");
  const forma = formaDaUrl && (FORMAS as readonly string[]).includes(formaDaUrl) ? formaDaUrl : null;
  const idDaTag = useId();
  const idDasFormas = useId();
  const [termo, setTermo] = useState(tag);
  // Como na coluna direita: o "Em alta" é rota protegida, então só com login.
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    if (temToken()) setLogado(true);
    else router.replace(caminhoDoLogin());
  }, [router]);

  // A tag também muda por fora (busca da coluna direita, link de uma #tag). Se o
  // campo já equivale a ela (o que a pessoa digitou), fica como está.
  useEffect(() => {
    setTermo((atual) => (normalizarTag(atual) === tag ? atual : tag));
  }, [tag]);

  const filtrar = useCallback(
    (novaTag: string, novaForma: string | null) => {
      const busca = new URLSearchParams();
      if (novaTag) busca.set("tag", novaTag);
      if (novaForma) busca.set("forma", novaForma);
      const texto = busca.toString();
      router.replace(texto ? `/explorar?${texto}` : "/explorar", { scroll: false });
    },
    [router],
  );

  // Filtra enquanto a pessoa digita, depois de uma pausa; o Enter aplica na hora.
  useEffect(() => {
    const nova = normalizarTag(termo);
    if (nova === tag) return;
    const espera = setTimeout(() => filtrar(nova, forma), ESPERA_DA_TAG_MS);
    return () => clearTimeout(espera);
  }, [termo, tag, forma, filtrar]);

  function aplicarTag(e: React.FormEvent) {
    e.preventDefault();
    filtrar(normalizarTag(termo), forma);
  }

  const buscar = useCallback(
    (cursor: string | null) => buscarExplorar({ tag: tag || null, forma }, cursor),
    [tag, forma],
  );

  const comFiltro = Boolean(tag || forma);
  const limpar = (
    <button
      type="button"
      onClick={() => filtrar("", null)}
      className="min-h-11 cursor-pointer text-sm font-semibold text-destaque hover:underline"
    >
      limpar filtros
    </button>
  );

  return (
    <div>
      <CabecalhoPagina titulo="Explorar" />

      <div className="px-4 pt-4 empty:hidden min-[1100px]:hidden">
        {logado && <EmAlta />}
      </div>

      <div className="space-y-4 border-b border-borda px-4 py-4">
        <form role="search" aria-label="Filtrar por tag" onSubmit={aplicarTag}>
          <label htmlFor={idDaTag} className="block text-sm">
            tag
          </label>
          <div className="mt-1 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-borda bg-papel-alto px-3 transition-colors duration-150 focus-within:border-destaque focus-within:ring-2 focus-within:ring-destaque/25">
              <span aria-hidden="true" className="text-tinta-suave">
                #
              </span>
              <input
                id={idDaTag}
                type="search"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="saudade, mar, amor..."
                autoCapitalize="none"
                className="min-h-11 w-full min-w-0 bg-transparent pl-1 text-tinta outline-none"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 shrink-0 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110"
            >
              filtrar
            </button>
          </div>
        </form>

        <div>
          <p id={idDasFormas} className="text-sm">
            forma
          </p>
          <div role="group" aria-labelledby={idDasFormas} className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={forma === null}
              onClick={() => filtrar(tag, null)}
              className={`${chip} ${forma === null ? chipLigado : chipDesligado}`}
            >
              todas
            </button>
            {FORMAS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={forma === f}
                onClick={() => filtrar(tag, forma === f ? null : f)}
                className={`${chip} ${forma === f ? chipLigado : chipDesligado}`}
              >
                {nomeDoChip(f)}
              </button>
            ))}
          </div>
        </div>

        {comFiltro && limpar}
      </div>

      <ListaDePoemas
        key={`${tag}|${forma ?? ""}`}
        buscar={buscar}
        textoDoFim="fim dos poemas"
        vazio={
          <div className="px-4 py-10 text-center text-tinta-suave">
            <p>{textoDoVazio(tag, forma)}</p>
            {comFiltro && limpar}
          </div>
        }
      />
    </div>
  );
}

// No filtro, "outro" é o grupo das formas fora da lista.
function nomeDoChip(forma: string): string {
  return forma === "outro" ? "outras formas" : nomeDaForma(forma);
}

function textoDoVazio(tag: string, forma: string | null): string {
  if (!forma) return tag ? `Nenhum poema com #${tag}.` : "Ainda não há poemas.";
  const naForma = forma === "outro" ? "em outras formas" : `na forma ${nomeDaForma(forma)}`;
  return tag ? `Nenhum poema com #${tag} ${naForma}.` : `Nenhum poema ${naForma}.`;
}
