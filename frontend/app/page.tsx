"use client";
// Início com duas abas, como no X: "Para você" (a rede inteira, a padrão, para o
// feed nunca começar vazio, com um bloco "Quem seguir" de tempos em tempos) e
// "Seguindo" (quem você segue e os seus). Cada aba rola infinitamente, 20 itens
// por vez (ver ListaDePoemas), e só monta na primeira vez que abre; depois fica
// escondida, sem perder a rolagem.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Abas } from "@/components/Abas";
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
      <Abas abas={ABAS} atual={aba} aoMudar={setAba} rotulo="Feeds">
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
