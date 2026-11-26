"use client";
// Início como um caderno: cada poema do feed é uma folha. Na página da esquerda,
// o poema; na da direita, as ações e os comentários dele. Passar a página traz o
// próximo poema, e perto do fim do que já veio, a próxima página do feed (por
// cursor, 20 itens por vez). Dois feeds, como antes: "Para você" (a rede inteira,
// o padrão, para o caderno nunca começar vazio) e "Seguindo" (quem você segue e
// os seus); a troca fica no alto da página da esquerda.
//
// Como no X, a leitura continua de onde parou (lib/sessaoDoFeed.ts): trocar de
// aba, ir a outra página e voltar, seguir alguém ou recarregar reabre cada aba na
// mesma folha, com o que já tinha carregado. Um poema visto numa aba não aparece
// na outra. Recomeça do topo só tocando em Início estando no Início.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CadernoFolhas, type Folha } from "@/components/CadernoFolhas";
import { folhaDoItem, MARGEM_DA_PAGINA } from "@/components/CadernoPoema";
import { EsqueletoDePoema } from "@/components/Esqueleto";
import { useFeedPorCursor } from "@/hooks/useFeedPorCursor";
import { buscarEu, buscarFeed, buscarParaVoce, caminhoDoLogin, temToken, type FeedPage } from "@/lib/api";
import { EVENTO_FEED_RECOMECOU, guardarSessao, sessaoAtual, type Aba } from "@/lib/sessaoDoFeed";

const POR_PAGINA = 20;
// A próxima página do feed é pedida quando faltam estas folhas para o fim.
const FOLHAS_DE_FOLGA = 3;

const FEEDS: readonly { valor: Aba; rotulo: string }[] = [
  { valor: "para-voce", rotulo: "Para você" },
  { valor: "seguindo", rotulo: "Seguindo" },
];

const BUSCAR: Record<Aba, (cursor: string | null) => Promise<FeedPage>> = {
  "para-voce": (cursor) => buscarParaVoce(cursor, POR_PAGINA),
  seguindo: (cursor) => buscarFeed(cursor, POR_PAGINA),
};

const nadaAssinar = () => () => {};

export default function FeedPage() {
  // A sessão do feed mora no navegador (sessionStorage): no servidor e na
  // hidratação, só o esqueleto; depois, o caderno de onde a pessoa parou.
  const noNavegador = useSyncExternalStore(
    nadaAssinar,
    () => true,
    () => false,
  );
  return noNavegador ? <Inicio /> : <div className={MARGEM_DA_PAGINA}><EsqueletoDePoema inteiro /></div>;
}

function Inicio() {
  const router = useRouter();
  const [feed, setFeed] = useState<Aba>(() => sessaoAtual().aba);
  const [euId, setEuId] = useState<number | null>(null);
  // Muda quando a pessoa pede o feed do topo (Início no Início): recomeça as duas abas.
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => setEuId(null));
  }, [router]);

  useEffect(() => {
    const aoRecomecar = () => {
      setFeed(sessaoAtual().aba);
      setVersao((v) => v + 1);
    };
    window.addEventListener(EVENTO_FEED_RECOMECOU, aoRecomecar);
    return () => window.removeEventListener(EVENTO_FEED_RECOMECOU, aoRecomecar);
  }, []);

  function trocar(aba: Aba) {
    setFeed(aba);
    guardarSessao((sessao) => ({ ...sessao, aba }));
  }

  const topo = <TrocaDeFeed atual={feed} aoMudar={trocar} />;
  return (
    <Caderno
      key={`${feed}-${versao}`}
      aba={feed}
      euId={euId}
      topo={topo}
      vazio={feed === "para-voce" ? <VazioDaRede /> : <VazioDoSeguindo />}
    />
  );
}

function Caderno({
  aba,
  euId,
  topo,
  vazio,
}: {
  aba: Aba;
  euId: number | null;
  topo: React.ReactNode;
  vazio: React.ReactNode;
}) {
  const { itens, fim, erro, posicao, aoMudar, tentarDeNovo } = useFeedPorCursor(aba, BUSCAR[aba], FOLHAS_DE_FOLGA);

  const folhas: Folha[] = itens.map((item) => folhaDoItem(item, euId, topo));
  if (!fim || erro) {
    folhas.push({
      chave: "carregando",
      rotulo: erro ?? "carregando o próximo poema",
      esquerda: (
        <div className="pb-4">
          {topo}
          <div className={MARGEM_DA_PAGINA}>
            {erro ? (
              <div className="text-sm text-destaque">
                <p>{erro}</p>
                <button type="button" onClick={tentarDeNovo} className="mt-1 min-h-11 cursor-pointer underline">
                  tentar de novo
                </button>
              </div>
            ) : (
              <EsqueletoDePoema inteiro />
            )}
          </div>
        </div>
      ),
    });
  } else {
    folhas.push({
      chave: "fim",
      rotulo: itens.length === 0 ? "o caderno está vazio" : "fim do feed",
      esquerda: (
        <div className="pb-4">
          {topo}
          <div className={`${MARGEM_DA_PAGINA} text-tinta-suave`}>
            {itens.length === 0 ? vazio : <FimDoFeed />}
          </div>
        </div>
      ),
    });
  }

  return (
    <CadernoFolhas
      folhas={folhas}
      abrirEm={posicao}
      aoMudar={aoMudar}
      anterior="poema anterior"
      proxima="próximo poema"
    />
  );
}

// A troca de feed: dois botões de alternar, sem abas (as setas do teclado viram a página).
function TrocaDeFeed({ atual, aoMudar }: { atual: Aba; aoMudar: (feed: Aba) => void }) {
  return (
    <div role="group" aria-label="Feed" className="flex gap-5 px-6 pt-6 sm:px-10 lg:px-14 lg:pt-8">
      {FEEDS.map(({ valor, rotulo }) => {
        const ativo = valor === atual;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar(valor)}
            className={`min-h-11 cursor-pointer border-b-2 text-sm transition-colors duration-150 ${
              ativo ? "border-destaque font-semibold text-tinta" : "border-transparent text-tinta-suave hover:text-tinta"
            }`}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

function FimDoFeed() {
  return (
    <div className="pt-16 text-center">
      <p className="font-serifada text-lg text-tinta italic">fim do feed</p>
      <p className="mt-2 text-sm">
        Volte as páginas, ou <Link href="/escrever" className="underline">escreva a próxima</Link>.
      </p>
    </div>
  );
}

function VazioDaRede() {
  return (
    <p className="pt-16 text-center">
      Ainda não há poemas na rede. <Link href="/escrever" className="underline">Escreva o primeiro</Link>.
    </p>
  );
}

function VazioDoSeguindo() {
  return (
    <p className="pt-16 text-center">
      Seu feed está vazio. <Link href="/escrever" className="underline">Escreva um poema</Link> ou{" "}
      <Link href="/sugestoes" className="underline">encontre poetas para seguir</Link>.
    </p>
  );
}
