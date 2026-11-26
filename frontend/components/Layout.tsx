"use client";
// Client component só para ler o pathname; as páginas (children) continuam como são.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { Caderno } from "@/components/Caderno";
import { ProvedorDaCapa } from "@/components/CapaDoLivro";
import { TelaDeEntrada } from "@/components/LayoutDaEntrada";
import { assinarSessao, ehTelaDeBoasVindas, temToken } from "@/lib/api";

// O cadastro fica limpo e centrado, sem as barras (decisão do Neto). Checagem pelo
// pathname, e não por um route group app/(auth)/, para nada mudar de pasta.
const ROTAS_SEM_BARRAS = ["/cadastro"];

// O token só existe no navegador: no servidor (e na hidratação) a resposta é null,
// "ainda não sei"; no cliente, true ou false, e muda junto com o login e o logout.
const semSessaoNoServidor = () => null;

// A capa do livro que abre ao entrar (components/CapaDoLivro.tsx) mora aqui, por
// fora das rotas: ela continua na tela enquanto o login dá lugar ao Caderno.
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorDaCapa>
      <Moldura>{children}</Moldura>
    </ProvedorDaCapa>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const logado = useSyncExternalStore<boolean | null>(assinarSessao, temToken, semSessaoNoServidor);

  // O onboarding (/boas-vindas e /boas-vindas/quem-seguir) é um momento à parte:
  // a página desenha a própria tela cheia (components/TelaDeBoasVindas.tsx), sem a
  // navegação, a coluna Descobrir nem a barra do celular. Mesma checagem pelo
  // pathname do login, para nenhuma página mudar de pasta.
  // A landing (/login) também desenha a própria tela cheia (components/LayoutDaEntrada.tsx).
  if (ehTelaDeBoasVindas(caminho) || caminho === "/login") return children;

  // "/" é o feed para quem está logado e a landing para quem não está. Antes de
  // ler o token, só o papel vazio: nem o feed nem a landing piscam errados.
  if (caminho === "/" && logado !== true) {
    return logado === null ? <div className="min-h-dvh" /> : <TelaDeEntrada />;
  }

  if (ROTAS_SEM_BARRAS.includes(caminho)) {
    return (
      <div className="flex min-h-dvh flex-col items-center px-4 py-12 sm:justify-center">
        <Link
          href="/"
          aria-label="Verso, início"
          data-sai="sumir"
          className="mb-8 rounded-lg font-serifada text-5xl leading-none font-semibold italic tracking-tight"
        >
          <span aria-hidden="true">Verso</span>
        </Link>
        <main className="w-full max-w-sm">{children}</main>
      </div>
    );
  }

  // O caderno: as rotas com navegação são páginas dele (components/Caderno.tsx).
  return <Caderno>{children}</Caderno>;
}
