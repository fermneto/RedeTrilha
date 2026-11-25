"use client";
// "Escrever": o único botão de criar da navegação. Abre uma lista curta com o
// poema em primeiro (e com o foco nele, então Enter, Enter já leva ao compositor),
// a renga e a antologia, cada uma no fluxo de criação que já existia.
//
// Um botão de abrir e fechar (aria-expanded), como o menu da conta, e não um
// role="menu": são três links, e o leitor de tela os lê como links. Ao abrir, o
// foco vai para "Poema"; as setas andam entre os três; Esc fecha e devolve o foco
// ao botão; clique fora, Tab para fora ou navegar fecham.
//
// Duas formas: "lateral" (o botão grande da barra lateral, com a lista logo
// abaixo) e "barra" (o ícone da barra de baixo do celular, com a lista em folha,
// como o "Mais").

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { IconeAntologias } from "@/components/icones/IconeAntologias";
import { IconeEscrever } from "@/components/icones/IconeEscrever";
import { IconeRenga } from "@/components/icones/IconeRenga";
import { IconeSeta } from "@/components/icones/IconeSeta";
import type { PropsIcone } from "@/components/icones/Icone";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";

const OPCOES: { href: string; rotulo: string; explicacao: string; Icone: (p: PropsIcone) => React.ReactNode }[] = [
  { href: "/escrever", rotulo: "Poema", explicacao: "publicar agora ou guardar no rascunho", Icone: IconeEscrever },
  { href: "/rengas/nova", rotulo: "Renga", explicacao: "abrir um poema a várias mãos", Icone: IconeRenga },
  { href: "/antologias/nova", rotulo: "Antologia", explicacao: "reunir poemas que você ama", Icone: IconeAntologias },
];

type Props = {
  forma: "lateral" | "barra";
  caminho: string;
};

export function MenuEscrever({ forma, caminho }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();

  useFecharAoSair(aberto, caixa, (e) => {
    setAberto(false);
    if (e instanceof KeyboardEvent) botao.current?.focus();
  });

  useEffect(() => {
    if (aberto) lista.current?.querySelector<HTMLElement>("a")?.focus();
  }, [aberto]);

  useEffect(() => setAberto(false), [caminho]);

  function aoPerderFoco(e: React.FocusEvent) {
    if (!caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
  }

  // Setas para cima e para baixo andam entre as opções, dando a volta.
  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = Array.from(lista.current?.querySelectorAll<HTMLElement>("a") ?? []);
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    links[(i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length].focus();
  }

  const ativo = OPCOES.some((o) => caminho.startsWith(o.href));
  const lateral = forma === "lateral";

  return (
    <div
      ref={caixa}
      onBlur={aoPerderFoco}
      className={lateral ? "relative mt-4 flex w-full justify-center xl:justify-start" : "flex w-full justify-center"}
    >
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={lateral ? undefined : "Escrever"}
        className={
          lateral
            ? "flex h-13 w-13 cursor-pointer items-center justify-center gap-2 rounded-full bg-destaque font-semibold text-papel transition-[filter] duration-150 hover:brightness-110 xl:w-[90%] xl:text-[1.0625rem]"
            : `flex h-13 w-full max-w-14 cursor-pointer items-center justify-center ${
                ativo || aberto ? "text-tinta" : "text-tinta-suave"
              }`
        }
      >
        <IconeEscrever
          className={lateral ? "h-6 w-6 xl:hidden" : `h-[26px] w-[26px] ${ativo ? "[stroke-width:2.25]" : ""}`}
        />
        {lateral && (
          <>
            <span className="sr-only xl:not-sr-only">Escrever</span>
            <IconeSeta
              className={`hidden h-5 w-5 transition-transform duration-150 xl:block ${aberto ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>
      <ul
        ref={lista}
        id={id}
        hidden={!aberto}
        onKeyDown={aoTeclar}
        className={`z-30 rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)] ${
          lateral
            ? "absolute top-full left-0 mt-2 w-72 max-w-[calc(100vw-1rem)]"
            : "fixed inset-x-2 bottom-[calc(3.25rem+env(safe-area-inset-bottom)+0.5rem)]"
        }`}
      >
        {OPCOES.map(({ href, rotulo, explicacao, Icone }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={() => setAberto(false)}
              className="realce flex min-h-14 w-full items-center gap-4 px-5 py-2 text-left focus-visible:outline-offset-[-2px]"
            >
              <Icone className="h-6 w-6 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[1.0625rem] font-semibold">{rotulo}</span>
                <span className="block text-sm text-tinta-suave">{explicacao}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
