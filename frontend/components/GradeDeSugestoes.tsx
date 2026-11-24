"use client";
// A grade de quem seguir: cartões do Acervo (avatar, nome com selo, bio curta,
// poemas e seguidores, escolas), na ordem da nota do backend, com "ver mais".
// Usada no último passo do onboarding (/boas-vindas/quem-seguir) e na /sugestoes.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import { buscarOpcoesDePreferencias, buscarSugestoes, caminhoDoLogin, temToken, type Sugestao } from "@/lib/api";

// Cartões por carga: fecha sem sobra nas grades de 2 e de 3 colunas.
const POR_PAGINA = 12;

type Props = {
  // As colunas da grade (a /sugestoes fica na coluna de 600 px; o onboarding é mais largo).
  colunas: string;
  // Avisa cada seguir (true) ou deixar de seguir (false).
  aoSeguir: (sigo: boolean) => void;
};

export function GradeDeSugestoes({ colunas, aoSeguir }: Props) {
  const router = useRouter();
  const [contas, setContas] = useState<Sugestao[]>([]);
  const [total, setTotal] = useState(0);
  const [rotulos, setRotulos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
      <ul className={`grid gap-3 ${colunas}`}>
        {contas.map((conta) => (
          <li key={conta.id}>
            <CartaoDoAcervo
              poeta={conta}
              proprio={false}
              escolas={conta.escolas.map((e) => rotulos[e] ?? e)}
              aoSeguir={aoSeguir}
            />
          </li>
        ))}
      </ul>

      {erro && (
        <div role="alert" className="mt-4 rounded-xl border border-destaque p-3 text-sm text-destaque">
          <p>{erro}</p>
          <button type="button" onClick={() => carregar(contas.length)} className="mt-1 min-h-11 cursor-pointer underline">
            tentar de novo
          </button>
        </div>
      )}
      {carregando && <p className="py-8 text-center text-sm text-tinta-suave">carregando...</p>}
      {!carregando && !erro && contas.length === 0 && (
        <p className="py-10 text-center text-tinta-suave">
          Nenhuma sugestão agora: você já segue todos os poetas com poemas publicados.
        </p>
      )}
      {!carregando && contas.length < total && (
        <button
          type="button"
          onClick={() => carregar(contas.length)}
          className="mt-3 block min-h-11 w-full cursor-pointer py-3 text-sm font-semibold text-destaque hover:underline"
        >
          ver mais poetas
        </button>
      )}
    </div>
  );
}
