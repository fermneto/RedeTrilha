"use client";
// Quem seguir: o último passo do onboarding (depois de /boas-vindas) e a tela do
// "ver mais" no Descobrir, no Seguindo vazio e no bloco do "Para você". Grade de
// cartões do Acervo (avatar, nome com selo, bio curta, poemas e seguidores, escolas),
// na ordem da nota do backend; "pular" (ou "continuar", depois de seguir alguém)
// leva ao Início, que abre no "Para você".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import {
  buscarOpcoesDePreferencias,
  buscarSugestoes,
  caminhoDoLogin,
  temToken,
  type Sugestao,
} from "@/lib/api";

// PROVISÓRIO: quantos cartões por vez (a grade de 2 colunas fecha sem sobra).
const POR_PAGINA = 12;

export default function SugestoesPage() {
  const router = useRouter();
  const [contas, setContas] = useState<Sugestao[]>([]);
  const [total, setTotal] = useState(0);
  const [rotulos, setRotulos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [seguidas, setSeguidas] = useState(0);

  const carregar = useCallback(async (offset: number) => {
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
  }, []);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    carregar(0);
    buscarOpcoesDePreferencias()
      .then((o) => setRotulos(Object.fromEntries(o.escolas.map((e) => [e.codigo, e.rotulo]))))
      .catch(() => setRotulos({}));
  }, [router, carregar]);

  return (
    <div>
      <title>Quem seguir · Verso</title>
      <CabecalhoPagina titulo="Quem seguir" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-3">
        <p className="text-sm text-tinta-suave">
          Siga poetas para ver os poemas deles na aba Seguindo.{" "}
          <Link href="/boas-vindas" className="underline">
            Ajustar o que você gosta
          </Link>
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-borda px-4 text-sm font-bold hover:border-destaque hover:text-destaque"
        >
          {seguidas > 0 ? "continuar" : "pular"}
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {contas.map((conta) => (
          <li key={conta.id}>
            <CartaoDoAcervo
              poeta={conta}
              proprio={false}
              escolas={conta.escolas.map((e) => rotulos[e] ?? e)}
              aoSeguir={(novo) => setSeguidas((n) => n + (novo ? 1 : -1))}
            />
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
