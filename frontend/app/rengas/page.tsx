"use client";
// Rengas: os poemas colaborativos de todo mundo, a mais nova primeiro. Os chips
// filtram abertas e fechadas; filtro e página moram na URL (?situacao=&pagina=),
// como no Acervo.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NomeAutor } from "@/components/NomeAutor";
import { Paginacao } from "@/components/Paginacao";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import {
  caminhoDoLogin,
  formatarData,
  listarRengas,
  mensagemDeFalha,
  temToken,
  type Page,
  type Renga,
  type SituacaoDaRenga,
} from "@/lib/api";

const POR_PAGINA = 20;

const FILTROS: { valor: SituacaoDaRenga | null; rotulo: string }[] = [
  { valor: null, rotulo: "Todas" },
  { valor: "aberta", rotulo: "Abertas" },
  { valor: "fechada", rotulo: "Fechadas" },
];

// Os mesmos chips do Explorar e do Acervo.
const chip =
  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition-colors duration-150";
const chipLigado = "bg-tinta text-papel hover:bg-tinta/85";
const chipDesligado = "border border-borda text-tinta hover:border-destaque hover:text-destaque";

function lerSituacao(valor: string | null): SituacaoDaRenga | null {
  return valor === "aberta" || valor === "fechada" ? valor : null;
}

function lerPagina(valor: string | null): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function caminhoDasRengas(situacao: SituacaoDaRenga | null, pagina: number): string {
  const busca = new URLSearchParams();
  if (situacao) busca.set("situacao", situacao);
  if (pagina > 1) busca.set("pagina", String(pagina));
  const texto = busca.toString();
  return texto ? `/rengas?${texto}` : "/rengas";
}

// useSearchParams precisa de Suspense no build estático do Next.
export default function RengasPage() {
  return (
    <Suspense>
      <Rengas />
    </Suspense>
  );
}

function Rengas() {
  const router = useRouter();
  const busca = useSearchParams();
  const situacao = lerSituacao(busca.get("situacao"));
  const pagina = lerPagina(busca.get("pagina"));
  const [resultado, setResultado] = useState<Page<Renga> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    setResultado(null);
    listarRengas(situacao, (pagina - 1) * POR_PAGINA, POR_PAGINA)
      .then((p) => {
        setResultado(p);
        setErro(null);
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar as rengas")));
  }, [situacao, pagina, router]);

  const totalDePaginas = resultado ? Math.ceil(resultado.total / POR_PAGINA) : 0;

  return (
    <div>
      <CabecalhoPagina titulo="Rengas" />
      <div className="space-y-4 border-b border-borda px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-tinta-suave">
            Poemas escritos a várias mãos, uma estrofe por vez.
          </p>
          <Link
            href="/rengas/nova"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110"
          >
            Nova renga
          </Link>
        </div>
        <nav aria-label="filtrar rengas" className="flex flex-wrap gap-2">
          {FILTROS.map(({ valor, rotulo }) => (
            <Link
              key={rotulo}
              href={caminhoDasRengas(valor, 1)}
              aria-current={valor === situacao ? "page" : undefined}
              className={`${chip} ${valor === situacao ? chipLigado : chipDesligado}`}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {erro && <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>}
      {!erro && !resultado && <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>}
      {resultado && resultado.items.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="font-serifada text-lg">Nenhuma renga por aqui ainda.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Escreva a primeira estrofe e chame a turma para continuar.
          </p>
        </div>
      )}
      {resultado && resultado.items.length > 0 && (
        <>
          <ul className="divide-y divide-borda border-b border-borda">
            {resultado.items.map((r) => (
              <li key={r.id}>
                <CartaoDaRenga renga={r} />
              </li>
            ))}
          </ul>
          <div className="py-4">
            <Paginacao
              atual={pagina}
              total={totalDePaginas}
              href={(p) => caminhoDasRengas(situacao, p)}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Cada linha: título (Literata), quem escreveu e, sempre na mesma posição à
// esquerda, o selo aberta/fechada, para a lista se ler de cima a baixo.
function CartaoDaRenga({ renga }: { renga: Renga }) {
  return (
    <article className="relative px-4 py-4 transition-colors duration-150 hover:bg-tinta/[0.03]">
      <h2 className="font-serifada text-xl leading-snug font-semibold tracking-[-0.01em] break-words">
        {/* O título é o link do cartão inteiro; os nomes por cima continuam clicáveis. */}
        <Link href={`/rengas/${renga.id}`} className="after:absolute after:inset-0 hover:underline">
          {renga.titulo}
        </Link>
      </h2>
      <p className="relative mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
        <span>{renga.fechada ? "um poema de" : "escrita por"}</span>
        {renga.autores.map((autor, i) => (
          <span key={autor.id} className="inline-flex min-w-0 items-center">
            <NomeAutor usuario={autor} className="font-semibold text-tinta" />
            {i < renga.autores.length - 1 && <span aria-hidden="true">,</span>}
          </span>
        ))}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-tinta-suave">
        <SeloDaRenga fechada={renga.fechada} />{" "}
        <span className="tabular-nums">
          {renga.fechada
            ? `${renga.qtd_estrofes} ${renga.qtd_estrofes === 1 ? "estrofe" : "estrofes"}`
            : `${renga.qtd_estrofes} de ${renga.limite} estrofes`}
        </span>
        , {renga.modo === "aberta" ? "qualquer pessoa escreve" : "só convidados"},{" "}
        {renga.fechada && renga.fechada_em
          ? `fechada em ${formatarData(renga.fechada_em)}`
          : `começada em ${formatarData(renga.created_at)}`}
      </p>
    </article>
  );
}
