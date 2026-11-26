"use client";
// Explorar, como o do X: a busca fixa no topo (tags e poetas num campo só), o
// "Em alta" com posição, contagem e um verso, e os poemas de todos, mais novos
// primeiro, filtrados por tag e por chips de forma. Os filtros moram na URL
// (?tag=&forma=): a busca, o "Em alta" e as #tags do PoemaCard trazem para cá.
//
// Abaixo da busca, quatro abas: Poemas, Poetas (o Acervo, com filtros), Rengas
// (abertas para participar e fechadas) e Antologias (as públicas de todo mundo).
// Acervo, rengas e antologias saíram da navegação e se descobrem aqui (decisões do
// Neto). Poetas vem logo depois de Poemas: são as duas formas de achar o que ler,
// pelo poema ou pelo poeta. A aba também mora na URL (?aba=poetas&tipo=&q=...,
// ?aba=rengas&situacao=&pagina=, ?aba=antologias; o ?aba=acervo de antes vira
// ?aba=poetas); com uma tag escolhida, a tela é o resultado dela e as abas somem,
// como na busca do X.
//
// Um campo de busca só: na aba Poetas, o campo do topo filtra o Acervo pelo nome
// (o ?q=); nas outras, busca #tag ou poeta, com a lista de sugestões.

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useId, useState } from "react";

import { Abas } from "@/components/Abas";
import { Acervo, BuscaDosPoetas } from "@/components/Acervo";
import { AntologiaLista } from "@/components/AntologiaLista";
import { BuscaDoExplorar } from "@/components/BuscaDoExplorar";
import { DescobrirNoTopo } from "@/components/ColunaDireita";
import { ListaEmAlta, useEmAlta } from "@/components/EmAlta";
import { EsqueletoDeEmAlta } from "@/components/Esqueleto";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { lerPagina, lerSituacao, ListaDeRengas } from "@/components/ListaDeRengas";
import {
  buscarExplorar,
  caminhoDoAcervo,
  caminhoDoLogin,
  FORMAS,
  hashtag,
  lerFiltrosDoAcervo,
  listarAntologiasPublicas,
  nomeDaForma,
  normalizarTag,
  temToken,
} from "@/lib/api";

const ABAS = [
  { valor: "poemas", rotulo: "Poemas" },
  { valor: "poetas", rotulo: "Poetas" },
  { valor: "rengas", rotulo: "Rengas" },
  { valor: "antologias", rotulo: "Antologias" },
] as const;

type Aba = (typeof ABAS)[number]["valor"];

function lerAba(valor: string | null): Aba {
  return ABAS.some((a) => a.valor === valor) ? (valor as Aba) : "poemas";
}

const chip =
  "min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque";
const chipLigado = "bg-tinta text-papel hover:bg-tinta/85";
const chipDesligado = "border border-borda text-tinta hover:border-destaque hover:text-destaque";

// useSearchParams precisa de Suspense no build estático do Next.
export default function ExplorarPage() {
  return (
    <Suspense>
      <Explorar />
    </Suspense>
  );
}

function Explorar() {
  const router = useRouter();
  const params = useSearchParams();
  const tag = normalizarTag(params.get("tag") ?? "");
  const formaDaUrl = params.get("forma");
  const forma = formaDaUrl && (FORMAS as readonly string[]).includes(formaDaUrl) ? formaDaUrl : null;
  const aba = tag ? "poemas" : lerAba(params.get("aba"));
  const idDasFormas = useId();
  // Como na coluna direita: as rotas do topo são protegidas, então só com login.
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    if (temToken()) setLogado(true);
    else router.replace(caminhoDoLogin());
  }, [router]);

  // A aba Poetas se chamava Acervo: o ?aba=acervo dos links antigos vira
  // ?aba=poetas, com os filtros e a página.
  let destinoDaAbaAntiga: string | null = null;
  if (params.get("aba") === "acervo") {
    const { filtros, pagina } = lerFiltrosDoAcervo(params);
    destinoDaAbaAntiga = caminhoDoAcervo(filtros, pagina);
  }
  useEffect(() => {
    if (destinoDaAbaAntiga) router.replace(destinoDaAbaAntiga);
  }, [router, destinoDaAbaAntiga]);

  const filtrar = useCallback(
    (novaTag: string, novaForma: string | null) => {
      const busca = new URLSearchParams();
      if (novaTag) busca.set("tag", novaTag);
      if (novaForma) busca.set("forma", novaForma);
      const texto = busca.toString();
      router.replace(texto ? `/explorar?${texto}` : "/explorar", { scroll: false });
    },
    [router],
  );

  const buscar = useCallback(
    (cursor: string | null) => buscarExplorar({ tag: tag || null, forma }, cursor),
    [tag, forma],
  );

  // Trocar de aba começa a outra do zero (sem filtro), e replace não enche o "voltar".
  function trocarAba(nova: Aba) {
    router.replace(nova === "poemas" ? "/explorar" : `/explorar?aba=${nova}`, { scroll: false });
  }

  const comFiltro = Boolean(tag || forma);
  const limpar = (
    <button
      type="button"
      onClick={() => filtrar("", null)}
      className="min-h-11 shrink-0 cursor-pointer px-1 text-sm font-semibold text-destaque hover:underline"
    >
      limpar filtros
    </button>
  );

  const poemas = (
    <>
      {/* Com uma tag escolhida, a tela vira o resultado dela, como a busca do X. */}
      {tag ? (
        <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
          <h2 className="min-w-0 text-xl font-bold break-words">{hashtag(tag)}</h2>
          {limpar}
        </div>
      ) : (
        logado && <EmAltaDoExplorar />
      )}

      {/* O resto da página Descobrir, quando ela some (na página única). */}
      {logado && !tag && (
        <div className="space-y-3 border-b border-borda px-4 py-4 empty:hidden lg:hidden">
          <DescobrirNoTopo />
        </div>
      )}

      <section aria-labelledby={idDasFormas} className="border-b border-borda py-3">
        <div className="flex items-center justify-between gap-3 px-4">
          <h2 id={idDasFormas} className="text-xl font-bold">
            {tag ? "Por forma" : "Poemas recentes"}
          </h2>
          {!tag && forma && limpar}
        </div>
        <div
          role="group"
          aria-label="Filtrar por forma"
          className="mt-2 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible"
        >
          <button
            type="button"
            aria-pressed={forma === null}
            onClick={() => filtrar(tag, null)}
            className={`${chip} ${forma === null ? chipLigado : chipDesligado}`}
          >
            todas
          </button>
          {FORMAS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={forma === f}
              onClick={() => filtrar(tag, forma === f ? null : f)}
              className={`${chip} ${forma === f ? chipLigado : chipDesligado}`}
            >
              {nomeDoChip(f)}
            </button>
          ))}
        </div>
      </section>

      <ListaDePoemas
        key={`${tag}|${forma ?? ""}`}
        buscar={buscar}
        textoDoFim="fim dos poemas"
        vazio={
          <div className="px-4 py-10 text-center text-tinta-suave">
            <p>{textoDoVazio(tag, forma)}</p>
            {comFiltro && limpar}
          </div>
        }
      />
    </>
  );

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-borda bg-papel">
        <h1 className="sr-only">Explorar</h1>
        {aba === "poetas" ? (
          <BuscaDosPoetas />
        ) : (
          <BuscaDoExplorar tagAtual={tag} aoEscolherTag={(nova) => filtrar(nova, forma)} />
        )}
      </header>

      {tag ? (
        poemas
      ) : (
        <Abas abas={ABAS} atual={aba} aoMudar={trocarAba} rotulo="O que explorar">
          {(valor) =>
            valor === "poemas" ? (
              poemas
            ) : valor === "poetas" ? (
              // Só a aba aberta monta o Acervo: escondido, ele leria os
              // parâmetros das outras abas (a ?pagina= das rengas) e buscaria à toa.
              logado && aba === "poetas" && <Acervo />
            ) : valor === "rengas" ? (
              logado && (
                <ListaDeRengas situacao={lerSituacao(params.get("situacao"))} pagina={lerPagina(params.get("pagina"))} />
              )
            ) : (
              logado && <AntologiasDoExplorar />
            )
          }
        </Abas>
      )}
    </div>
  );
}

// As antologias públicas de todo mundo com ao menos um poema, a mais nova primeiro.
function AntologiasDoExplorar() {
  return (
    <div>
      <p className="border-b border-borda px-4 py-4 text-sm text-tinta-suave">
        Coleções de poemas reunidas por quem lê, como uma antologia de verdade.
      </p>
      <AntologiaLista
        buscar={listarAntologiasPublicas}
        comDono
        vazio={
          <div className="px-4 py-10 text-center">
            <p className="font-serifada text-lg">Nenhuma antologia pública ainda.</p>
            <p className="mt-1 text-sm text-tinta-suave">Reúna os poemas que você ama e mostre para a rede.</p>
            <Link
              href="/antologias/nova"
              className="realce mt-4 inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold"
            >
              Criar uma antologia
            </Link>
          </div>
        }
      />
    </div>
  );
}

// Quantas tags o "Em alta" mostra aqui (a coluna direita mostra 5).
const TAGS_EM_ALTA = 10;

// "Em alta" no corpo da tela; some quando não há tags nas últimas 24 h.
function EmAltaDoExplorar() {
  const tags = useEmAlta(TAGS_EM_ALTA);
  if (tags?.length === 0) return null;
  return (
    <section aria-labelledby="em-alta" className="border-b border-borda pt-3 pb-1">
      <h2 id="em-alta" className="px-4 text-xl font-bold">
        Em alta
      </h2>
      {tags ? <ListaEmAlta tags={tags} /> : <EsqueletoDeEmAlta quantos={TAGS_EM_ALTA} />}
    </section>
  );
}

// No filtro, "outro" é o grupo das formas fora da lista.
function nomeDoChip(forma: string): string {
  return forma === "outro" ? "outras formas" : nomeDaForma(forma);
}

function textoDoVazio(tag: string, forma: string | null): string {
  if (!forma) return tag ? `Nenhum poema com ${hashtag(tag)}.` : "Ainda não há poemas.";
  const naForma = forma === "outro" ? "em outras formas" : `na forma ${nomeDaForma(forma)}`;
  return tag ? `Nenhum poema com ${hashtag(tag)} ${naForma}.` : `Nenhum poema ${naForma}.`;
}
