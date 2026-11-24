"use client";
// Acervo: os perfis de todos os poetas, consagrados e contemporâneos, em páginas numeradas.
// Tudo mora na URL (?tipo=&q=&lingua=&epoca=&ordem=&pagina=): o link abre a mesma
// vista. Os filtros trocam com router.replace e voltam à página 1; a página troca
// por link, para o voltar do navegador voltar de página.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import { Paginacao } from "@/components/Paginacao";
import { IconeBuscar } from "@/components/icones/IconeBuscar";
import {
  buscarAcervo,
  buscarEu,
  buscarOpcoesDoAcervo,
  caminhoDoLogin,
  nomeDoIdioma,
  ORDENS_DO_ACERVO,
  POR_PAGINA_DO_ACERVO,
  temToken,
  TIPOS_DO_ACERVO,
  type FiltrosDoAcervo,
  type OpcoesDoAcervo,
  type OrdemDoAcervo,
  type Page,
  type PoetaDoAcervo,
  type TipoDoAcervo,
} from "@/lib/api";

// Espera da digitação antes de buscar pelo nome.
const ESPERA_DA_BUSCA_MS = 400;

const PADRAO: FiltrosDoAcervo = { tipo: "todos", q: "", lingua: null, epoca: null, ordem: "alfabetica" };

const ROTULOS_DOS_TIPOS: Record<TipoDoAcervo, string> = {
  todos: "todos",
  consagrados: "consagrados",
  contemporaneos: "contemporâneos",
};

const ROTULOS_DAS_ORDENS: Record<OrdemDoAcervo, string> = {
  alfabetica: "alfabética",
  seguidos: "mais seguidos",
  poemas: "mais poemas",
};

// Os mesmos chips do Explorar.
const chip =
  "min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-150";
const chipLigado = "bg-tinta text-papel hover:bg-tinta/85";
const chipDesligado = "border border-borda text-tinta hover:border-destaque hover:text-destaque";
const campo =
  "min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-borda bg-papel-alto px-3 text-sm text-tinta transition-colors duration-150 focus:border-destaque";

function lerTipo(valor: string | null): TipoDoAcervo {
  return (TIPOS_DO_ACERVO as readonly string[]).includes(valor ?? "") ? (valor as TipoDoAcervo) : "todos";
}

function lerOrdem(valor: string | null): OrdemDoAcervo {
  return (ORDENS_DO_ACERVO as readonly string[]).includes(valor ?? "")
    ? (valor as OrdemDoAcervo)
    : "alfabetica";
}

// Página inválida ("0", "abc", "-2") é a 1.
function lerPagina(valor: string | null): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// A URL só leva o que difere do padrão: /acervo é a vista inicial.
function caminhoDoAcervo(filtros: FiltrosDoAcervo, pagina: number): string {
  const busca = new URLSearchParams();
  if (filtros.tipo !== PADRAO.tipo) busca.set("tipo", filtros.tipo);
  if (filtros.q.trim()) busca.set("q", filtros.q.trim());
  if (filtros.lingua) busca.set("lingua", filtros.lingua);
  if (filtros.epoca) busca.set("epoca", filtros.epoca);
  if (filtros.ordem !== PADRAO.ordem) busca.set("ordem", filtros.ordem);
  if (pagina > 1) busca.set("pagina", String(pagina));
  const texto = busca.toString();
  return texto ? `/acervo?${texto}` : "/acervo";
}

// useSearchParams precisa de Suspense no build estático do Next.
export default function AcervoPage() {
  return (
    <Suspense>
      <Acervo />
    </Suspense>
  );
}

function Acervo() {
  const router = useRouter();
  const params = useSearchParams();
  const tipo = lerTipo(params.get("tipo"));
  const q = params.get("q") ?? "";
  // Língua e época são só de consagrados: com "contemporaneos", saem.
  const lingua = tipo === "contemporaneos" ? null : params.get("lingua") || null;
  const epoca = tipo === "contemporaneos" ? null : params.get("epoca") || null;
  const ordem = lerOrdem(params.get("ordem"));
  const pagina = lerPagina(params.get("pagina"));
  const filtros: FiltrosDoAcervo = { tipo, q, lingua, epoca, ordem };

  const idBusca = useId();
  const idTipo = useId();
  const idLingua = useId();
  const idEpoca = useId();
  const idOrdem = useId();
  const [termo, setTermo] = useState(q);
  const [resultado, setResultado] = useState<Page<PoetaDoAcervo> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesDoAcervo | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);

  // Rota protegida: sem login, vai para o login e volta para cá.
  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    buscarEu()
      .then((eu) => setMeuId(eu.id))
      .catch(() => setMeuId(null));
    buscarOpcoesDoAcervo()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
  }, [router]);

  useEffect(() => {
    if (!temToken()) return;
    let vivo = true;
    setCarregando(true);
    buscarAcervo({ tipo, q, lingua, epoca, ordem }, pagina)
      .then((r) => {
        if (!vivo) return;
        setResultado(r);
        setErro(null);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : "não deu para carregar o acervo");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [tipo, q, lingua, epoca, ordem, pagina]);

  // O q também muda por fora (voltar do navegador, "limpar filtros"). Se o campo
  // já equivale a ele (o que a pessoa digitou), fica como está.
  useEffect(() => {
    setTermo((atual) => (atual.trim() === q.trim() ? atual : q));
  }, [q]);

  const filtrar = useCallback(
    (mudanca: Partial<FiltrosDoAcervo>) => {
      const novos = { tipo, q, lingua, epoca, ordem, ...mudanca };
      if (novos.tipo === "contemporaneos") {
        novos.lingua = null;
        novos.epoca = null;
      }
      // Filtro novo volta para a página 1.
      router.replace(caminhoDoAcervo(novos, 1), { scroll: false });
    },
    [router, tipo, q, lingua, epoca, ordem],
  );

  // Busca enquanto a pessoa digita, depois de uma pausa; o Enter aplica na hora.
  useEffect(() => {
    if (termo.trim() === q.trim()) return;
    const espera = setTimeout(() => filtrar({ q: termo }), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [termo, q, filtrar]);

  function aplicarBusca(e: React.FormEvent) {
    e.preventDefault();
    if (termo.trim() !== q.trim()) filtrar({ q: termo });
  }

  const comFiltro = Boolean(q.trim() || lingua || epoca || tipo !== PADRAO.tipo);
  const limpar = (
    <button
      type="button"
      onClick={() => {
        setTermo("");
        filtrar({ tipo: PADRAO.tipo, q: "", lingua: null, epoca: null });
      }}
      className="min-h-11 cursor-pointer text-sm font-semibold text-destaque hover:underline"
    >
      limpar filtros
    </button>
  );

  // A vista entra na chave dos cartões: em outra página ou filtro, o cartão
  // recomeça com os dados novos, e não com o estado do Seguir anterior.
  const vista = caminhoDoAcervo(filtros, pagina);
  const totalDePaginas = resultado ? Math.ceil(resultado.total / POR_PAGINA_DO_ACERVO) : 0;
  const linguas = opcoes?.linguas ?? [];
  const epocas = opcoes?.epocas ?? [];

  // overflow-x-clip: o tooltip (invisível) do SeloConsagrado de um cartão na borda
  // direita passaria da tela e daria rolagem horizontal no celular.
  return (
    <div className="overflow-x-clip">
      <CabecalhoPagina titulo="Acervo" />

      <div className="space-y-4 border-b border-borda px-4 py-4">
        <form role="search" aria-label="Buscar poetas" onSubmit={aplicarBusca}>
          <label htmlFor={idBusca} className="block text-sm">
            nome ou @username
          </label>
          <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-papel-alto px-3 text-tinta-suave transition-colors duration-150 focus-within:border-destaque focus-within:ring-2 focus-within:ring-destaque/25">
            <IconeBuscar className="h-5 w-5 shrink-0" />
            <input
              id={idBusca}
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Cruz e Sousa, @bocage..."
              autoCapitalize="none"
              className="min-h-11 w-full min-w-0 bg-transparent text-tinta outline-none"
            />
          </div>
        </form>

        <div>
          <p id={idTipo} className="text-sm">
            tipo
          </p>
          <div role="group" aria-labelledby={idTipo} className="mt-1 flex flex-wrap gap-2">
            {TIPOS_DO_ACERVO.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tipo === t}
                onClick={() => filtrar({ tipo: t })}
                className={`${chip} ${tipo === t ? chipLigado : chipDesligado}`}
              >
                {ROTULOS_DOS_TIPOS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tipo !== "contemporaneos" && (
            <>
              <div className="min-w-0">
                <label htmlFor={idLingua} className="block text-sm">
                  língua
                </label>
                <select
                  id={idLingua}
                  value={lingua ?? ""}
                  onChange={(e) => filtrar({ lingua: e.target.value || null })}
                  className={`${campo} mt-1`}
                >
                  <option value="">todas</option>
                  {lingua && !linguas.some((l) => l.codigo === lingua) && (
                    <option value={lingua}>{nomeDoIdioma(lingua)}</option>
                  )}
                  {linguas.map((l) => (
                    <option key={l.codigo} value={l.codigo}>
                      {nomeDoIdioma(l.codigo)} ({l.poetas})
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor={idEpoca} className="block text-sm">
                  época
                </label>
                <select
                  id={idEpoca}
                  value={epoca ?? ""}
                  onChange={(e) => filtrar({ epoca: e.target.value || null })}
                  className={`${campo} mt-1`}
                >
                  <option value="">todas</option>
                  {epocas.map((ep) => (
                    <option key={ep.chave} value={ep.chave}>
                      {ep.rotulo} ({ep.poetas})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="min-w-0">
            <label htmlFor={idOrdem} className="block text-sm">
              ordem
            </label>
            <select
              id={idOrdem}
              value={ordem}
              onChange={(e) => filtrar({ ordem: lerOrdem(e.target.value) })}
              className={`${campo} mt-1`}
            >
              {ORDENS_DO_ACERVO.map((o) => (
                <option key={o} value={o}>
                  {ROTULOS_DAS_ORDENS[o]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
          <p role="status" className="text-sm text-tinta-suave tabular-nums">
            {resultado && !erro
              ? `${resultado.total} ${resultado.total === 1 ? "poeta" : "poetas"}`
              : ""}
          </p>
          {comFiltro && limpar}
        </div>
      </div>

      <div className="space-y-6 px-4 py-5">
        {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

        {!erro && resultado === null && carregando && (
          <p className="py-8 text-center text-sm text-tinta-suave">carregando...</p>
        )}

        {!erro && resultado && resultado.items.length === 0 && !carregando && (
          <div className="py-10 text-center text-tinta-suave">
            {resultado.total > 0 ? (
              <p>Esta página não existe: o acervo tem {totalDePaginas} com esses filtros.</p>
            ) : (
              <p>Nenhum poeta encontrado com esses filtros.</p>
            )}
            {resultado.total > 0 ? (
              <button
                type="button"
                onClick={() => router.replace(caminhoDoAcervo(filtros, 1))}
                className="min-h-11 cursor-pointer text-sm font-semibold text-destaque hover:underline"
              >
                ir para a página 1
              </button>
            ) : (
              comFiltro && limpar
            )}
          </div>
        )}

        {!erro && resultado && resultado.items.length > 0 && (
          <>
            <ul
              aria-busy={carregando}
              className={`grid grid-cols-1 gap-3 transition-opacity duration-150 sm:grid-cols-2 ${
                carregando ? "opacity-60" : ""
              }`}
            >
              {resultado.items.map((poeta) => (
                <li key={`${vista}|${poeta.id}`}>
                  <CartaoDoAcervo poeta={poeta} proprio={poeta.id === meuId} />
                </li>
              ))}
            </ul>
            <Paginacao
              atual={pagina}
              total={totalDePaginas}
              href={(p) => caminhoDoAcervo(filtros, p)}
            />
          </>
        )}
      </div>
    </div>
  );
}
