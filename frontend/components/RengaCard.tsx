"use client";
// Renga no feed e no perfil, como um repost no X: o rótulo diz quem abriu ou
// escreveu, e o card mostra o começo da renga. Aberta, convida a escrever (ou diz
// por que não dá); fechada, é um poema de todos os autores.
// Selecionar versos das estrofes mostra a barra "comentar estes versos / limpar",
// como no PoemaCard (sem "citar": a citação cita poemas), e leva à página da
// renga com ?versos=. Os números contam a renga inteira (textoDaRenga), mesmo com
// só as primeiras estrofes no card.

import Link from "next/link";
import { Fragment, useRef } from "react";

import { BarraDeVersos, useVersosSelecionados } from "@/components/BarraDeVersos";
import { NomeAutor } from "@/components/NomeAutor";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import { VersoFormatado } from "@/components/TextoFormatado";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeRenga } from "@/components/icones/IconeRenga";
import {
  caminhoDaCriticaNaRenga,
  fimDasEstrofes,
  textoDaRenga,
  versosDoPoema,
  type RengaNoFeed,
  type User,
} from "@/lib/api";

// Fora da página da renga, só as primeiras estrofes, com link para o resto.
const ESTROFES_NO_FEED = 4;

export function RengaCard({ item }: { item: RengaNoFeed }) {
  const { renga } = item;
  const estrofes = renga.estrofes.slice(0, ESTROFES_NO_FEED);
  const faltam = renga.estrofes.length - estrofes.length;
  const link = `/rengas/${renga.id}`;
  const texto = textoDaRenga(renga.estrofes);
  const fins = fimDasEstrofes(renga.estrofes);
  const lista = useRef<HTMLOListElement>(null);
  const { selecao, limpar, barra } = useVersosSelecionados(lista, texto, true);

  return (
    <article className="px-4 pt-3 pb-4">
      <Rotulo atividade={item.atividade} por={item.por} />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link href={link} className="poema-titulo break-words hover:underline">
          {renga.titulo}
        </Link>
        <SeloDaRenga fechada={renga.fechada} />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
        <span>{renga.fechada ? "um poema de" : "escrita por"}</span>
        {renga.autores.map((autor, i) => (
          <span key={autor.id} className="inline-flex items-center">
            <NomeAutor usuario={autor} className="font-semibold text-tinta" />
            {i < renga.autores.length - 1 && <span aria-hidden="true">,</span>}
          </span>
        ))}
      </p>

      <ol ref={lista} aria-label="estrofes" className="mt-3 space-y-5">
        {estrofes.map((e, i) => (
          <li key={e.id}>
            <p className="poema-corpo">
              {versosDoPoema(e.texto).map((linha, j, linhas) => (
                <Fragment key={j}>
                  {j > 0 && "\n"}
                  <span data-verso={fins[i] - linhas.length + 1 + j}>
                    <VersoFormatado linha={linha} />
                  </span>
                </Fragment>
              ))}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-tinta-suave">
              <span aria-hidden="true">— </span>
              <span className="sr-only">estrofe de </span>
              <NomeAutor usuario={e.autor} className="font-semibold" />
            </p>
          </li>
        ))}
      </ol>
      {selecao && (
        <BarraDeVersos
          selecao={selecao}
          barra={barra}
          caminhoDaCritica={caminhoDaCriticaNaRenga(renga.id, selecao)}
          caminhoDaCitacao={null}
          aoLimpar={limpar}
        />
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm">
        {faltam > 0 && (
          <Link href={link} className="inline-flex min-h-11 items-center font-semibold text-destaque hover:underline">
            ver as outras {faltam} {faltam === 1 ? "estrofe" : "estrofes"}
          </Link>
        )}
        {!renga.fechada &&
          (renga.posso_escrever ? (
            <Link href={link} className="inline-flex min-h-11 items-center font-semibold text-destaque hover:underline">
              escrever a próxima estrofe
            </Link>
          ) : (
            <span className="text-tinta-suave">{renga.motivo}</span>
          ))}
        <span className="text-xs text-tinta-suave tabular-nums">
          {renga.qtd_estrofes} de {renga.limite} estrofes
        </span>
        <Link
          href={`${link}#comentarios`}
          aria-label={renga.comentarios ? `comentar (${renga.comentarios})` : "comentar"}
          title="comentar"
          className="inline-flex min-h-11 min-w-11 items-center gap-1 text-[0.8125rem] text-tinta-suave tabular-nums transition-colors duration-150 hover:text-destaque"
        >
          <IconeComentar className="h-5 w-5" />
          {renga.comentarios > 0 && <span aria-hidden="true">{renga.comentarios}</span>}
        </Link>
      </p>
    </article>
  );
}

const VERBOS: Record<RengaNoFeed["atividade"], [string, string]> = {
  abriu: ["abriu uma renga", "abriram uma renga"],
  escreveu: ["escreveu uma estrofe", "escreveram estrofes"],
  encerrou: ["encerrou a renga", "encerraram a renga"],
};

// "ana escreveu uma estrofe", "ana e bia escreveram estrofes", "bia abriu uma renga",
// "bia encerrou a renga".
function Rotulo({ atividade, por }: { atividade: RengaNoFeed["atividade"]; por: User[] }) {
  const [a, b] = por;
  const resto = por.length - 2;
  const [singular, plural] = VERBOS[atividade];
  const verbo = por.length > 1 ? plural : singular;
  return (
    <p className="mb-1 flex items-center gap-2 text-[0.8125rem] font-semibold text-tinta-suave">
      <IconeRenga className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        {a && <NomeLink usuario={a} />}
        {b && (resto > 0 ? ", " : " e ")}
        {b && <NomeLink usuario={b} />}
        {resto > 0 && ` e mais ${resto}`} {verbo}
      </span>
    </p>
  );
}

function NomeLink({ usuario }: { usuario: User }) {
  return (
    <Link href={`/u/${usuario.username}`} className="hover:underline">
      {usuario.username}
    </Link>
  );
}
