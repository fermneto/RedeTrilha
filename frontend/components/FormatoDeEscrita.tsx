// O que escrever: Poema, Renga ou Antologia, no topo do compositor (/escrever) e
// dos formulários de renga (/rengas/nova) e de antologia (/antologias/nova). O
// "Escrever" da navegação abre direto no poema, então o poema nunca custa um clique
// a mais; trocar de formato é trocar de página, por isso são links (com
// aria-current), e não abas nem um modal.
//
// No compositor, `aoEscolher` deixa a página olhar a troca antes: levar o poema
// para a renga, ou segurar a ida à antologia para perguntar o que fazer com ele
// (a pergunta vem em `children`, logo abaixo do seletor).

import Link from "next/link";

const FORMATOS = [
  { valor: "poema", rotulo: "Poema", href: "/escrever" },
  { valor: "renga", rotulo: "Renga", href: "/rengas/nova" },
  { valor: "antologia", rotulo: "Antologia", href: "/antologias/nova" },
] as const;

export type Formato = (typeof FORMATOS)[number]["valor"];

type Props = {
  atual: Formato;
  // Chamado no clique, antes de navegar; `e.preventDefault()` segura a troca.
  aoEscolher?: (formato: Formato, e: React.MouseEvent<HTMLAnchorElement>) => void;
  children?: React.ReactNode;
};

export function FormatoDeEscrita({ atual, aoEscolher, children }: Props) {
  return (
    // data-sem-folhear: a troca de formato pode ser segurada (a pergunta da
    // antologia), e o livro não deve folhear sem sair da página (Folhear.tsx).
    <nav aria-label="O que escrever" data-sem-folhear="" className="px-4 py-3">
      <ul className="inline-flex rounded-full border border-borda p-1">
        {FORMATOS.map(({ valor, rotulo, href }) => {
          const ativo = valor === atual;
          return (
            <li key={valor}>
              <Link
                href={href}
                replace
                aria-current={ativo ? "page" : undefined}
                onClick={ativo ? undefined : (e) => aoEscolher?.(valor, e)}
                className={`flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition-colors duration-150 ${
                  ativo ? "bg-tinta text-papel" : "text-tinta-suave hover:text-tinta"
                }`}
              >
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
      {children}
    </nav>
  );
}
