"use client";
// Client component só para ler o pathname; as páginas (children) continuam como são.

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { Caderno } from "@/components/Caderno";
import { ProvedorDaCapa } from "@/components/CapaDoLivro";
import { TelaDeEntrada } from "@/components/LayoutDaEntrada";
import { assinarSessao, ehTelaDeBoasVindas, temToken } from "@/lib/api";

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
  // A entrada (/login e /cadastro) também desenha a própria tela cheia, sem as
  // barras: o formulário e a capa do livro (components/LayoutDaEntrada.tsx).
  if (ehTelaDeBoasVindas(caminho) || caminho === "/login" || caminho === "/cadastro") return children;

  // "/" é o feed para quem está logado e a landing para quem não está. Antes de
  // ler o token, só o papel vazio: nem o feed nem a landing piscam errados.
  if (caminho === "/" && logado !== true) {
    return logado === null ? <div className="min-h-dvh" /> : <TelaDeEntrada />;
  }

  // O caderno: as rotas com navegação são páginas dele (components/Caderno.tsx).
  return <Caderno>{children}</Caderno>;
}
