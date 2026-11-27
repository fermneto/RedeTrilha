"use client";
// Lista de poemas com rolagem infinita, como no X: a próxima página pede o
// `proximo_cursor` quando o fim da lista entra na tela. Usada pelo feed, pelo perfil
// e pelo Explorar (que pagina por offset: ver buscarExplorar em lib/api.ts). No feed
// e no perfil, as rengas vêm misturadas aos poemas.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { AvisoDeErro } from "@/components/AvisoDeErro";
import { EsqueletoDaLista } from "@/components/Esqueleto";
import { PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
import { chaveDoItem, ehRenga, mensagemDeFalha, temToken, type FeedPage, type ItemDoFeed } from "@/lib/api";

type Props = {
  // Busca uma página a partir do cursor (null = primeira). Para trocar de lista,
  // remonte o componente com outra `key` em vez de trocar a função.
  buscar: (cursor: string | null) => Promise<FeedPage>;
  // O que mostrar quando a lista termina sem nenhum poema.
  vazio: React.ReactNode;
  // Aviso no fim da lista (ex.: "fim do feed").
  textoDoFim: string;
  // Um bloco que não é item do feed, depois de cada `cada` itens (o "Quem seguir"
  // do Para você). Recebe o número do bloco (0, 1, 2...).
  intercalar?: { cada: number; bloco: (indice: number) => React.ReactNode };
};

export function ListaDePoemas({ buscar, vazio, textoDoFim, intercalar }: Props) {
  const [poemas, setPoemas] = useState<ItemDoFeed[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ref e não estado: evita dois pedidos da mesma página antes do re-render.
  const pedindo = useRef(false);
  const sentinela = useRef<HTMLDivElement>(null);

  const carregarMais = useCallback(async () => {
    if (pedindo.current || fim) return;
    pedindo.current = true;
    setCarregando(true);
    try {
      const pagina = await buscar(cursor);
      setPoemas((atuais) => {
        const vistos = new Set(atuais.map(chaveDoItem));
        return [...atuais, ...pagina.items.filter((p) => !vistos.has(chaveDoItem(p)))];
      });
      setCursor(pagina.proximo_cursor);
      setFim(pagina.proximo_cursor === null);
      setErro(null);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar os poemas"));
    } finally {
      pedindo.current = false;
      setCarregando(false);
    }
  }, [buscar, cursor, fim]);

  // O observer é recriado a cada página (cursor novo); com erro, para de pedir.
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || fim || erro || !temToken()) return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) carregarMais();
      },
      { rootMargin: "400px" },
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [carregarMais, fim, erro]);

  return (
    <div>
      <ul className="lista-da-folha divide-y divide-borda border-b border-borda">
        {poemas.map((p, i) => (
          <Fragment key={chaveDoItem(p)}>
            <li className="surgir">{ehRenga(p) ? <RengaCard renga={p.renga} atividade={p.atividade} por={p.por} /> : <PoemaCard post={p} />}</li>
            {intercalar && (i + 1) % intercalar.cada === 0 && (
              <li className="surgir">{intercalar.bloco((i + 1) / intercalar.cada - 1)}</li>
            )}
          </Fragment>
        ))}
      </ul>

      {erro && (
        <AvisoDeErro className="m-4" como="div">
          <p>{erro}</p>
          <button type="button" onClick={() => setErro(null)} className="mt-1 cursor-pointer underline">
            tentar de novo
          </button>
        </AvisoDeErro>
      )}

      {fim && poemas.length === 0 && vazio}

      {fim && poemas.length > 0 && <p className="py-8 text-center text-sm text-tinta-suave">{textoDoFim}</p>}

      <div ref={sentinela} aria-hidden />
      {/* A primeira página ocupa a tela; a seguinte, o pé da lista. */}
      {carregando && <EsqueletoDaLista quantos={poemas.length === 0 ? 3 : 2} desde={poemas.length} />}
    </div>
  );
}
