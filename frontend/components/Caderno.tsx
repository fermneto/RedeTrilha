"use client";
// O caderno aberto sobre a mesa: a moldura de todas as rotas com navegação.
// No desktop (de 1024 px), a página dupla com os marcadores saindo da borda de
// cima e da esquerda; abaixo disso, uma página por vez, com os marcadores em cima.
//
// As rotas que desenham as próprias folhas (o feed, o poema, o perfil e o
// compositor) usam o CadernoFolhas direto. As outras ficam na página da
// esquerda, e a da direita traz a coluna Descobrir (só na página dupla).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CadernoFolhas, useDuplo } from "@/components/CadernoFolhas";
import { MarcadoresDoCaderno, MarcadoresDoCelular } from "@/components/CadernoMarcadores";
import { ColunaDireita } from "@/components/ColunaDireita";

function desenhaAsFolhas(caminho: string): boolean {
  return caminho === "/" || caminho === "/escrever" || caminho.startsWith("/poema/") || caminho.startsWith("/u/");
}

export function Caderno({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const duplo = useDuplo();

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

  if (duplo) {
    return (
      <div className="min-h-dvh bg-mesa">
        <div className="mx-auto h-dvh max-w-[1360px] pt-16 pr-8 pb-6 pl-16">
          <div className="relative h-full">
            <MarcadoresDoCaderno />
            <Link
              href="/"
              aria-label="Verso, início"
              className="absolute right-1 bottom-full mb-3 rounded font-serifada text-2xl leading-none font-semibold italic tracking-tight"
            >
              <span aria-hidden="true">Verso</span>
            </Link>
            <main className="sombra-de-papel relative z-10 h-full rounded-md bg-papel">{folhas}</main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-mesa px-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        <div className="relative -mb-1.5">
          <MarcadoresDoCelular />
        </div>
        <main className="sombra-de-papel relative z-10 min-h-0 flex-1 rounded-lg bg-papel">{folhas}</main>
      </div>
    </div>
  );
}
