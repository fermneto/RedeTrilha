// A tela cheia do onboarding, sem a navegação do site: no topo só a marca e o
// passo, embaixo uma barra fixa com as ações (acima dos botões Seguir dos cartões,
// que são z-10). O filete do topo é a barra de progresso: vai se preenchendo de
// tinta a cada passo. As preferências pelo menu usam os mesmos passos dentro do
// layout do site, com a PassosNoSite.

import Link from "next/link";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";

type Props = {
  // Passo atual (1, 2, 3...) e total; sem total (ou com 1), não há progresso.
  passo?: number;
  total?: number;
  // "estreita" para as perguntas, "larga" para a grade de perfis.
  largura?: "estreita" | "larga";
  // As ações da barra de baixo (voltar à esquerda; pular/cancelar e continuar à direita).
  acoes: React.ReactNode;
  children: React.ReactNode;
};

const LARGURAS = { estreita: "max-w-[38rem]", larga: "max-w-[60rem]" };

export function TelaDeBoasVindas({ passo = 1, total = 1, largura = "estreita", acoes, children }: Props) {
  const coluna = `mx-auto w-full ${LARGURAS[largura]} px-4 sm:px-6`;
  const comProgresso = total > 1;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative border-b border-borda">
        {/* O nome e o "passo 2 de 3" na mesma linha de base; o pt-3.5 centra o
            nome (28 px) na faixa de 56 px, onde ele já ficava. */}
        <div className={`${coluna} flex h-14 items-baseline justify-between gap-4 pt-3.5`}>
          <Link
            href="/"
            aria-label="Verso, início"
            className="-mx-1 rounded-lg px-1 font-serifada text-[1.75rem] leading-none font-semibold italic tracking-tight"
          >
            <span aria-hidden="true">Verso</span>
          </Link>
          {comProgresso && (
            <p className="text-sm text-tinta-suave tabular-nums">
              passo {passo} de {total}
            </p>
          )}
        </div>
        {comProgresso && (
          <span
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-0.5 bg-tinta transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{ width: `${(passo / total) * 100}%` }}
          />
        )}
      </header>

      <main className={`${coluna} flex-1 pt-10 pb-12 sm:pt-16`}>{children}</main>

      <footer className="sticky bottom-0 z-20 border-t border-borda bg-papel pb-[env(safe-area-inset-bottom)]">
        <div className={`${coluna} flex min-h-17 items-center justify-between gap-3 py-3`}>{acoes}</div>
      </footer>
    </div>
  );
}

// Os mesmos passos dentro do layout do site (as /preferencias): o cabeçalho da
// coluna, o passo em texto e as ações no fim, sem barra fixa (no celular, a
// barra de navegação do site já ocupa o rodapé).
export function PassosNoSite({ passo = 1, total = 1, acoes, children }: Omit<Props, "largura">) {
  return (
    <div>
      <CabecalhoPagina titulo="Preferências" comoTitulo={false} voltar />
      <div className="p-4">
        {total > 1 && (
          <p className="mb-3 text-sm text-tinta-suave tabular-nums">
            passo {passo} de {total}
          </p>
        )}
        {children}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-4">{acoes}</div>
      </div>
    </div>
  );
}

// Os botões da barra, iguais em todos os passos. O secundário é só texto: quem
// chama acerta a margem (-ml-4 ou -mr-4) para o texto alinhar com a coluna.
export const BOTAO_SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold text-tinta-suave transition-colors duration-150 hover:text-destaque";
export const BOTAO_PRIMARIO =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-destaque px-6 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50";

// Título e texto de abertura de cada passo. O h1 recebe o foco quando o passo
// muda na mesma página, para o leitor de tela anunciar a nova pergunta.
export function AberturaDoPasso({
  titulo,
  children,
  refTitulo,
  compacta = false,
}: {
  titulo: string;
  children?: React.ReactNode;
  refTitulo?: React.Ref<HTMLHeadingElement>;
  // Na coluna de 600 px do site o título é menor que na tela cheia.
  compacta?: boolean;
}) {
  const tamanho = compacta ? "text-2xl" : "text-[1.75rem] sm:text-[2.25rem]";
  return (
    <div className={compacta ? "mb-8 space-y-2" : "mb-10 space-y-3"}>
      <h1 ref={refTitulo} tabIndex={-1} className={`${tamanho} leading-tight outline-none`}>
        {titulo}
      </h1>
      {children && <p className="max-w-[56ch] text-tinta-suave">{children}</p>}
    </div>
  );
}
