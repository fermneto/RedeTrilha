"use client";
// Os gostos da pessoa na página da esquerda do perfil: as escolas, as formas e o
// lugar que ela marcou no onboarding (públicos, GET /usuarios/{username}/gostos).
// Os rótulos das escolas, das formas e das UFs vêm de /preferencias/opcoes; o
// país, do Intl. Cada forma leva aos poemas dela no Explorar; a
// forma "outro" fica de fora. O lugar some para os outros se a pessoa desligou
// "mostrar meu lugar no perfil" (o backend já tira). Nada a mostrar (ou consagrado, que não tem
// preferências): o bloco não aparece; no próprio perfil, fica o convite para
// marcar os gostos. No próprio perfil com gostos, o link para editar.

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import {
  buscarGostosDe,
  buscarOpcoesDePreferencias,
  caminhoDaForma,
  caminhoDasPreferencias,
  formasDoPerfil,
  lugarDosGostos,
  type Opcao,
} from "@/lib/api";
import { nomeDaForma } from "@/lib/vocabulario";

type Gostos = {
  escolas: string[];
  formas: Opcao[];
  lugar: string | null;
};

type Props = { username: string; proprio: boolean };

const LINK_DA_FORMA = "underline decoration-borda underline-offset-4 hover:text-destaque hover:decoration-destaque";

export function PerfilGostos({ username, proprio }: Props) {
  const [gostos, setGostos] = useState<Gostos | null>(null);

  useEffect(() => {
    let vivo = true;
    setGostos(null);
    Promise.all([buscarGostosDe(username), buscarOpcoesDePreferencias()])
      .then(([g, opcoes]) => {
        const escola = new Map(opcoes.escolas.map((o) => [o.codigo, o.rotulo]));
        const forma = new Map(opcoes.formas_com_rotulo.map((o) => [o.codigo, o.rotulo]));
        return {
          escolas: g.escolas.map((c) => escola.get(c) ?? c),
          formas: formasDoPerfil(g.formas).map((c) => ({ codigo: c, rotulo: forma.get(c) ?? nomeDaForma(c) })),
          lugar: lugarDosGostos(g, opcoes.ufs),
        };
      })
      .then((g) => vivo && setGostos(g))
      // Os gostos são um extra do perfil: se falharem, o bloco só não aparece.
      .catch(() => vivo && setGostos({ escolas: [], formas: [], lugar: null }));
    return () => {
      vivo = false;
    };
  }, [username]);

  if (!gostos) return null;
  const preferencias = caminhoDasPreferencias(`/u/${username}`, username);
  const vazio = gostos.escolas.length === 0 && gostos.formas.length === 0 && !gostos.lugar;

  if (vazio)
    return proprio ? (
      <p className="surgir border-t border-borda pt-3 text-sm">
        <Link
          href={preferencias}
          className="inline-flex min-h-11 items-center text-tinta-suave underline-offset-4 hover:text-destaque hover:underline"
        >
          marcar seus gostos
        </Link>
      </p>
    ) : null;

  return (
    <section aria-labelledby="gostos-do-perfil" className="surgir border-t border-borda pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="gostos-do-perfil" className="font-serifada text-lg">
          Gostos
        </h2>
        {proprio && (
          <Link
            href={preferencias}
            className="-my-3 inline-flex min-h-11 items-center text-sm text-tinta-suave underline-offset-4 hover:text-destaque hover:underline"
          >
            Editar gostos
          </Link>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5">
        {gostos.escolas.length > 0 && (
          <>
            <dt className="text-sm text-tinta-suave">escolas</dt>
            <dd className="font-serifada break-words">{gostos.escolas.join(" · ")}</dd>
          </>
        )}
        {gostos.formas.length > 0 && (
          <>
            <dt className="text-sm text-tinta-suave">formas</dt>
            <dd className="font-serifada break-words">
              {gostos.formas.map((f, i) => (
                <Fragment key={f.codigo}>
                  {i > 0 && " · "}
                  <Link href={caminhoDaForma(f.codigo)} className={LINK_DA_FORMA}>
                    {f.rotulo}
                  </Link>
                </Fragment>
              ))}
            </dd>
          </>
        )}
        {gostos.lugar && (
          <>
            <dt className="text-sm text-tinta-suave">de</dt>
            <dd className="font-serifada break-words">{gostos.lugar}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
