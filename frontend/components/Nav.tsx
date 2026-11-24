"use client";
// Client component: o estado de login vem do token no localStorage, que só
// existe no navegador.
//
// Duas formas da mesma navegação: a barra lateral (sm em diante; só ícones até
// xl, ícone e rótulo a partir de xl) e a barra inferior do celular.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { IconeAntologias } from "@/components/icones/IconeAntologias";
import { IconeEscrever } from "@/components/icones/IconeEscrever";
import { IconeExplorar } from "@/components/icones/IconeExplorar";
import { IconeInicio } from "@/components/icones/IconeInicio";
import { IconeMais } from "@/components/icones/IconeMais";
import { IconePerfil } from "@/components/icones/IconePerfil";
import { IconePoetas } from "@/components/icones/IconePoetas";
import type { PropsIcone } from "@/components/icones/Icone";
import { buscarEu, limparToken, temToken, type User } from "@/lib/api";

type Item = {
  href: string;
  rotulo: string;
  Icone: (props: PropsIcone) => React.ReactNode;
  soLogado?: boolean;
};

const ITENS: Item[] = [
  { href: "/", rotulo: "Início", Icone: IconeInicio },
  { href: "/explorar", rotulo: "Explorar", Icone: IconeExplorar },
  { href: "/escrever", rotulo: "Escrever", Icone: IconeEscrever },
  { href: "/antologias", rotulo: "Antologias", Icone: IconeAntologias },
  { href: "/usuarios", rotulo: "Poetas", Icone: IconePoetas },
  { href: "/perfil", rotulo: "Perfil", Icone: IconePerfil, soLogado: true },
];

// Item ativo: traço mais grosso no ícone e rótulo em negrito.
const TRACO_ATIVO = "[stroke-width:2.25]";

export function Nav() {
  const caminho = usePathname();
  const router = useRouter();
  const [logado, setLogado] = useState(false);
  const [eu, setEu] = useState<User | null>(null);

  // Relê o token a cada navegação: o login (P3) grava e depois redireciona.
  useEffect(() => {
    const comToken = temToken();
    setLogado(comToken);
    if (!comToken) {
      setEu(null);
      return;
    }
    buscarEu()
      .then(setEu)
      .catch(() => setEu(null));
  }, [caminho]);

  // limparToken apaga a sessão no backend e o token local, mesmo sem rede.
  async function sair() {
    await limparToken();
    setLogado(false);
    setEu(null);
    router.push("/login");
  }

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));
  const itens = ITENS.filter((item) => logado || !item.soLogado);

  return (
    <>
      <header className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center justify-between px-3 py-2 sm:flex xl:w-[260px] xl:items-stretch">
        <div className="flex flex-col items-center gap-1 xl:items-stretch">
          <Link
            href="/"
            aria-label="Verso, início"
            className="realce mb-2 flex h-13 min-w-13 items-center justify-center rounded-full font-serifada text-[1.75rem] leading-none font-semibold italic tracking-tight xl:justify-start xl:self-start xl:px-3"
          >
            <span aria-hidden="true" className="xl:hidden">
              V
            </span>
            <span aria-hidden="true" className="hidden xl:inline">
              Verso
            </span>
          </Link>

          <nav aria-label="Principal">
            <ul className="flex flex-col items-center gap-1 xl:items-start">
              {itens.map(({ href, rotulo, Icone }) => {
                const atual = ativo(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={atual ? "page" : undefined}
                      title={rotulo}
                      className={`realce flex min-h-13 items-center gap-4 rounded-full p-3 text-xl xl:pr-6 ${
                        atual ? "font-bold" : ""
                      }`}
                    >
                      <Icone className={`h-[26px] w-[26px] shrink-0 ${atual ? TRACO_ATIVO : ""}`} />
                      <span className="sr-only xl:not-sr-only">{rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link
            href="/escrever"
            className="mt-4 flex h-13 w-13 items-center justify-center rounded-full bg-destaque font-semibold text-papel transition-[filter] duration-150 hover:brightness-110 xl:w-[90%] xl:text-[1.0625rem]"
          >
            <IconeEscrever className="h-6 w-6 xl:hidden" />
            <span className="sr-only xl:not-sr-only">Escrever poema</span>
          </Link>
        </div>

        {logado ? (
          eu && <CartaoUsuario eu={eu} aoSair={sair} />
        ) : (
          <Link
            href="/login"
            className="realce mb-2 flex min-h-11 items-center justify-center rounded-full border border-borda px-4 text-sm font-semibold"
          >
            Entrar
          </Link>
        )}
      </header>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-papel pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="flex justify-around">
          {itens.map(({ href, rotulo, Icone }) => {
            const atual = ativo(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={rotulo}
                  aria-current={atual ? "page" : undefined}
                  className={`flex h-13 min-w-11 items-center justify-center px-2 ${
                    atual ? "text-tinta" : "text-tinta-suave"
                  }`}
                >
                  <Icone className={`h-[26px] w-[26px] ${atual ? TRACO_ATIVO : ""}`} />
                </Link>
              </li>
            );
          })}
          {!logado && (
            <li>
              <Link href="/login" className="flex h-13 items-center px-2 text-sm font-semibold">
                Entrar
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}

// Rodapé da barra: quem está logado e o menu com "Sair". Fecha com Esc ou clique fora.
// O menu vem depois do botão no DOM (Tab entra nele) e aparece por cima, com bottom-full.
function CartaoUsuario({ eu, aoSair }: { eu: User; aoSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative mb-2 w-full">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="menu-conta"
        aria-label={`Conta de ${eu.name} (@${eu.username})`}
        className="realce flex w-full cursor-pointer items-center justify-center gap-3 rounded-full p-3 text-left xl:justify-start"
      >
        <Avatar usuario={eu} />
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-[0.9375rem] font-bold">{eu.name}</span>
          <span className="block truncate text-[0.9375rem] text-tinta-suave">@{eu.username}</span>
        </span>
        <IconeMais className="hidden h-5 w-5 shrink-0 xl:block" />
      </button>
      {aberto && (
        <div
          id="menu-conta"
          className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl border border-borda bg-papel-alto py-2 shadow-[0_4px_24px_-6px_rgb(0_0_0/0.2)]"
        >
          <button
            type="button"
            onClick={aoSair}
            className="realce w-full cursor-pointer px-4 py-3 text-left text-[0.9375rem] font-semibold focus-visible:outline-offset-[-2px]"
          >
            Sair de @{eu.username}
          </button>
        </div>
      )}
    </div>
  );
}
