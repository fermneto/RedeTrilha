"use client";
// Quem seguir: o último passo do onboarding (depois de /boas-vindas) e a tela do
// "ver mais" no Descobrir, no Seguindo vazio e no bloco do "Para você". Grade de
// cartões do Acervo (avatar, nome com selo, bio curta, poemas e seguidores, escolas),
// na ordem da nota do backend; "pular" (ou "continuar", depois de seguir alguém)
// leva ao Início, que abre no "Para você".
//
// O campo de busca acha um poeta pelo nome ou @username com a mesma busca do Acervo
// (GET /acervo?q=, sem acento e sem maiúscula), para seguir um colega conhecido
// sem sair do onboarding. Com o campo vazio, voltam as sugestões.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import {
  buscarAcervo,
  buscarEu,
  buscarOpcoesDePreferencias,
  buscarSugestoes,
  CAMINHO_DOS_GOSTOS,
  caminhoDoLogin,
  POR_PAGINA_DO_ACERVO,
  temToken,
  type PoetaDoAcervo,
} from "@/lib/api";

// Cartões por carga: a grade de 2 colunas fecha sem sobra.
const POR_PAGINA = 12;
// Espera da digitação antes de buscar, como no Acervo.
const ESPERA_DA_BUSCA_MS = 400;

// Um cartão da grade: a sugestão (com escolas) ou um resultado da busca do Acervo.
type Conta = PoetaDoAcervo & { escolas?: string[] };

export default function SugestoesPage() {
  const router = useRouter();
  const idBusca = useId();
  const [contas, setContas] = useState<Conta[]>([]);
  const [total, setTotal] = useState(0);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [meuId, setMeuId] = useState<number | null>(null);
  const [rotulos, setRotulos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [seguidas, setSeguidas] = useState(0);
  // Resposta atrasada de um termo antigo não sobrescreve a do termo atual.
  const pedido = useRef(0);

  const carregar = useCallback(async (offset: number, q: string) => {
    const meu = ++pedido.current;
    setCarregando(true);
    setErro(null);
    try {
      const pagina = q
        ? await buscarAcervo(
            { tipo: "todos", q, lingua: null, epoca: null, ordem: "alfabetica" },
            offset / POR_PAGINA_DO_ACERVO + 1,
          )
        : await buscarSugestoes(offset, POR_PAGINA);
      if (meu !== pedido.current) return;
      setContas((atuais) => (offset === 0 ? pagina.items : [...atuais, ...pagina.items]));
      setTotal(pagina.total);
    } catch (e) {
      if (meu !== pedido.current) return;
      setErro(e instanceof Error ? e.message : q ? "não deu para buscar" : "não deu para carregar as sugestões");
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    carregar(0, "");
    buscarEu()
      .then((eu) => setMeuId(eu.id))
      .catch(() => setMeuId(null));
    buscarOpcoesDePreferencias()
      .then((o) => setRotulos(Object.fromEntries(o.escolas.map((e) => [e.codigo, e.rotulo]))))
      .catch(() => setRotulos({}));
  }, [router, carregar]);

  // Digitou: espera uma pausa e só então busca; apagar tudo volta às sugestões.
  useEffect(() => {
    const q = termo.trim();
    if (q === busca) return;
    const espera = setTimeout(() => {
      setBusca(q);
      setContas([]);
      carregar(0, q);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [termo, busca, carregar]);

  return (
    <div>
      <title>Quem seguir · Verso</title>
      <CabecalhoPagina titulo="Quem seguir" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-3">
        <p className="text-sm text-tinta-suave">
          Siga poetas para ver os poemas deles na aba Seguindo.{" "}
          <Link href={CAMINHO_DOS_GOSTOS} className="underline">
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

      <form role="search" aria-label="Buscar poetas" onSubmit={(e) => e.preventDefault()} className="px-4 pt-4">
        <label htmlFor={idBusca} className="sr-only">
          Buscar poeta por nome ou @username
        </label>
        <input
          id={idBusca}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="buscar poeta por nome ou @username"
          autoComplete="off"
          className="min-h-11 w-full rounded-full border border-borda bg-transparent px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque"
        />
      </form>

      <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {contas.map((conta) => (
          <li key={conta.id}>
            <CartaoDoAcervo
              poeta={conta}
              proprio={conta.id === meuId}
              escolas={(conta.escolas ?? []).map((e) => rotulos[e] ?? e)}
              aoSeguir={(novo) => setSeguidas((n) => n + (novo ? 1 : -1))}
            />
          </li>
        ))}
      </ul>

      {erro && (
        <div className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => carregar(contas.length, busca)}
            className="mt-1 cursor-pointer underline"
          >
            tentar de novo
          </button>
        </div>
      )}
      {carregando && <p className="py-8 text-center text-sm text-tinta-suave">carregando...</p>}
      {!carregando && !erro && contas.length === 0 && (
        <p className="px-4 py-10 text-center text-tinta-suave">
          {busca
            ? "Nenhum poeta encontrado."
            : "Nenhuma sugestão agora: você já segue todos os poetas com poemas publicados."}
        </p>
      )}
      {!carregando && contas.length < total && (
        <button
          type="button"
          onClick={() => carregar(contas.length, busca)}
          className="block min-h-11 w-full cursor-pointer py-3 text-sm font-semibold text-destaque hover:underline"
        >
          ver mais poetas
        </button>
      )}
    </div>
  );
}
