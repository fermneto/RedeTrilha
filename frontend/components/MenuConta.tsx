"use client";
// Menu da conta logada: o avatar abre um popover com "Preferências" (os passos de
// gostos e região do onboarding, que voltam para a página atual) e "Sair de
// @username" (e, na barra inferior do celular, também "Perfil", que ali não tem
// item próprio).
// Fecha com Esc (o foco volta ao avatar), com clique fora ou quando o Tab sai dele.
// Ao abrir, o foco vai para o primeiro item; o menu vem depois do botão no DOM.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeMais } from "@/components/icones/IconeMais";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import { caminhoDasPreferencias, type User } from "@/lib/api";

type Props = {
  eu: User;
  aoSair: () => void;
  // lateral: rodapé da barra da esquerda; inferior: último item da barra do celular.
  variante: "lateral" | "inferior";
  // Na barra inferior, realça o avatar quando a página é o meu perfil.
  ativo?: boolean;
};

const ITEM_DO_MENU =
  "realce block w-full cursor-pointer px-4 py-3 text-left text-[0.9375rem] font-semibold focus-visible:outline-offset-[-2px]";

export function MenuConta({ eu, aoSair, variante, ativo = false }: Props) {
  const [aberto, setAberto] = useState(false);
  // Página de onde o menu foi aberto, para as preferências voltarem a ela.
  const [atual, setAtual] = useState("/");
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const inferior = variante === "inferior";

  useFecharAoSair(aberto, caixa, (e) => {
    setAberto(false);
    if (e instanceof KeyboardEvent) botao.current?.focus();
  });

  useEffect(() => {
    if (aberto) menu.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [aberto]);

  // Tab para fora do menu fecha (o foco já foi para outro lugar, não precisa voltar).
  function aoPerderFoco(e: React.FocusEvent) {
    if (!caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
  }

  return (
    <div ref={caixa} onBlur={aoPerderFoco} className={inferior ? "relative" : "relative mb-2 w-full"}>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          setAtual(window.location.pathname + window.location.search);
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={`Conta de ${eu.name} (@${eu.username})`}
        className={
          inferior
            ? "flex h-13 min-w-11 cursor-pointer items-center justify-center px-2"
            : "realce flex w-full cursor-pointer items-center justify-center gap-3 rounded-full p-3 text-left xl:justify-start"
        }
      >
        {inferior ? (
          <span className={`rounded-full ${ativo ? "ring-2 ring-tinta ring-offset-2 ring-offset-papel" : ""}`}>
            <Avatar usuario={eu} tamanho="p" />
          </span>
        ) : (
          <>
            <Avatar usuario={eu} />
            <span className="hidden min-w-0 flex-1 xl:block">
              <span className="block truncate text-[0.9375rem] font-bold">{eu.name}</span>
              <span className="block truncate text-[0.9375rem] text-tinta-suave">@{eu.username}</span>
            </span>
            <IconeMais className="hidden h-5 w-5 shrink-0 xl:block" />
          </>
        )}
      </button>
      <div
        ref={menu}
        id={id}
        hidden={!aberto}
        className={`absolute bottom-full z-30 mb-2 w-64 max-w-[calc(100vw-1rem)] rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)] ${
          inferior ? "right-0" : "left-0"
        }`}
      >
        {inferior && (
          <Link href={`/u/${eu.username}`} onClick={() => setAberto(false)} className={ITEM_DO_MENU}>
            Perfil
          </Link>
        )}
        <Link
          href={caminhoDasPreferencias(atual, eu.username)}
          onClick={() => setAberto(false)}
          className={ITEM_DO_MENU}
        >
          Preferências
        </Link>
        <button type="button" onClick={aoSair} className={ITEM_DO_MENU}>
          Sair de @{eu.username}
        </button>
      </div>
    </div>
  );
}
