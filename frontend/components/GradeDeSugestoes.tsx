"use client";
// A grade de quem seguir: cartões do Acervo (avatar, nome com selo, bio curta,
// poemas e seguidores, escolas), na ordem da nota do backend, com "ver mais".
// Usada no último passo do onboarding (/boas-vindas/quem-seguir) e na /sugestoes.
//
// O campo de busca acha um poeta pelo nome ou @username com a mesma busca do Acervo
// (GET /acervo?q=, sem acento e sem maiúscula), para seguir um colega conhecido
// sem sair do onboarding. Com o campo vazio, voltam as sugestões.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import { EsqueletoDeCartoes } from "@/components/Esqueleto";
import {
  buscarAcervo,
  buscarEu,
  buscarOpcoesDePreferencias,
  buscarSugestoes,
  caminhoDoLogin,
  mensagemDeFalha,
  POR_PAGINA_DO_ACERVO,
  temToken,
  type PoetaDoAcervo,
} from "@/lib/api";

// Cartões por carga: fecha sem sobra nas grades de 2 e de 3 colunas.
const POR_PAGINA = 12;
// Espera da digitação antes de buscar, como no Acervo.
const ESPERA_DA_BUSCA_MS = 400;

// Um cartão da grade: a sugestão (com escolas) ou um resultado da busca do Acervo.
type Conta = PoetaDoAcervo & { escolas?: string[] };

type Props = {
  // As colunas da grade (a /sugestoes fica na coluna de 600 px; o onboarding é mais largo).
  colunas: string;
  // Avisa cada seguir (true) ou deixar de seguir (false).
  aoSeguir: (sigo: boolean) => void;
};

export function GradeDeSugestoes({ colunas, aoSeguir }: Props) {
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
      setErro(mensagemDeFalha(e, q ? "não deu para buscar" : "não deu para carregar as sugestões"));
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
      <form role="search" aria-label="Buscar poetas" onSubmit={(e) => e.preventDefault()} className="mb-4">
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

      <ul className={`grid gap-3 ${colunas}`}>
        {contas.map((conta) => (
          <li key={conta.id} className="surgir">
            <CartaoDoAcervo
              poeta={conta}
              proprio={conta.id === meuId}
              escolas={(conta.escolas ?? []).map((e) => rotulos[e] ?? e)}
              aoSeguir={aoSeguir}
            />
          </li>
        ))}
      </ul>

      {erro && (
        <div role="alert" className="mt-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => carregar(contas.length, busca)}
            className="mt-1 min-h-11 cursor-pointer underline"
          >
            tentar de novo
          </button>
        </div>
      )}
      {carregando && (
        <div className={contas.length > 0 ? "mt-3" : ""}>
          <EsqueletoDeCartoes quantos={6} className={colunas} />
        </div>
      )}
      {!carregando && !erro && contas.length === 0 && (
        <p className="py-10 text-center text-tinta-suave">
          {busca
            ? "Nenhum poeta encontrado."
            : "Nenhuma sugestão agora: você já segue todos os poetas com poemas publicados."}
        </p>
      )}
      {!carregando && contas.length < total && (
        <button
          type="button"
          onClick={() => carregar(contas.length, busca)}
          className="mt-3 block min-h-11 w-full cursor-pointer py-3 text-sm font-semibold text-destaque hover:underline"
        >
          ver mais poetas
        </button>
      )}
    </div>
  );
}
