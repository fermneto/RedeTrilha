"use client";
// Feed com rolagem infinita, como no X: 20 poemas por vez, e a próxima página
// pede o `proximo_cursor` quando o fim da lista entra na tela.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PoemaCard } from "@/components/PoemaCard";
import { buscarFeed, temToken, type Post } from "@/lib/api";

const POR_PAGINA = 20;

export default function FeedPage() {
  const router = useRouter();
  const [poemas, setPoemas] = useState<Post[]>([]);
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
      const pagina = await buscarFeed(cursor, POR_PAGINA);
      setPoemas((atuais) => {
        const vistos = new Set(atuais.map((p) => p.id));
        return [...atuais, ...pagina.items.filter((p) => !vistos.has(p.id))];
      });
      setCursor(pagina.proximo_cursor);
      setFim(pagina.proximo_cursor === null);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para carregar o feed");
    } finally {
      pedindo.current = false;
      setCarregando(false);
    }
  }, [cursor, fim]);

  useEffect(() => {
    if (!temToken()) router.replace("/login");
  }, [router]);

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
    <div className="space-y-6">
      <h1 className="text-3xl">Feed</h1>

      <ul className="space-y-6">
        {poemas.map((p) => (
          <li key={p.id}>
            <PoemaCard post={p} />
          </li>
        ))}
      </ul>

      {erro && (
        <div className="rounded border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button type="button" onClick={() => setErro(null)} className="mt-1 cursor-pointer underline">
            tentar de novo
          </button>
        </div>
      )}

      {fim && poemas.length === 0 && (
        <p className="text-tinta-suave">
          Seu feed está vazio. <Link href="/escrever" className="underline">Escreva um poema</Link> ou
          siga outros poetas.
        </p>
      )}

      {fim && poemas.length > 0 && <p className="text-center text-sm text-tinta-suave">fim do feed</p>}

      <div ref={sentinela} aria-hidden />
      {carregando && <p className="text-center text-sm text-tinta-suave">carregando...</p>}
    </div>
  );
}
