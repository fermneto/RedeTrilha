"use client";
// O Acervo: os perfis de todos os poetas, consagrados e poetas do Verso, em páginas
// numeradas. É a aba "Poetas" do Explorar (decisões 12 e 17), que o monta só com
// login. Tudo mora na URL (/explorar?aba=poetas&tipo=&q=&lingua=&epoca=&ordem=&pagina=,
// ver caminhoDoAcervo em lib/api.ts): o link abre a mesma vista. Os filtros trocam com
// router.replace e voltam à página 1; a página troca por link, para o voltar do
// navegador voltar de página.
//
// A busca pelo nome não fica aqui: é o campo do topo do Explorar, que na aba Poetas
// vira BuscaDosPoetas (abaixo) e escreve o ?q= do Acervo. Um campo só na tela.
//
// No celular, os filtros ocupariam a tela inteira antes do primeiro poeta: ficam
// recolhidos atrás do botão "filtros" (com quantos estão ligados), na mesma linha
// do total e do "limpar filtros", que continuam à vista. A partir de 640 px, abertos como sempre.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { CartaoDoAcervo } from "@/components/CartaoDoAcervo";
import { EsqueletoDeCartoes } from "@/components/Esqueleto";
import { IconeAbrirLista } from "@/components/icones/IconeAbrirLista";
import { IconeAjustes } from "@/components/icones/IconeAjustes";
import { Paginacao } from "@/components/Paginacao";
import { CampoDaBusca } from "@/components/BuscaDoExplorar";
import {
  buscarAcervo,
  buscarEu,
  buscarOpcoesDoAcervo,
  caminhoDoAcervo,
  FILTROS_PADRAO_DO_ACERVO,
  lerFiltrosDoAcervo,
  mensagemDeFalha,
  nomeDoIdioma,
  ORDENS_DO_ACERVO,
  POR_PAGINA_DO_ACERVO,
  TIPOS_DO_ACERVO,
  type FiltrosDoAcervo,
  type OpcoesDoAcervo,
  type OrdemDoAcervo,
  type Page,
  type PoetaDoAcervo,
  type TipoDoAcervo,
} from "@/lib/api";

const ROTULOS_DOS_TIPOS: Record<TipoDoAcervo, string> = {
  todos: "todos",
  consagrados: "consagrados",
  do_verso: "poetas do Verso",
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

export function Acervo() {
  const router = useRouter();
  const params = useSearchParams();
  const { filtros, pagina } = lerFiltrosDoAcervo(params);
  const { tipo, q, lingua, epoca, ordem } = filtros;

  const idTipo = useId();
  const idLingua = useId();
  const idEpoca = useId();
  const idOrdem = useId();
  const idDoPainel = useId();
  // Só vale no celular: a partir de sm, o painel fica sempre aberto.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [resultado, setResultado] = useState<Page<PoetaDoAcervo> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesDoAcervo | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);

  // O Explorar já mandou quem está sem login para o login.
  useEffect(() => {
    buscarEu()
      .then((eu) => setMeuId(eu.id))
      .catch(() => setMeuId(null));
  }, []);

  // As contagens das opções seguem os outros filtros. Na falha, ficam as de antes.
  useEffect(() => {
    let vivo = true;
    buscarOpcoesDoAcervo({ tipo, lingua, epoca })
      .then((o) => {
        if (vivo) setOpcoes(o);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [tipo, lingua, epoca]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    buscarAcervo({ tipo, q, lingua, epoca, ordem }, pagina)
      .then((r) => {
        if (!vivo) return;
        setResultado(r);
        setErro(null);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemDeFalha(e, "não deu para carregar o acervo"));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [tipo, q, lingua, epoca, ordem, pagina]);

  const filtrar = useCallback(
    (mudanca: Partial<FiltrosDoAcervo>) => {
      const novos = { tipo, q, lingua, epoca, ordem, ...mudanca };
      if (novos.tipo === "do_verso") {
        novos.lingua = null;
        novos.epoca = null;
      }
      // Filtro novo volta para a página 1.
      router.replace(caminhoDoAcervo(novos, 1), { scroll: false });
    },
    [router, tipo, q, lingua, epoca, ordem],
  );

  const comFiltro = Boolean(q.trim() || lingua || epoca || tipo !== FILTROS_PADRAO_DO_ACERVO.tipo);
  // Os filtros do painel fora do padrão, os mesmos que o "limpar filtros" desfaz.
  // A busca pelo nome fica no topo, à vista; a ordem não filtra, só arruma.
  const ligados = [tipo !== FILTROS_PADRAO_DO_ACERVO.tipo, lingua, epoca].filter(Boolean).length;
  const limpar = (
    <button
      type="button"
      onClick={() => filtrar({ tipo: FILTROS_PADRAO_DO_ACERVO.tipo, q: "", lingua: null, epoca: null })}
      className="min-h-11 cursor-pointer text-sm font-semibold text-destaque hover:underline"
    >
      {/* No celular, "limpar" cabe na linha do botão de filtros e do total. */}
      limpar<span className="hidden sm:inline"> filtros</span>
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
      <div className="linha-da-folha flex flex-col gap-4 border-b border-borda py-4">
        <p className="text-sm text-tinta-suave">Todos os poetas do acervo, os consagrados e os do Verso.</p>
        {/* No celular, o painel abre abaixo da linha do botão; a partir de sm, fica acima do total. */}
        <div
          id={idDoPainel}
          className={`${filtrosAbertos ? "" : "hidden"} order-last space-y-4 sm:order-none sm:block`}
        >
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
            {tipo !== "do_verso" && (
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
                onChange={(e) => filtrar({ ordem: e.target.value as OrdemDoAcervo })}
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
        </div>

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-expanded={filtrosAbertos}
              aria-controls={idDoPainel}
              onClick={() => setFiltrosAbertos((aberto) => !aberto)}
              className={`${chip} ${chipDesligado} inline-flex items-center gap-2 sm:hidden`}
            >
              <IconeAjustes className="h-[1.125rem] w-[1.125rem]" />
              <span className="tabular-nums">{ligados > 0 ? `filtros · ${ligados}` : "filtros"}</span>
              <IconeAbrirLista
                className={`h-4 w-4 transition-transform duration-150 ${filtrosAbertos ? "rotate-180" : ""}`}
              />
            </button>
            <p role="status" className="text-sm text-tinta-suave tabular-nums">
              {resultado && !erro
                ? `${resultado.total} ${resultado.total === 1 ? "poeta" : "poetas"}`
                : ""}
            </p>
          </div>
          {comFiltro && limpar}
        </div>
      </div>

      <div className="space-y-6 px-4 py-5">
        {erro && <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>}

        {!erro && resultado === null && carregando && (
          <EsqueletoDeCartoes quantos={6} className="grid-cols-1 sm:grid-cols-2" />
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

// Espera da digitação antes de buscar pelo nome.
const ESPERA_DA_BUSCA_MS = 400;

// O campo do topo do Explorar na aba Poetas: filtra o Acervo pelo nome ou @username
// enquanto a pessoa digita (depois de uma pausa; o Enter aplica na hora), sem a lista
// de sugestões da busca geral, porque o resultado já é a lista logo abaixo.
export function BuscaDosPoetas() {
  const router = useRouter();
  const params = useSearchParams();
  const busca = params.toString();
  const q = lerFiltrosDoAcervo(params).filtros.q;
  const [termo, setTermo] = useState(q);

  // O q também muda por fora (voltar do navegador, "limpar filtros"). Se o campo
  // já equivale a ele (o que a pessoa digitou), fica como está.
  useEffect(() => {
    setTermo((atual) => (atual.trim() === q.trim() ? atual : q));
  }, [q]);

  // Filtro novo volta para a página 1; os outros filtros ficam.
  const aplicar = useCallback(
    (novo: string) => {
      const { filtros } = lerFiltrosDoAcervo(new URLSearchParams(busca));
      router.replace(caminhoDoAcervo({ ...filtros, q: novo }, 1), { scroll: false });
    },
    [router, busca],
  );

  useEffect(() => {
    if (termo.trim() === q.trim()) return;
    const espera = setTimeout(() => aplicar(termo), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [termo, q, aplicar]);

  return (
    <CampoDaBusca
      rotulo="Buscar poeta por nome ou @username"
      placeholder="Buscar poeta por nome ou @"
      valor={termo}
      aoMudar={setTermo}
      aoEnviar={() => {
        if (termo.trim() !== q.trim()) aplicar(termo);
      }}
      aoApagar={() => {
        setTermo("");
        if (q) aplicar("");
      }}
    />
  );
}
