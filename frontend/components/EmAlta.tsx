"use client";
// "Em alta" como os trends do X: a posição, a #tag, quantos poemas a usaram nas
// últimas 24 h e o primeiro verso de um poema dela (um poema diferente por tag),
// com o negrito, o itálico, o sublinhado e o tachado do poema. A ordem é a do
// backend (mais poemas na janela), sem curtidas. Usado no Explorar e na coluna direita.

import Link from "next/link";
import { useEffect, useState } from "react";

import { VersoFormatado } from "@/components/TextoFormatado";
import { buscarTrending, caminhoDaTag, hashtag, type TagContagem } from "@/lib/api";
import { noPlural } from "@/lib/numeros";

// null enquanto carrega; [] quando não há tags (ou a rota falhou).
// `quantas`: 10 no Explorar, 5 na coluna direita.
export function useEmAlta(quantas = 5): TagContagem[] | null {
  const [tags, setTags] = useState<TagContagem[] | null>(null);

  useEffect(() => {
    let vivo = true;
    buscarTrending(quantas)
      .then((r) => vivo && setTags(r.items))
      .catch(() => vivo && setTags([]));
    return () => {
      vivo = false;
    };
  }, [quantas]);

  return tags;
}

function poemasNas24h(contagem: number): string {
  return `${contagem} ${noPlural(contagem, "poema", "poemas")} nas últimas 24 h`;
}

// Uma <ol>: o leitor de tela já anuncia a posição, então o número visível é decorativo.
export function ListaEmAlta({ tags }: { tags: TagContagem[] }) {
  return (
    <ol>
      {tags.map(({ tag, contagem, trecho }, i) => (
        <li key={tag}>
          <Link
            href={caminhoDaTag(tag)}
            className="realce block px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-destaque"
          >
            <span className="block text-[0.8125rem] text-tinta-suave tabular-nums">
              <span aria-hidden="true">{i + 1} · </span>
              {poemasNas24h(contagem)}
            </span>
            <span className="block font-bold break-words">{hashtag(tag)}</span>
            {trecho && (
              <span className="mt-0.5 block overflow-hidden font-serifada text-[0.9375rem] text-ellipsis whitespace-pre text-tinta-suave">
                <VersoFormatado linha={trecho} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
