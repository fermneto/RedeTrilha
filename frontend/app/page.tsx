"use client";
// Início com duas abas, como no X: "Para você" (a rede inteira, a padrão, para o
// feed nunca começar vazio, com um bloco "Quem seguir" de tempos em tempos) e
// "Seguindo" (quem você segue e os seus). Cada aba rola infinitamente, 20 itens
// por vez (ver ListaDePoemas), e só monta na primeira vez que abre; depois fica
// escondida, sem perder a rolagem.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ChamadaEscrever } from "@/components/ChamadaEscrever";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { QuemSeguirNoFeed } from "@/components/QuemSeguirNoFeed";
import { buscarFeed, buscarParaVoce, caminhoDoLogin, temToken } from "@/lib/api";

const POR_PAGINA = 20;
// PROVISÓRIO: o bloco "Quem seguir" entra no "Para você" depois de cada tantos itens.
const QUEM_SEGUIR_A_CADA = 10;
const QUEM_SEGUIR = { cada: QUEM_SEGUIR_A_CADA, bloco: (i: number) => <QuemSeguirNoFeed indice={i} /> };

const ABAS = [
  { valor: "para-voce", rotulo: "Para você" },
  { valor: "seguindo", rotulo: "Seguindo" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

function buscarSeguindo(cursor: string | null) {
  return buscarFeed(cursor, POR_PAGINA);
}

function buscarDaRede(cursor: string | null) {
  return buscarParaVoce(cursor, POR_PAGINA);
}

export default function FeedPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("para-voce");

  useEffect(() => {
    if (!temToken()) router.replace(caminhoDoLogin());
  }, [router]);

  return (
    <div>
      <CabecalhoPagina titulo="Início" />
      <ChamadaEscrever />
      <Abas atual={aba} aoMudar={setAba}>
        {(valor) =>
          valor === "para-voce" ? (
            <ListaDePoemas
              buscar={buscarDaRede}
              textoDoFim="fim do feed"
              intercalar={QUEM_SEGUIR}
              vazio={
                <p className="px-4 py-10 text-center text-tinta-suave">
                  Ainda não há poemas na rede. <Link href="/escrever" className="underline">Escreva o primeiro</Link>.
                </p>
              }
            />
          ) : (
            <ListaDePoemas
              buscar={buscarSeguindo}
              textoDoFim="fim do feed"
              vazio={
                <p className="px-4 py-10 text-center text-tinta-suave">
                  Seu feed está vazio. <Link href="/escrever" className="underline">Escreva um poema</Link> ou{" "}
                  <Link href="/sugestoes" className="underline">encontre poetas para seguir</Link>.
                </p>
              }
            />
          )
        }
      </Abas>
    </div>
  );
}

// Abas no padrão do WAI-ARIA, como as do perfil: as setas trocam de aba.
function Abas({
  atual,
  aoMudar,
  children,
}: {
  atual: Aba;
  aoMudar: (aba: Aba) => void;
  children: (aba: Aba) => React.ReactNode;
}) {
  const id = useId();
  const [abertas, setAbertas] = useState<Set<Aba>>(new Set([atual]));
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setAbertas((a) => (a.has(atual) ? a : new Set(a).add(atual)));
  }, [atual]);

  function aoTeclar(e: React.KeyboardEvent) {
    const i = ABAS.findIndex((a) => a.valor === atual);
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const proxima = ABAS[(i + passo + ABAS.length) % ABAS.length].valor;
    aoMudar(proxima);
    botoes.current[proxima]?.focus();
  }

  return (
    <section>
      <div role="tablist" aria-label="Feeds" onKeyDown={aoTeclar} className="flex border-b border-borda">
        {ABAS.map(({ valor, rotulo }) => {
          const ativa = valor === atual;
          return (
            <button
              key={valor}
              ref={(el) => {
                botoes.current[valor] = el;
              }}
              id={`${id}-aba-${valor}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`${id}-painel-${valor}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudar(valor)}
              className={`realce flex min-h-13 flex-1 cursor-pointer items-center justify-center text-[0.9375rem] ${
                ativa ? "font-bold text-tinta" : "text-tinta-suave"
              }`}
            >
              <span
                className={`flex h-full items-center border-b-4 py-3 ${ativa ? "border-destaque" : "border-transparent"}`}
              >
                {rotulo}
              </span>
            </button>
          );
        })}
      </div>
      {ABAS.map(({ valor }) => (
        <div
          key={valor}
          id={`${id}-painel-${valor}`}
          role="tabpanel"
          aria-labelledby={`${id}-aba-${valor}`}
          hidden={valor !== atual}
        >
          {abertas.has(valor) && children(valor)}
        </div>
      ))}
    </section>
  );
}
