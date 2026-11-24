"use client";
// Sugestões de quem seguir: a tela logo depois do cadastro (e o link no Descobrir e
// no Seguindo vazio). Cada card tem avatar, nome com selo, bio curta, o começo do
// último poema e o botão seguir; "pular" (ou "continuar", depois de seguir alguém)
// leva ao Início, que abre no "Para você".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NomeAutor } from "@/components/NomeAutor";
import { buscarSugestoes, caminhoDoLogin, seguir, temToken, type Sugestao } from "@/lib/api";

// PROVISÓRIO: quantas contas a tela mostra (o backend pagina; "ver mais" pede outras).
const POR_PAGINA = 12;

export default function SugestoesPage() {
  const router = useRouter();
  const [contas, setContas] = useState<Sugestao[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [seguidas, setSeguidas] = useState(0);

  async function carregar(offset: number) {
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await buscarSugestoes(offset, POR_PAGINA);
      setContas((atuais) => (offset === 0 ? pagina.items : [...atuais, ...pagina.items]));
      setTotal(pagina.total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para carregar as sugestões");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    carregar(0);
  }, [router]);

  return (
    <div>
      <title>Quem seguir · Verso</title>
      <CabecalhoPagina titulo="Quem seguir" />
      <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
        <p className="text-sm text-tinta-suave">
          Siga poetas para ver os poemas deles na aba Seguindo.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-borda px-4 text-sm font-bold hover:border-destaque hover:text-destaque"
        >
          {seguidas > 0 ? "continuar" : "pular"}
        </Link>
      </div>

      <ul className="divide-y divide-borda border-b border-borda">
        {contas.map((conta) => (
          <li key={conta.id}>
            <Card conta={conta} aoSeguir={(novo) => setSeguidas((n) => n + (novo ? 1 : -1))} />
          </li>
        ))}
      </ul>

      {erro && (
        <div className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button type="button" onClick={() => carregar(contas.length)} className="mt-1 cursor-pointer underline">
            tentar de novo
          </button>
        </div>
      )}
      {carregando && <p className="py-8 text-center text-sm text-tinta-suave">carregando...</p>}
      {!carregando && !erro && contas.length === 0 && (
        <p className="px-4 py-10 text-center text-tinta-suave">
          Nenhuma sugestão agora: você já segue todos os poetas com poemas publicados.
        </p>
      )}
      {!carregando && contas.length < total && (
        <button
          type="button"
          onClick={() => carregar(contas.length)}
          className="block min-h-11 w-full cursor-pointer py-3 text-sm font-semibold text-destaque hover:underline"
        >
          ver mais poetas
        </button>
      )}
    </div>
  );
}

function Card({ conta, aoSeguir }: { conta: Sugestao; aoSeguir: (seguindo: boolean) => void }) {
  const [sigo, setSigo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);

  async function alternar() {
    const novo = !sigo;
    setOcupado(true);
    setErro(false);
    try {
      await seguir(conta.username, novo);
      setSigo(novo);
      aoSeguir(novo);
    } catch {
      setErro(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="flex gap-3 px-4 py-3">
      <Link href={`/u/${conta.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Avatar usuario={conta} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="flex">
              <NomeAutor usuario={conta} />
            </span>
            <p className="truncate text-sm text-tinta-suave">
              @{conta.username} · {conta.poemas} {conta.poemas === 1 ? "poema" : "poemas"}
            </p>
          </div>
          <button
            type="button"
            onClick={alternar}
            disabled={ocupado}
            aria-pressed={sigo}
            aria-label={`${sigo ? "Deixar de seguir" : "Seguir"} ${conta.name}`}
            className={`min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 ${
              sigo
                ? "border border-borda text-tinta hover:border-destaque hover:text-destaque"
                : "bg-tinta text-papel hover:bg-tinta/85"
            }`}
          >
            {sigo ? "Seguindo" : "Seguir"}
          </button>
        </div>
        {erro && <p className="text-xs text-destaque">não deu, tente de novo</p>}
        {conta.bio && <p className="mt-1 line-clamp-2 text-sm">{conta.bio}</p>}
        {conta.trecho && (
          <p className="poema-corpo mt-2 border-l-2 border-borda pl-3 text-[0.9375rem] leading-[1.7] text-tinta-suave">
            {conta.trecho}
          </p>
        )}
      </div>
    </article>
  );
}
