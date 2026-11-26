"use client";
// O poema no livro, em página dupla: na esquerda, quem escreveu (a faixa do
// autor, com o "Seguir"), o poema e a ficha (forma, obra, tags); na direita, a
// conversa: os contadores, as ações (curtir, repostar, citar, comentar, guardar
// numa antologia, enviar), os comentários em fio e o campo de comentar no pé.
// Usado pelo feed, uma folha por item, e pela página do poema.

import Link from "next/link";
import { type ReactNode } from "react";

import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import { AcoesDaRenga } from "@/components/BarraDeAcoes";
import type { Folha } from "@/components/CadernoFolhas";
import { Acoes, PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
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
// repostar e comentar estarem sempre à mão. Na página do poema, `repercussao`
// (quem curtiu, repostou e citou) vem entre as ações e a conversa.
export function VersoDoPoema({
  poema,
  comentarios,
  repercussao,
}: {
  poema: Post;
  comentarios: ReactNode;
  repercussao?: ReactNode;
}) {
  return (
    <div className={MARGEM_DA_CONVERSA}>
      <div className="acoes-presas sticky top-0 z-10 border-b border-borda/70 pt-3 pb-3">
        <Acoes key={poema.id} poema={poema} contadores />
      </div>
      {repercussao && <div className="mt-4">{repercussao}</div>}
      <div className="mt-6 flex flex-1 flex-col">{comentarios}</div>
    </div>
  );
}

// A página da direita de uma renga: as mesmas ações do poema presas no topo
// (#171), com "escrever a próxima estrofe" embaixo delas enquanto couber, e a
// conversa embaixo. Na página da renga, o campo da estrofe já está na página da
// esquerda (sem o link, `naPropriaPagina`), e a `repercussao` vem como no poema.
export function ConversaDaRenga({
  renga,
  comentarios,
  repercussao,
  naPropriaPagina = false,
}: {
  renga: RengaDetalhe;
  comentarios: ReactNode;
  repercussao?: ReactNode;
  naPropriaPagina?: boolean;
}) {
  return (
    <div className={MARGEM_DA_CONVERSA}>
      <div className="acoes-presas sticky top-0 z-10 border-b border-borda/70 pt-3 pb-3">
        <AcoesDaRenga key={renga.id} renga={renga} contadores />
        {!naPropriaPagina && !renga.fechada && renga.posso_escrever && (
          <Link
            href={`/rengas/${renga.id}`}
            className="-ml-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold text-destaque transition-colors duration-150 hover:bg-tinta/5"
          >
            <IconeRenga className="h-[1.125rem] w-[1.125rem]" />
            escrever a próxima estrofe
            <span className="font-normal text-tinta-suave tabular-nums">
              · {renga.qtd_estrofes + 1}ª de {renga.limite}
            </span>
          </Link>
        )}
      </div>
      {repercussao && <div className="mt-4">{repercussao}</div>}
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
      rotuloDaDireita: `ações e comentários da renga ${renga.titulo}`,
      esquerda: (
        <div className="pb-4">
          {topo}
          <div className="px-2 pt-4 sm:px-6 lg:px-10 lg:pt-8">
            <RengaCard renga={renga} atividade={item.atividade} por={item.por} folha />
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
