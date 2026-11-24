"use client";
// "Rascunhos": os poemas guardados e ainda não publicados. Só o autor os vê.
// Abrir leva ao compositor com o rascunho carregado; de lá ele é publicado.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import {
  apagarRascunho,
  caminhoDoLogin,
  formatarData,
  listarRascunhos,
  nomeDaForma,
  temToken,
  type Rascunho,
} from "@/lib/api";

// Quantos versos do começo aparecem na lista.
const VERSOS_NA_PREVIA = 3;

export default function RascunhosPage() {
  const router = useRouter();
  const [rascunhos, setRascunhos] = useState<Rascunho[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    listarRascunhos()
      .then((pagina) => setRascunhos(pagina.items))
      .catch((e) => setErro(e instanceof Error ? e.message : "não deu para carregar os rascunhos"));
  }, [router]);

  async function apagar(rascunho: Rascunho) {
    if (!window.confirm("Apagar este rascunho? Não dá para desfazer.")) return;
    setErro(null);
    try {
      await apagarRascunho(rascunho.id);
      setRascunhos((atuais) => (atuais ?? []).filter((r) => r.id !== rascunho.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para apagar o rascunho");
    }
  }

  return (
    <div>
      <CabecalhoPagina titulo="Rascunhos" />
      <p className="border-b border-borda px-4 py-4 text-sm text-tinta-suave">
        Poemas guardados e ainda não publicados. Só você vê.
      </p>
      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      {rascunhos === null && !erro && <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>}
      {rascunhos?.length === 0 && (
        <p className="px-4 py-8 text-sm text-tinta-suave">
          Nenhum rascunho. No{" "}
          <Link href="/escrever" className="text-destaque hover:underline">
            compositor
          </Link>
          , &quot;salvar rascunho&quot; guarda o poema sem publicar.
        </p>
      )}
      <ul>
        {rascunhos?.map((rascunho) => (
          <li key={rascunho.id} className="border-b border-borda px-4 py-4">
            {rascunho.titulo && <p className="poema-titulo">{rascunho.titulo}</p>}
            <p className={`poema-corpo ${rascunho.titulo ? "mt-2" : ""}`}>
              {rascunho.texto.split("\n").slice(0, VERSOS_NA_PREVIA).join("\n")}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-[0.8125rem] text-tinta-suave">
              <span>salvo em {formatarData(rascunho.updated_at)}</span>
              {rascunho.forma && <span className="italic">{nomeDaForma(rascunho.forma)}</span>}
              {(rascunho.repost_de_id !== null || rascunho.repost_removido) && <span>citação</span>}
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                href={`/escrever?rascunho=${rascunho.id}`}
                className="inline-flex min-h-11 items-center rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110"
              >
                abrir
              </Link>
              <button
                type="button"
                onClick={() => apagar(rascunho)}
                className="min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm font-bold transition-colors duration-150 hover:border-destaque"
              >
                apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
