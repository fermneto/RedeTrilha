"use client";
// Lista de antologias (as minhas, ou as públicas de alguém no perfil): cada
// linha leva ao detalhe, com nome, descrição, quantos poemas e o selo "privada".

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { IconeAntologias } from "@/components/icones/IconeAntologias";
import { mensagemDeFalha, type Antologia, type Page } from "@/lib/api";

type Props = {
  // Busca uma página a partir do offset. Para trocar de lista, remonte com outra `key`.
  buscar: (offset: number) => Promise<Page<Antologia>>;
  // O que mostrar quando não há nenhuma antologia.
  vazio: React.ReactNode;
  // Antologias criadas agora há pouco, que entram no topo sem recarregar.
  novas?: Antologia[];
};

export function AntologiaLista({ buscar, vazio, novas = [] }: Props) {
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

  const idsNovas = new Set(novas.map((a) => a.id));
  const visiveis = [...novas, ...antologias.filter((a) => !idsNovas.has(a.id))];
  const faltam = total !== null && antologias.length < total;

  return (
    <div>
      {erro && (
        <div className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => carregar(antologias.length)}
            className="mt-1 cursor-pointer underline"
          >
            tentar de novo
          </button>
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="divide-y divide-borda border-b border-borda">
          {visiveis.map((a) => (
            <li key={a.id}>
              <AntologiaItem antologia={a} />
            </li>
          ))}
        </ul>
      )}

      {total === 0 && visiveis.length === 0 && vazio}

      {carregando && <p className="py-8 text-center text-sm text-tinta-suave">carregando...</p>}

      {faltam && !carregando && !erro && (
        <div className="py-4 text-center">
          <button
            type="button"
            onClick={() => carregar(antologias.length)}
            className="cursor-pointer text-sm text-tinta-suave underline hover:text-tinta"
          >
            carregar mais antologias
          </button>
        </div>
      )}
    </div>
  );
}

function AntologiaItem({ antologia }: { antologia: Antologia }) {
  return (
    <Link href={`/antologias/${antologia.id}`} className="realce flex gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-painel text-tinta-suave"
      >
        <IconeAntologias className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-serifada text-[1.0625rem] font-semibold break-words">{antologia.nome}</span>
          {!antologia.publica && <SeloPrivada />}
        </span>
        {antologia.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-sm break-words whitespace-pre-wrap text-tinta-suave">
            {antologia.descricao}
          </span>
        )}
        <span className="mt-1 block text-[0.8125rem] text-tinta-suave tabular-nums">
          {antologia.qtd} {antologia.qtd === 1 ? "poema" : "poemas"}
        </span>
      </span>
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
