"use client";
// O poema no livro, em página dupla: na esquerda, quem escreveu (a faixa do
// autor, com o "Seguir"), o poema e a ficha (forma, obra, tags); na direita, a
// conversa: os contadores, as ações (curtir, repostar, citar, comentar, guardar
// numa antologia, enviar), os comentários em fio e o campo de comentar no pé.
// Usado pelo feed, uma folha por item, e pela página do poema.

import Link from "next/link";
import { useRef, type ReactNode } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import type { Folha } from "@/components/CadernoFolhas";
import { Acoes, PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeRenga } from "@/components/icones/IconeRenga";
import { chaveDoItem, ehRenga, textoDaRenga, type ItemDoFeed, type Post, type RengaDetalhe } from "@/lib/api";

// As margens de cada página: largas como as de um caderno, menores no celular.
export const MARGEM_DA_PAGINA = "px-6 pt-8 pb-4 sm:px-10 lg:px-14 lg:pt-12";

// O que um repost puro mostra e recebe: o original.
export function poemaDe(post: Post): Post {
  return post.repost_de !== null && post.texto === "" && post.repost_de ? post.repost_de : post;
}

export function rotuloDoPoema(post: Post): string {
  const poema = poemaDe(post);
  return `${poema.titulo ?? "poema sem título"}, de ${poema.autor.name}`;
}

// A página da conversa: as margens do livro, mas sem a de baixo, para o campo
// de comentar encostar no pé da página.
export const MARGEM_DA_CONVERSA = "flex min-h-full flex-col px-6 pt-5 sm:px-10 lg:px-14 lg:pt-9";

// A página da direita: os contadores e as ações no alto, a conversa embaixo.
// As ações ficam presas no topo da página enquanto a conversa rola, para curtir,
// repostar e comentar estarem sempre à mão.
export function VersoDoPoema({ poema, comentarios }: { poema: Post; comentarios: ReactNode }) {
  return (
    <div className={MARGEM_DA_CONVERSA}>
      <div className="acoes-presas sticky top-0 z-10 border-b border-borda/70 pt-3 pb-3">
        <Acoes key={poema.id} poema={poema} contadores />
      </div>
      <div className="mt-6 flex flex-1 flex-col">{comentarios}</div>
    </div>
  );
}

const BOTAO_DA_RENGA =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 -ml-3 font-semibold transition-colors duration-150 hover:bg-tinta/5 hover:text-destaque";

// A página da direita de uma renga. Renga não se curte nem se reposta (o backend
// só tem comentários para ela), então a barra presa no topo traz o que existe:
// estrofes e comentários contados, escrever a próxima estrofe e comentar.
function ConversaDaRenga({ renga, comentarios }: { renga: RengaDetalhe; comentarios: ReactNode }) {
  const pagina = useRef<HTMLDivElement>(null);
  const link = `/rengas/${renga.id}`;
  function comentar() {
    pagina.current?.querySelector<HTMLTextAreaElement>("#comentarios textarea")?.focus();
  }
  return (
    <div ref={pagina} className={MARGEM_DA_CONVERSA}>
      <div className="acoes-presas sticky top-0 z-10 border-b border-borda/70 pt-3 pb-2">
        <p className="mb-1 flex flex-wrap gap-x-4 text-sm text-tinta-suave tabular-nums">
          <span>
            <strong className="font-semibold text-tinta">{renga.qtd_estrofes}</strong> de {renga.limite} estrofes
          </span>
          <span>
            <strong className="font-semibold text-tinta">{renga.comentarios}</strong>{" "}
            {renga.comentarios === 1 ? "comentário" : "comentários"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 text-sm">
          {!renga.fechada && renga.posso_escrever && (
            <Link href={link} className={`${BOTAO_DA_RENGA} text-destaque`}>
              <IconeRenga className="h-[1.125rem] w-[1.125rem]" />
              escrever a próxima estrofe
            </Link>
          )}
          <button type="button" onClick={comentar} className={`${BOTAO_DA_RENGA} text-tinta-suave`}>
            <IconeComentar className="h-[1.125rem] w-[1.125rem]" />
            comentar
          </button>
          <Link href={link} className={`${BOTAO_DA_RENGA} text-tinta-suave`}>
            abrir a renga
          </Link>
        </div>
      </div>
      <div className="mt-6 flex flex-1 flex-col">{comentarios}</div>
    </div>
  );
}

const nada = () => undefined;

// Uma folha do feed. `topo` é o que vai acima do poema na página da esquerda
// (a troca entre "Para você" e "Seguindo").
export function folhaDoItem(item: ItemDoFeed, euId: number | null, topo: ReactNode): Folha {
  const chave = chaveDoItem(item);
  if (ehRenga(item)) {
    const { renga } = item;
    return {
      chave,
      rotulo: `renga ${renga.titulo}`,
      rotuloDaDireita: `comentários da renga ${renga.titulo}`,
      esquerda: (
        <div className="pb-4">
          {topo}
          <div className="px-2 pt-4 sm:px-6 lg:px-10 lg:pt-8">
            <RengaCard item={item} />
          </div>
        </div>
      ),
      direita: (
        <ConversaDaRenga
          renga={renga}
          comentarios={
            <ArvoreComentarios
              campoNoPe
              alvo={{ tipo: "renga", id: renga.id }}
              euId={euId}
              aoMudar={nada}
              textoDoPoema={textoDaRenga(renga.estrofes)}
              selecao={null}
              aoLimparSelecao={nada}
              verso={null}
              aoLimparFiltro={nada}
            />
          }
        />
      ),
    };
  }
  const poema = poemaDe(item);
  return {
    chave,
    rotulo: rotuloDoPoema(item),
    rotuloDaDireita: `ações e comentários de ${poema.titulo ?? "poema sem título"}`,
    esquerda: (
      <div className="pb-4">
        {topo}
        <div className={MARGEM_DA_PAGINA}>
          <PoemaCard post={item} folha />
        </div>
      </div>
    ),
    direita: (
      <VersoDoPoema
        poema={poema}
        comentarios={
          <ArvoreComentarios
            campoNoPe
            total={poema.comentarios}
            alvo={{ tipo: "poema", id: poema.id }}
            euId={euId}
            aoMudar={nada}
            textoDoPoema={poema.texto}
            selecao={null}
            aoLimparSelecao={nada}
            verso={null}
            aoLimparFiltro={nada}
          />
        }
      />
    ),
  };
}
