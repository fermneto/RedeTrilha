"use client";
// Client component: o estado de login vem do token no localStorage, que só
// existe no navegador.
//
// Duas formas da mesma navegação: a barra lateral (sm em diante; só ícones até
// xl, ícone e rótulo a partir de xl) e a barra inferior do celular. As duas
// terminam no menu da conta (MenuConta), que tem o "Sair".
//
// "Mensagens" leva o contador de conversas não lidas e pedidos novos, atualizado
// pelo stream das mensagens (ouvirMensagens, em lib/api.ts) sem recarregar.
// Na barra do celular não cabem nove ícones em 360 px: "Rascunhos" vai para o
// menu da conta, como o "Perfil".

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconeAcervo } from "@/components/icones/IconeAcervo";
import { IconeAntologias } from "@/components/icones/IconeAntologias";
import { IconeEscrever } from "@/components/icones/IconeEscrever";
import { IconeExplorar } from "@/components/icones/IconeExplorar";
import { IconeInicio } from "@/components/icones/IconeInicio";
import { IconeMensagens } from "@/components/icones/IconeMensagens";
import { IconePerfil } from "@/components/icones/IconePerfil";
import { IconeRascunhos } from "@/components/icones/IconeRascunhos";
import { IconeRenga } from "@/components/icones/IconeRenga";
import type { PropsIcone } from "@/components/icones/Icone";
import { MenuConta } from "@/components/MenuConta";
import {
  buscarEu,
  buscarResumoDeMensagens,
  limparToken,
  ouvirMensagens,
  temToken,
  type User,
} from "@/lib/api";

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
  { href: "/antologias", rotulo: "Antologias", Icone: IconeAntologias, soLogado: true },
  { href: "/rascunhos", rotulo: "Rascunhos", Icone: IconeRascunhos, soLogado: true },
  { href: "/acervo", rotulo: "Acervo", Icone: IconeAcervo },
  { href: "/rengas", rotulo: "Rengas", Icone: IconeRenga, soLogado: true },
  { href: "/mensagens", rotulo: "Mensagens", Icone: IconeMensagens, soLogado: true },
  { href: "/perfil", rotulo: "Perfil", Icone: IconePerfil, soLogado: true },
];

// Item ativo: traço mais grosso no ícone e rótulo em negrito.
const TRACO_ATIVO = "[stroke-width:2.25]";

// Fora da barra do celular (ficam no menu da conta).
const SO_NA_LATERAL = ["/perfil", "/rascunhos"];

// O número de conversas a ler, em cima do ícone de Mensagens. Acima de 99, "99+".
function Contador({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-2 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destaque px-1 text-[0.6875rem] leading-none font-bold text-papel tabular-nums ring-2 ring-papel"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

// O rótulo lido pelo leitor de tela: "Mensagens, 3 não lidas".
function rotuloComContador(rotulo: string, n: number): string {
  return n === 0 ? rotulo : `${rotulo}, ${n} ${n === 1 ? "não lida" : "não lidas"}`;
}

export function Nav() {
  const caminho = usePathname();
  const router = useRouter();
  const [logado, setLogado] = useState(false);
  const [eu, setEu] = useState<User | null>(null);
  const [aLer, setALer] = useState(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // O contador: busca ao navegar e a cada evento do stream (vários eventos juntos,
  // como uma mensagem e a leitura dela, viram uma busca só).
  useEffect(() => {
    if (!logado) {
      setALer(0);
      return;
    }
    const atualizar = () =>
      buscarResumoDeMensagens()
        .then((r) => setALer(r.nao_lidas + r.pedidos))
        .catch(() => undefined);
    atualizar();
    const cancelar = ouvirMensagens(() => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(atualizar, 250);
    });
    return () => {
      cancelar();
      if (espera.current) clearTimeout(espera.current);
    };
  }, [logado, caminho]);

  // limparToken apaga a sessão no backend e o token local, mesmo sem rede.
  async function sair() {
    await limparToken();
    setLogado(false);
    setEu(null);
    router.push("/login");
  }

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));
  const itens = ITENS.filter((item) => logado || !item.soLogado);
  // No celular, o último item é o avatar (menu com Perfil e Sair) ou o "Entrar".
  const itensDoCelular = itens.filter((item) => !SO_NA_LATERAL.includes(item.href));
  const contador = (href: string) => (href === "/mensagens" ? aLer : 0);

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
                      aria-label={rotuloComContador(rotulo, contador(href))}
                      title={rotulo}
                      className={`realce flex min-h-13 items-center gap-4 rounded-full p-3 text-xl xl:pr-6 ${
                        atual ? "font-bold" : ""
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Icone className={`h-[26px] w-[26px] ${atual ? TRACO_ATIVO : ""}`} />
                        <Contador n={contador(href)} />
                      </span>
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
          eu && <MenuConta eu={eu} aoSair={sair} variante="lateral" />
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
          {itensDoCelular.map(({ href, rotulo, Icone }) => {
            const atual = ativo(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={rotuloComContador(rotulo, contador(href))}
                  aria-current={atual ? "page" : undefined}
                  className={`flex h-13 min-w-11 items-center justify-center px-2 ${
                    atual ? "text-tinta" : "text-tinta-suave"
                  }`}
                >
                  <span className="relative">
                    <Icone className={`h-[26px] w-[26px] ${atual ? TRACO_ATIVO : ""}`} />
                    <Contador n={contador(href)} />
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            {logado ? (
              eu && (
                <MenuConta
                  eu={eu}
                  aoSair={sair}
                  variante="inferior"
                  ativo={ativo("/perfil") || caminho === `/u/${eu.username}`}
                />
              )
            ) : (
              <Link href="/login" className="flex h-13 items-center px-2 text-sm font-semibold">
                Entrar
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}
