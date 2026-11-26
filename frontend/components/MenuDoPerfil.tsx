"use client";
// Ajustes da conta no meu perfil, ao lado de "Editar perfil": "Preferências" (os
// passos de gostos e região do onboarding, que voltam para o perfil) e "Sair". É
// por aqui que se chega a esses dois: o "Perfil" da lombada do livro leva a ele.
// Botão com aria-expanded, foco no primeiro item ao abrir, Esc fecha e devolve o
// foco ao botão, clique fora ou Tab para fora fecham.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { IconeAjustes } from "@/components/icones/IconeAjustes";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import { caminhoDasPreferencias, limparToken } from "@/lib/api";

const ITEM =
  "realce block w-full cursor-pointer px-4 py-3 text-left text-[0.9375rem] font-semibold focus-visible:outline-offset-[-2px]";

export function MenuDoPerfil({ username }: { username: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useFecharAoSair(aberto, caixa, (e) => {
    setAberto(false);
    if (e instanceof KeyboardEvent) botao.current?.focus();
  });

  useEffect(() => {
    if (aberto) menu.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [aberto]);

  function aoPerderFoco(e: React.FocusEvent) {
    if (!caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
  }

  // limparToken apaga a sessão no backend e o token local, mesmo sem rede.
  async function sair() {
    await limparToken();
    router.push("/login");
  }

  return (
    <div ref={caixa} onBlur={aoPerderFoco} className="relative">
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label="Ajustes da conta"
        title="Ajustes da conta"
        className="realce flex h-[2.375rem] w-[2.375rem] cursor-pointer items-center justify-center rounded border border-borda"
      >
        <IconeAjustes className="h-5 w-5" />
      </button>
      <div
        ref={menu}
        id={id}
        hidden={!aberto}
        className="absolute top-full right-0 z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)]"
      >
        <Link
          href={caminhoDasPreferencias(`/u/${encodeURIComponent(username)}`, username)}
          onClick={() => setAberto(false)}
          className={ITEM}
        >
          Preferências
        </Link>
        <button type="button" onClick={sair} className={ITEM}>
          Sair de @{username}
        </button>
      </div>
    </div>
  );
}
