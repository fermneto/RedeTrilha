"use client";
// Cartão de um poeta no Acervo. O cartão inteiro leva ao perfil: o link do nome se
// estica sobre ele (after:absolute), e o botão Seguir fica por cima (relative z-10),
// sem um link dentro do outro.

import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { NomeAutor } from "@/components/NomeAutor";
import { anosDeVida, seguir, type PoetaDoAcervo } from "@/lib/api";

type Props = {
  poeta: PoetaDoAcervo;
  // O próprio perfil não tem o botão Seguir.
  proprio: boolean;
};

export function CartaoDoAcervo({ poeta: inicial, proprio }: Props) {
  const [poeta, setPoeta] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const vida = anosDeVida(poeta);

  // Otimista, como no PerfilCabecalho: muda o botão e o contador antes da
  // resposta e volta atrás se falhar.
  async function alternarSeguir() {
    const antes = poeta;
    const novo = !poeta.sigo;
    setPoeta({ ...poeta, sigo: novo, seguidores: poeta.seguidores + (novo ? 1 : -1) });
    setErro(false);
    setEnviando(true);
    try {
      await seguir(poeta.username, novo);
    } catch {
      setPoeta(antes);
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="realce relative flex h-full flex-col gap-3 rounded-2xl border border-borda bg-papel-alto p-4">
      <div className="flex items-start gap-3">
        <Avatar usuario={poeta} tamanho="m" />
        <div className="min-w-0 flex-1">
          <h2 className="flex text-[0.9375rem] leading-snug">
            <NomeAutor
              usuario={poeta}
              className="font-bold after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            />
          </h2>
          <p className="truncate text-sm text-tinta-suave">@{poeta.username}</p>
        </div>
      </div>

      {poeta.consagrado
        ? vida && <p className="text-sm text-tinta-suave tabular-nums">{vida}</p>
        : poeta.bio && <p className="line-clamp-2 text-sm break-words">{poeta.bio}</p>}

      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          {erro ? (
            <span className="text-destaque">não deu, tente de novo</span>
          ) : (
            <>
              <Numero n={poeta.poemas} singular="poema" plural="poemas" /> ·{" "}
              <Numero n={poeta.seguidores} singular="seguidor" plural="seguidores" />
            </>
          )}
        </p>
        {!proprio && (
          <button
            type="button"
            onClick={alternarSeguir}
            disabled={enviando}
            aria-pressed={poeta.sigo}
            aria-label={`Seguir ${poeta.name}`}
            className={`relative z-10 min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 ${
              poeta.sigo
                ? "border border-borda bg-papel-alto text-tinta hover:border-destaque hover:text-destaque"
                : "bg-tinta text-papel hover:bg-tinta/85"
            }`}
          >
            {poeta.sigo ? "Seguindo" : "Seguir"}
          </button>
        )}
      </div>
    </article>
  );
}

function Numero({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return (
    <>
      <span className="font-medium text-tinta tabular-nums">{n}</span> {n === 1 ? singular : plural}
    </>
  );
}
