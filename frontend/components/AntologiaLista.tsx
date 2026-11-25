"use client";
// Lista de antologias (as de alguém no perfil, ou as públicas de todo mundo no
// Explorar): cada linha leva ao detalhe, com nome, descrição, quantos poemas, o
// selo "privada" e, no Explorar, quem reuniu.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EsqueletoDeAntologias } from "@/components/Esqueleto";
import { useEsperaMinima, useItensLiberados } from "@/hooks/useEsperaMinima";
import { mensagemDeFalha, type Antologia, type Page } from "@/lib/api";

type Props = {
  // Busca uma página a partir do offset. Para trocar de lista, remonte com outra `key`.
  buscar: (offset: number) => Promise<Page<Antologia>>;
  // O que mostrar quando não há nenhuma antologia.
  vazio: React.ReactNode;
  // No Explorar, as antologias são de várias pessoas: a linha diz de quem.
  comDono?: boolean;
};

export function AntologiaLista({ buscar, vazio, comDono = false }: Props) {
  const [antologias, setAntologias] = useState<Antologia[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (offset: number) => {
      setCarregando(true);
      try {
        const pagina = await buscar(offset);
        setAntologias((atuais) => {
          const vistas = new Set(atuais.map((a) => a.id));
          return [...atuais, ...pagina.items.filter((a) => !vistas.has(a.id))];
        });
        setTotal(pagina.total);
        setErro(null);
      } catch (e) {
        setErro(mensagemDeFalha(e, "não deu para carregar as antologias"));
      } finally {
        setCarregando(false);
      }
    },
    [buscar],
  );

  useEffect(() => {
    carregar(0);
  }, [carregar]);

  const faltam = total !== null && antologias.length < total;
  // O esqueleto fica pelo menos 500 ms; as antologias novas esperam por ele.
  const esperando = useEsperaMinima(carregando);
  const visiveis = useItensLiberados(antologias, esperando, chaveDaAntologia);

  return (
    <div>
      {erro && (
        <div role="alert" className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => carregar(antologias.length)}
            className="mt-1 min-h-11 cursor-pointer underline"
          >
            tentar de novo
          </button>
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="divide-y divide-borda border-b border-borda">
          {visiveis.map((a) => (
            <li key={a.id} className="surgir">
              <AntologiaItem antologia={a} comDono={comDono} />
            </li>
          ))}
        </ul>
      )}

      {total === 0 && antologias.length === 0 && !esperando && vazio}

      {esperando && <EsqueletoDeAntologias quantos={visiveis.length === 0 ? 4 : 2} comDono={comDono} />}

      {faltam && !esperando && !erro && (
        <div className="py-4 text-center">
          <button
            type="button"
            onClick={() => carregar(antologias.length)}
            className="min-h-11 cursor-pointer text-sm text-tinta-suave underline hover:text-tinta"
          >
            carregar mais antologias
          </button>
        </div>
      )}
    </div>
  );
}

function chaveDaAntologia(antologia: Antologia): number {
  return antologia.id;
}

// Como a lombada de um livro na estante: o nome em serifa, quantos poemas
// alinhado à direita (fácil de varrer de cima a baixo) e a descrição por baixo.
function AntologiaItem({ antologia, comDono }: { antologia: Antologia; comDono: boolean }) {
  return (
    <Link href={`/antologias/${antologia.id}`} className="realce group block px-4 py-4">
      <span className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1">
          <span className="font-serifada text-[1.1875rem] leading-snug font-semibold break-words group-hover:underline">
            {antologia.nome}
          </span>
          {!antologia.publica && (
            <span className="ml-2 inline-block align-[0.125rem]">
              <SeloPrivada />
            </span>
          )}
        </span>
        <span className="shrink-0 text-[0.8125rem] text-tinta-suave tabular-nums">
          {antologia.qtd === 0 ? "vazia" : `${antologia.qtd} ${antologia.qtd === 1 ? "poema" : "poemas"}`}
        </span>
      </span>
      {comDono && (
        <span className="mt-0.5 block truncate text-sm text-tinta-suave">
          reunida por <span className="font-semibold text-tinta">{antologia.dono.name}</span>
        </span>
      )}
      {antologia.descricao && (
        <span className="mt-1 line-clamp-2 block max-w-[60ch] font-serifada text-[0.9375rem] break-words whitespace-pre-wrap text-tinta-suave italic">
          {antologia.descricao}
        </span>
      )}
    </Link>
  );
}

// Etiqueta da antologia privada (só o dono a vê, então só ele vê a etiqueta).
export function SeloPrivada() {
  return (
    <span className="rounded-full border border-borda px-2 text-xs leading-5 text-tinta-suave">
      privada
    </span>
  );
}
