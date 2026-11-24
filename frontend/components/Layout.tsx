"use client";
// Client component só para ler o pathname; as páginas (children) continuam como são.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ColunaDireita } from "@/components/ColunaDireita";
import { Nav } from "@/components/Nav";

// Login e cadastro ficam limpos e centrados, sem as barras (decisão do Neto).
// Checagem pelo pathname, e não por um route group app/(auth)/, porque as
// páginas vêm do #44 em app/login e app/cadastro: assim nada precisa mudar de pasta.
const ROTAS_SEM_BARRAS = ["/login", "/cadastro"];

export function Layout({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();

  if (ROTAS_SEM_BARRAS.includes(caminho)) {
    return (
      <div className="flex min-h-dvh flex-col items-center px-4 py-12 sm:justify-center">
        <Link
          href="/"
          aria-label="Verso, início"
          className="mb-8 rounded-lg font-serifada text-5xl leading-none font-semibold italic tracking-tight"
        >
          <span aria-hidden="true">Verso</span>
        </Link>
        <main className="w-full max-w-sm">{children}</main>
      </div>
    );
  }

  // Três colunas: navegação à esquerda (só ícones até xl; barra inferior no celular),
  // a coluna de leitura com ~600 px no meio e a coluna "Descobrir" à direita (de 1100 px).
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1265px] justify-center">
      <Nav />
      <main className="min-h-dvh w-full min-w-0 max-w-[600px] border-borda pb-[calc(3.25rem+env(safe-area-inset-bottom))] sm:border-x sm:pb-0">
        {children}
      </main>
      <ColunaDireita />
    </div>
  );
}
