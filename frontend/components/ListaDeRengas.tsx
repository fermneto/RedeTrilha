"use client";
// As rengas de todo mundo, a mais nova primeiro, numa aba do Explorar. Os chips
// filtram abertas (para participar), fechadas e as minhas (que criei, em que
// escrevi ou para as quais fui convidado); filtro e página moram na URL
// (?aba=rengas&situacao=&pagina=), como no Acervo, e é o Explorar que lê a URL.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AutoresDaRenga } from "@/components/AutoresDaRenga";
import { AvisoDeErro } from "@/components/AvisoDeErro";
import { AcoesDaRenga } from "@/components/BarraDeAcoes";
import { EsqueletoDeRengas } from "@/components/Esqueleto";
import { Paginacao } from "@/components/Paginacao";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import {
  formatarData,
  listarRengas,
  mensagemDeFalha,
  type Page,
  type Renga,
  type SituacaoDaRenga,
} from "@/lib/api";
import { noPlural } from "@/lib/numeros";

const POR_PAGINA = 20;

// "minhas" só existe no front: vira `minhas=true` na API.
type FiltroDasRengas = SituacaoDaRenga | "minhas";

const FILTROS: { valor: FiltroDasRengas | null; rotulo: string }[] = [
  { valor: null, rotulo: "Todas" },
  { valor: "aberta", rotulo: "Abertas" },
  { valor: "fechada", rotulo: "Fechadas" },
  { valor: "minhas", rotulo: "Minhas" },
];

const VAZIO: Record<FiltroDasRengas | "todas", string> = {
  todas: "Nenhuma renga por aqui ainda.",
  aberta: "Nenhuma renga aberta agora.",
  fechada: "Nenhuma renga fechada ainda.",
  minhas: "Você ainda não está em nenhuma renga.",
};

// Os mesmos chips do Explorar e do Acervo.
const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-150";
const chipLigado = "bg-tinta text-papel hover:bg-tinta/85";
const chipDesligado = "border border-borda text-tinta hover:border-destaque hover:text-destaque";

export function lerSituacao(valor: string | null): FiltroDasRengas | null {
  return valor === "aberta" || valor === "fechada" || valor === "minhas" ? valor : null;
}

export function lerPagina(valor: string | null): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function caminhoDasRengas(situacao: FiltroDasRengas | null, pagina: number): string {
  const busca = new URLSearchParams({ aba: "rengas" });
  if (situacao) busca.set("situacao", situacao);
  if (pagina > 1) busca.set("pagina", String(pagina));
  return `/explorar?${busca}`;
}

export function ListaDeRengas({ situacao, pagina }: { situacao: FiltroDasRengas | null; pagina: number }) {
  const [resultado, setResultado] = useState<Page<Renga> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const filtros = useRef<HTMLElement>(null);

  // No celular a fila de chips rola de lado: o filtro escolhido fica à vista.
  useEffect(() => {
    filtros.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [situacao]);

  useEffect(() => {
    setResultado(null);
    const minhas = situacao === "minhas";
    listarRengas(minhas ? null : situacao, (pagina - 1) * POR_PAGINA, POR_PAGINA, minhas)
      .then((p) => {
        setResultado(p);
        setErro(null);
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar as rengas")));
  }, [situacao, pagina]);

  const totalDePaginas = resultado ? Math.ceil(resultado.total / POR_PAGINA) : 0;

  return (
    <div>
      <div className="linha-da-folha space-y-3 border-b border-borda py-4">
        <p className="text-sm text-tinta-suave">Poemas escritos a várias mãos, uma estrofe por vez.</p>
        {/* Como os chips de forma do Explorar: no celular, uma fila que rola de lado. */}
        <nav
          ref={filtros}
          aria-label="filtrar rengas"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible"
        >
          {FILTROS.map(({ valor, rotulo }) => (
            <Link
              key={rotulo}
              href={caminhoDasRengas(valor, 1)}
              replace
              scroll={false}
              aria-current={valor === situacao ? "page" : undefined}
              className={`${chip} ${valor === situacao ? chipLigado : chipDesligado}`}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {erro && <AvisoDeErro className="m-4">{erro}</AvisoDeErro>}
      {!erro && !resultado && <EsqueletoDeRengas quantos={6} />}
      {resultado && resultado.items.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="font-serifada text-lg">{VAZIO[situacao ?? "todas"]}</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Escreva a primeira estrofe e chame a turma para continuar.
          </p>
          <Link
            href="/rengas/nova"
            className="realce mt-4 inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold"
          >
            Abrir uma renga
          </Link>
        </div>
      )}
      {resultado && resultado.items.length > 0 && (
        <>
          <ul className="surgir lista-da-folha divide-y divide-borda border-b border-borda">
            {resultado.items.map((r) => (
              <li key={r.id}>
                <CartaoDaRenga renga={r} />
              </li>
            ))}
          </ul>
          <div className="py-4">
            <Paginacao atual={pagina} total={totalDePaginas} href={(p) => caminhoDasRengas(situacao, p)} />
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
        <AutoresDaRenga renga={renga} className="min-w-0" />
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-tinta-suave">
        <SeloDaRenga fechada={renga.fechada} />{" "}
        <span className="tabular-nums">
          {renga.fechada
            ? `${renga.qtd_estrofes} ${noPlural(renga.qtd_estrofes, "estrofe", "estrofes")}`
            : `${renga.qtd_estrofes} de ${renga.limite} estrofes`}
        </span>
        , {renga.modo === "aberta" ? "qualquer pessoa escreve" : "só convidados"},{" "}
        {renga.fechada && renga.fechada_em
          ? `fechada em ${formatarData(renga.fechada_em)}`
          : `começada em ${formatarData(renga.created_at)}`}
      </p>
      {/* Por cima do link do cartão, como os nomes: as ações do poema (#171). */}
      <div className="relative">
        <AcoesDaRenga key={renga.id} renga={renga} />
      </div>
    </article>
  );
}
