"use client";
// O poema no caderno, em página dupla: na esquerda, só o poema (título, autor
// discreto e versos); na direita, o que se faz com ele (curtir, repostar, citar,
// guardar numa antologia, enviar), a ficha (forma, obra, tags) e os comentários.
// Usado pelo feed, uma folha por item, e pela página do poema.

import type { ReactNode } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import type { Folha } from "@/components/CadernoFolhas";
import { Acoes, Detalhes, PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
import { chaveDoItem, ehRenga, textoDaRenga, type ItemDoFeed, type Post } from "@/lib/api";

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

// A página da direita: as ações e a ficha no alto, os comentários embaixo.
export function VersoDoPoema({ poema, comentarios }: { poema: Post; comentarios: ReactNode }) {
  return (
    <div className={MARGEM_DA_PAGINA}>
      <Acoes key={poema.id} poema={poema} />
      <Detalhes poema={poema} />
      <div className="mt-10">{comentarios}</div>
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
        <div className={MARGEM_DA_PAGINA}>
          <ArvoreComentarios
            alvo={{ tipo: "renga", id: renga.id }}
            euId={euId}
            aoMudar={nada}
            textoDoPoema={textoDaRenga(renga.estrofes)}
            selecao={null}
            aoLimparSelecao={nada}
            verso={null}
            aoLimparFiltro={nada}
          />
        </div>
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
