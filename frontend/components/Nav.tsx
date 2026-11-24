"use client";
// Client component: o estado de login vem do token no localStorage, que só
// existe no navegador.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { limparToken, temToken } from "@/lib/api";

const LINKS = [
  { href: "/", rotulo: "Feed" },
  { href: "/explorar", rotulo: "Explorar" },
  { href: "/escrever", rotulo: "Escrever" },
  { href: "/antologias", rotulo: "Antologias" },
  { href: "/usuarios", rotulo: "Poetas" },
];

export function Nav() {
  const caminho = usePathname();
  const router = useRouter();
  const [logado, setLogado] = useState(false);

  // Relê o token a cada navegação: o login (P3) grava e depois redireciona.
  useEffect(() => {
    setLogado(temToken());
  }, [caminho]);

  // limparToken apaga a sessão no backend e o token local, mesmo sem rede.
  async function sair() {
    await limparToken();
    setLogado(false);
    router.push("/login");
  }

  function classeDoLink(href: string) {
    const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
    return ativo ? "nav-link nav-link-ativo" : "nav-link";
  }

  return (
    <nav className="border-b border-borda">
      <div className="coluna flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4">
        <Link href="/" className="font-serifada text-2xl italic tracking-tight">
          Verso
        </Link>
        <ul className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={classeDoLink(l.href)}>
                {l.rotulo}
              </Link>
            </li>
          ))}
          {logado && (
            <li>
              <Link href="/perfil" className={classeDoLink("/perfil")}>
                Perfil
              </Link>
            </li>
          )}
        </ul>
        {logado ? (
          <button type="button" onClick={sair} className="nav-link cursor-pointer text-sm">
            Sair
          </button>
        ) : (
          <Link href="/login" className={`${classeDoLink("/login")} text-sm`}>
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}
