"use client";
// Histórico de versões de um poema: só o autor chega aqui (para os outros, o
// backend responde 404). Cada versão anterior pode ser lida inteira ou comparada
// verso a verso com a atual.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { compararVersos } from "@/lib/compararVersos";
import {
  buscarPoema,
  caminhoDoLogin,
  ErroDaApi,
  formatarData,
  listarVersoes,
  nomeDaForma,
  temToken,
  type Post,
  type VersaoDoPoema,
} from "@/lib/api";

export default function VersoesPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [poema, setPoema] = useState<Post | null>(null);
  const [versoes, setVersoes] = useState<VersaoDoPoema[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    Promise.all([buscarPoema(id), listarVersoes(id)])
      .then(([atual, pagina]) => {
        setPoema(atual);
        setVersoes(pagina.items);
      })
      .catch((e) =>
        setErro(
          e instanceof ErroDaApi && e.status === 404
            ? "histórico não encontrado"
            : e instanceof Error
              ? e.message
              : "não deu para carregar as versões",
        ),
      );
  }, [id, router]);

  return (
    <div>
      <CabecalhoPagina titulo="Versões do poema" />
      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      {!erro && (!poema || !versoes) && <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>}
      {poema && versoes && (
        <>
          <p className="border-b border-borda px-4 py-4 text-sm text-tinta-suave">
            Só você vê este histórico. Os leitores veem a versão atual, marcada como editada.{" "}
            <Link href={`/poema/${poema.id}`} className="text-destaque hover:underline">
              voltar ao poema
            </Link>
          </p>
          {versoes.length === 0 && (
            <p className="px-4 py-8 text-sm text-tinta-suave">Este poema não foi editado.</p>
          )}
          <ol>
            {versoes.map((versao) => (
              <Versao key={versao.id} versao={versao} atual={poema} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Versao({ versao, atual }: { versao: VersaoDoPoema; atual: Post }) {
  const [comparando, setComparando] = useState(false);
  return (
    <li className="border-b border-borda px-4 py-4">
      <p className="flex flex-wrap items-center gap-x-3 text-[0.8125rem] text-tinta-suave">
        <span>
          substituída em <time dateTime={versao.criada_em}>{formatarData(versao.criada_em)}</time>
        </span>
        {versao.forma && <span className="italic">{nomeDaForma(versao.forma)}</span>}
        <button
          type="button"
          onClick={() => setComparando((c) => !c)}
          aria-pressed={comparando}
          className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-destaque hover:underline"
        >
          {comparando ? "ler esta versão" : "comparar com a atual"}
        </button>
      </p>
      {versao.titulo && <p className="poema-titulo mt-1">{versao.titulo}</p>}
      {comparando ? (
        <Comparacao anterior={versao.texto} atual={atual.texto} />
      ) : (
        <p className="poema-corpo mt-2">{versao.texto}</p>
      )}
    </li>
  );
}

// Verso que saiu riscado, verso que entrou realçado; o sinal na margem também
// diz a diferença para quem não distingue as cores.
function Comparacao({ anterior, atual }: { anterior: string; atual: string }) {
  const sinal = { igual: " ", saiu: "−", entrou: "+" } as const;
  return (
    <div className="poema-corpo mt-2" aria-label="comparação com a versão atual">
      {compararVersos(anterior, atual).map((linha, i) => (
        <div
          key={i}
          className={
            linha.tipo === "saiu"
              ? "text-tinta-suave line-through"
              : linha.tipo === "entrou"
                ? "bg-destaque/10"
                : ""
          }
        >
          <span aria-hidden="true" className="mr-2 inline-block w-3 select-none">
            {sinal[linha.tipo]}
          </span>
          <span className="sr-only">{linha.tipo === "igual" ? "" : linha.tipo === "saiu" ? "saiu: " : "entrou: "}</span>
          {linha.verso || " "}
        </div>
      ))}
    </div>
  );
}
