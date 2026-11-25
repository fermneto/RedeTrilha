"use client";
// "Mais", o último item da barra de baixo do celular: abre uma folha com o que não
// cabe na barra (o Acervo e o Perfil, onde ficam os rascunhos e as antologias), as
// Preferências e o "Sair". A barra fica com cinco itens de toque largo (decisão do Neto).
//
// Acessível como um diálogo leve: o botão tem aria-expanded; ao abrir, o foco vai
// para o primeiro item e fica preso na folha (Tab e Shift+Tab dão a volta); Esc
// fecha e devolve o foco ao botão; clicar fora fecha.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeMais } from "@/components/icones/IconeMais";
import type { PropsIcone } from "@/components/icones/Icone";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import { caminhoDasPreferencias, type User } from "@/lib/api";

export type ItemDoMais = {
  href: string;
  rotulo: string;
  Icone: (props: PropsIcone) => React.ReactNode;
};

type Props = {
  eu: User;
  itens: ItemDoMais[];
  aoSair: () => void;
  // Realça o botão quando a página atual é de um dos itens da folha.
  ativo: boolean;
  caminho: string;
};

const ITEM =
  "realce flex min-h-12 w-full cursor-pointer items-center gap-4 px-5 text-left text-[1.0625rem] focus-visible:outline-offset-[-2px]";

export function MenuMais({ eu, itens, aoSair, ativo, caminho }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const id = useId();

  useFecharAoSair(aberto, caixa, (e) => {
    setAberto(false);
    if (e instanceof KeyboardEvent) botao.current?.focus();
  });

  useEffect(() => {
    if (aberto) folha.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [aberto]);

  // Navegou (inclusive pelo voltar do navegador): a folha fecha.
  useEffect(() => setAberto(false), [caminho]);

  // Foco preso: do último item o Tab volta ao primeiro, e o Shift+Tab ao contrário.
  function prenderFoco(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !folha.current) return;
    const focaveis = Array.from(folha.current.querySelectorAll<HTMLElement>("a, button"));
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  const fechar = () => setAberto(false);

  return (
    <div ref={caixa} className="flex w-full justify-center">
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label="Mais opções"
        className={`flex h-13 w-full max-w-14 cursor-pointer items-center justify-center ${
          ativo || aberto ? "text-tinta" : "text-tinta-suave"
        }`}
      >
        <IconeMais className={`h-[26px] w-[26px] ${ativo ? "[stroke-width:2.25]" : ""}`} />
      </button>
      <div
        ref={folha}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Mais opções"
        hidden={!aberto}
        onKeyDown={prenderFoco}
        className="fixed inset-x-2 bottom-[calc(3.25rem+env(safe-area-inset-bottom)+0.5rem)] z-30 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.25)]"
      >
        <ul>
          {itens.map(({ href, rotulo, Icone }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={fechar}
                aria-current={caminho.startsWith(href) ? "page" : undefined}
                className={`${ITEM} ${caminho.startsWith(href) ? "font-bold" : ""}`}
              >
                <Icone className="h-6 w-6 shrink-0" />
                {rotulo}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={`/u/${eu.username}`}
              onClick={fechar}
              aria-current={caminho === `/u/${eu.username}` ? "page" : undefined}
              className={ITEM}
            >
              <Avatar usuario={eu} tamanho="p" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">Perfil</span>
                <span className="block truncate text-sm text-tinta-suave">@{eu.username}</span>
              </span>
            </Link>
          </li>
        </ul>
        <div className="mt-2 border-t border-borda pt-2">
          <Link href={caminhoDasPreferencias(caminho, eu.username)} onClick={fechar} className={`${ITEM} text-[0.9375rem]`}>
            Preferências
          </Link>
          <button type="button" onClick={aoSair} className={`${ITEM} text-[0.9375rem]`}>
            Sair de @{eu.username}
          </button>
        </div>
      </div>
    </div>
  );
}
