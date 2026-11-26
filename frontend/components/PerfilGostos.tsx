"use client";
// Os gostos da pessoa na página da esquerda do perfil: as escolas, as formas e o
// lugar que ela marcou no onboarding (públicos, GET /usuarios/{username}/gostos).
// Os rótulos das escolas e das UFs vêm de /preferencias/opcoes; os das formas, de
// nomeDaForma; o país, do Intl. Nada marcado (ou consagrado, que não tem
// preferências): não mostra nada. No próprio perfil, o link para editar.

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  buscarGostosDe,
  buscarOpcoesDePreferencias,
  caminhoDasPreferencias,
  lugarDosGostos,
  nomeDaForma,
  semGostos,
} from "@/lib/api";

type Linha = { rotulo: string; valor: string };

type Props = { username: string; proprio: boolean };

export function PerfilGostos({ username, proprio }: Props) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setLinhas(null);
    buscarGostosDe(username)
      .then(async (gostos) => {
        if (semGostos(gostos)) return [];
        const opcoes = await buscarOpcoesDePreferencias();
        const escola = new Map(opcoes.escolas.map((o) => [o.codigo, o.rotulo]));
        const lugar = lugarDosGostos(gostos, opcoes.ufs);
        const todas: (Linha | null)[] = [
          gostos.escolas.length
            ? { rotulo: "escolas", valor: gostos.escolas.map((c) => escola.get(c) ?? c).join(" · ") }
            : null,
          gostos.formas.length ? { rotulo: "formas", valor: gostos.formas.map(nomeDaForma).join(" · ") } : null,
          lugar ? { rotulo: "de", valor: lugar } : null,
        ];
        return todas.filter((l): l is Linha => l !== null);
      })
      .then((l) => vivo && setLinhas(l))
      // Os gostos são um extra do perfil: se falharem, o bloco só não aparece.
      .catch(() => vivo && setLinhas([]));
    return () => {
      vivo = false;
    };
  }, [username]);

  if (!linhas || linhas.length === 0) return null;

  return (
    <section aria-labelledby="gostos-do-perfil" className="surgir border-t border-borda pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="gostos-do-perfil" className="font-serifada text-lg">
          Gostos
        </h2>
        {proprio && (
          <Link
            href={caminhoDasPreferencias(`/u/${username}`, username)}
            className="-my-3 inline-flex min-h-11 items-center text-sm text-tinta-suave underline-offset-4 hover:text-destaque hover:underline"
          >
            Editar gostos
          </Link>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5">
        {linhas.map((l) => (
          <div key={l.rotulo} className="contents">
            <dt className="text-sm text-tinta-suave">{l.rotulo}</dt>
            <dd className="font-serifada break-words">{l.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
