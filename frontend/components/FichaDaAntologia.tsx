"use client";
// A página da direita da antologia: a ficha (quem reuniu, quando, quantos
// poemas) e as outras antologias da mesma pessoa, como a orelha de um livro.
// A antologia não tem curtidas nem comentários: a página fica só com isso.
// As outras vêm de GET /usuarios/{username}/antologias (as públicas da pessoa,
// e as privadas só para o próprio dono, como no perfil).

import Link from "next/link";
import { useEffect, useState } from "react";

import { SeloPrivada } from "@/components/AntologiaLista";
import { Avatar } from "@/components/Avatar";
import { NomeAutor } from "@/components/NomeAutor";
import { formatarDataPorExtenso, listarAntologiasDe, type Antologia } from "@/lib/api";

// Quantas outras antologias a ficha lista antes do "ver todas".
const OUTRAS = 5;

export function FichaDaAntologia({ antologia }: { antologia: Antologia }) {
  const { dono } = antologia;
  // null enquanto carrega (ou se a rota falha): o bloco das outras não aparece.
  const [outras, setOutras] = useState<{ items: Antologia[]; mais: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    // Uma a mais que o mostrado: a atual sai da lista.
    listarAntologiasDe(dono.username, 0, OUTRAS + 1)
      .then((pagina) => {
        if (!vivo) return;
        const items = pagina.items.filter((a) => a.id !== antologia.id);
        setOutras({ items: items.slice(0, OUTRAS), mais: pagina.total - 1 > OUTRAS });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [dono.username, antologia.id]);

  const termo = "text-xs text-tinta-suave";
  return (
    <aside aria-label="sobre a antologia" className="px-(--recuo-da-folha) pt-10 pb-6">
      <dl className="space-y-5 px-4">
        <div>
          <dt className={termo}>reunida por</dt>
          <dd className="mt-2 flex items-center gap-3">
            <Avatar usuario={dono} />
            <span className="min-w-0 leading-tight">
              <NomeAutor usuario={dono} className="text-[0.9375rem] font-bold text-tinta" />
              <span className="block truncate text-[0.8125rem] text-tinta-suave">@{dono.username}</span>
            </span>
          </dd>
        </div>
        <div className="flex gap-10">
          <div>
            <dt className={termo}>criada em</dt>
            <dd className="mt-1 text-sm">
              <time dateTime={antologia.created_at}>{formatarDataPorExtenso(antologia.created_at)}</time>
            </dd>
          </div>
          <div>
            <dt className={termo}>reúne</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {antologia.qtd} {antologia.qtd === 1 ? "poema" : "poemas"}
            </dd>
          </div>
        </div>
        {!antologia.publica && (
          <div>
            <dt className="sr-only">visibilidade</dt>
            <dd>
              <SeloPrivada />
            </dd>
          </div>
        )}
      </dl>

      {outras && outras.items.length > 0 && (
        <section aria-labelledby="outras-antologias" className="linha-da-folha mt-10 border-t border-borda/70 pt-5">
          <h2 id="outras-antologias" className="text-sm font-bold">
            Outras antologias de {dono.name}
          </h2>
          <ul className="mt-2">
            {outras.items.map((a) => (
              <li key={a.id}>
                <Link href={`/antologias/${a.id}`} className="group realce -mx-2 block rounded-lg px-2 py-2.5">
                  <span className="block font-serifada font-semibold break-words group-hover:underline">{a.nome}</span>
                  <span className="block text-[0.8125rem] text-tinta-suave tabular-nums">
                    {a.qtd} {a.qtd === 1 ? "poema" : "poemas"}
                    {!a.publica && " · privada"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {outras.mais && (
            <Link
              href={`/u/${dono.username}?aba=antologias`}
              className="mt-1 inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-destaque hover:underline"
            >
              todas as antologias de {dono.name}
            </Link>
          )}
        </section>
      )}
    </aside>
  );
}
