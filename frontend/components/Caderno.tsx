"use client";
// O livro aberto: a moldura de todas as rotas com navegação. Sem mesa nem fundo:
// o objeto se sustenta sozinho, a capa de pano um pouco maior que o miolo, a
// borda das folhas aparecendo e a sombra da dobra. No desktop (de 1024 px), a
// página dupla com a lombada (a navegação) à esquerda; abaixo disso, uma página
// por vez, e a lombada vira a borda de baixo da capa.
//
// As rotas que desenham as próprias folhas (o feed, o perfil, o compositor e as
// páginas de publicação: o poema, a renga e a antologia) usam o CadernoFolhas
// direto. As outras ficam na página da esquerda, e a da direita traz a coluna
// Descobrir (só na página dupla).
//
// O caderno também anota o caminho feito no Verso (lib/historico.ts), para o
// "voltar" das páginas de publicação saber se há uma página do Verso antes.
//
// Por cima de tudo, as dicas do livro (components/DicasDoLivro.tsx).

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { CadernoFolhas, useDuplo } from "@/components/CadernoFolhas";
import { Lombada, LombadaDoCelular } from "@/components/CadernoLombada";
import { ColunaDireita } from "@/components/ColunaDireita";
import { DicasDoLivro } from "@/components/DicasDoLivro";
import { anotarRota, anotarVoltaDoNavegador } from "@/lib/historico";

// /rengas/nova e /antologias/nova são formulários, não publicações.
const PUBLICACAO = /^\/(poema|rengas|antologias)\/(?!nova$)[^/]+$/;

function desenhaAsFolhas(caminho: string): boolean {
  return caminho === "/" || caminho === "/escrever" || caminho.startsWith("/u/") || PUBLICACAO.test(caminho);
}

export function Caderno({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const duplo = useDuplo();

  useEffect(() => {
    window.addEventListener("popstate", anotarVoltaDoNavegador);
    return () => window.removeEventListener("popstate", anotarVoltaDoNavegador);
  }, []);

  useEffect(() => {
    anotarRota(caminho);
  }, [caminho]);

  const folhas = desenhaAsFolhas(caminho) ? (
    children
  ) : (
    <CadernoFolhas
      key={caminho}
      folhas={[
        {
          chave: caminho,
          rotulo: "página",
          esquerda: <div className="flex min-h-full flex-col pb-6 lg:px-6">{children}</div>,
          direita: <ColunaDireita />,
          direitaSoNoDuplo: true,
        },
      ]}
    />
  );

  // O miolo: as folhas por cima, com a borda das folhas por baixo, 5 px de cada
  // lado e 4 px no pé (.miolo, em globals.css).
  const miolo = (
    <main className="miolo relative min-h-0 min-w-0 flex-1 rounded-[0.25rem] px-[5px] pb-[4px]">{folhas}</main>
  );

  if (duplo) {
    return (
      <DicasDoLivro>
        <div className="livro-aberto flex h-dvh items-center justify-center px-6 py-5">
          <div className="capa flex h-full w-full max-w-[1400px] rounded-[0.625rem] py-[7px] pr-[7px]">
            <Lombada />
            {miolo}
          </div>
        </div>
      </DicasDoLivro>
    );
  }

  return (
    <DicasDoLivro>
      <div className="livro-aberto capa flex h-dvh flex-col px-[5px] pt-[5px]">
        {miolo}
        <LombadaDoCelular />
      </div>
    </DicasDoLivro>
  );
}
