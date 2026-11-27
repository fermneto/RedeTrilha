"use client";
// Busca do topo do Explorar e da coluna direita, como a do X: um campo só que acha
// tags (GET /tags/busca) e poetas por nome ou @username (GET /acervo?q=, a mesma
// busca da tela Quem seguir, com quem eu sigo primeiro), mais "ver todos os poetas".
// Os resultados vêm agrupados numa lista (combobox do WAI-ARIA): setas sobem e
// descem, Enter escolhe, Esc fecha. Enter sem opção ativa filtra pela tag digitada,
// como o campo de tag de antes; "@fulano" + Enter abre o primeiro poeta achado.
// Fora do Explorar (variante "coluna"), escolher uma tag leva ao Explorar filtrado.
// Na aba Poetas do Explorar, o mesmo campo (CampoDaBusca, com a mesma casca) filtra o
// Acervo pelo nome: ver BuscaDosPoetas em components/Acervo.tsx.

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { SeloConsagrado } from "@/components/SeloConsagrado";
import { IconeBuscar } from "@/components/icones/IconeBuscar";
import { IconeFechar } from "@/components/icones/IconeFechar";
import {
  buscarPoetas,
  buscarTags,
  caminhoDoAcervoComBusca,
  hashtag,
  opcaoVizinha,
  semSublinhado,
  termosDaBusca,
  type PoetaDoAcervo,
  type TagEncontrada,
} from "@/lib/api";

// A casca do campo, a mesma na busca geral e na dos poetas (CampoDaBusca).
const CASCA =
  "flex h-11 items-center gap-2 rounded-full border border-borda bg-painel pl-4 text-tinta-suave transition-colors duration-150 focus-within:border-destaque focus-within:bg-papel focus-within:text-destaque focus-within:ring-2 focus-within:ring-destaque/25";
const ENTRADA = "h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-tinta outline-none";
const BOTAO_APAGAR =
  "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-tinta-suave hover:text-destaque focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-destaque";

// Espera da digitação antes de buscar (as duas rotas de uma vez).
const ESPERA_DA_BUSCA_MS = 250;

type Opcao =
  | { tipo: "tag"; tag: TagEncontrada }
  | { tipo: "poeta"; poeta: PoetaDoAcervo }
  | { tipo: "acervo"; q: string };

type Resultados = { tags: TagEncontrada[]; poetas: PoetaDoAcervo[] };

const VAZIO: Resultados = { tags: [], poetas: [] };

export function BuscaDoExplorar({
  tagAtual = "",
  aoEscolherTag,
  variante = "topo",
}: {
  tagAtual?: string;
  // Sem ela, a tag escolhida abre /explorar?tag= (e apagar não muda de tela).
  aoEscolherTag?: (tag: string) => void;
  variante?: "topo" | "coluna";
}) {
  const router = useRouter();
  const naColuna = variante === "coluna";
  const irParaTag = (tag: string) => {
    if (aoEscolherTag) aoEscolherTag(tag);
    else if (tag) router.push(`/explorar?tag=${encodeURIComponent(tag)}`);
  };
  const idCampo = useId();
  const idLista = useId();
  const [termo, setTermo] = useState(tagAtual ? hashtag(tagAtual) : "");
  const [resultados, setResultados] = useState<Resultados>(VAZIO);
  // O termo que os resultados respondem: "" = nada buscado ainda.
  const [respondido, setRespondido] = useState("");
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const pedido = useRef(0);

  // A tag também muda por fora (um link de #tag, "limpar filtros"): o campo mostra
  // a tag atual, a não ser que o que já está escrito equivalha a ela (o "_" não
  // conta: #versolivre equivale a verso_livre).
  useEffect(() => {
    setTermo((atual) =>
      semSublinhado(termosDaBusca(atual).tag) === semSublinhado(tagAtual) ? atual : tagAtual ? hashtag(tagAtual) : "",
    );
  }, [tagAtual]);

  const limpo = termo.trim();
  useEffect(() => {
    if (!limpo) {
      pedido.current++;
      setResultados(VAZIO);
      setRespondido("");
      return;
    }
    const espera = setTimeout(async () => {
      const meu = ++pedido.current;
      const { tag, poeta } = termosDaBusca(limpo);
      const [tags, poetas] = await Promise.all([
        tag ? buscarTags(tag).then((r) => r.items).catch(() => []) : Promise.resolve([]),
        poeta ? buscarPoetas(poeta).then((r) => r.items).catch(() => []) : Promise.resolve([]),
      ]);
      if (meu !== pedido.current) return;
      setResultados({ tags, poetas });
      setRespondido(limpo);
      setAtiva(-1);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [limpo]);

  const termoDoPoeta = termosDaBusca(respondido).poeta;
  const opcoes: Opcao[] = [
    ...resultados.tags.map((tag) => ({ tipo: "tag" as const, tag })),
    ...resultados.poetas.map((poeta) => ({ tipo: "poeta" as const, poeta })),
    ...(resultados.poetas.length > 0 ? [{ tipo: "acervo" as const, q: termoDoPoeta }] : []),
  ];
  const indiceDoAcervo = resultados.tags.length + resultados.poetas.length;
  const mostrando = aberta && limpo !== "" && respondido === limpo;
  const idDaOpcao = (i: number) => `${idLista}-${i}`;

  function escolher(opcao: Opcao) {
    setAberta(false);
    setAtiva(-1);
    if (opcao.tipo === "tag") {
      setTermo(hashtag(opcao.tag.tag));
      irParaTag(opcao.tag.tag);
    } else if (opcao.tipo === "poeta") {
      router.push(`/u/${opcao.poeta.username}`);
    } else {
      router.push(caminhoDoAcervoComBusca(opcao.q));
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (mostrando && ativa >= 0 && opcoes[ativa]) return escolher(opcoes[ativa]);
    const { tag, poeta } = termosDaBusca(limpo);
    if (!tag && poeta) {
      if (resultados.poetas[0] && respondido === limpo) escolher({ tipo: "poeta", poeta: resultados.poetas[0] });
      return;
    }
    setAberta(false);
    irParaTag(tag);
  }

  function teclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAberta(true);
      if (mostrando) setAtiva((i) => opcaoVizinha(i, opcoes.length, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Escape" && mostrando) {
      e.preventDefault();
      setAberta(false);
      setAtiva(-1);
    }
  }

  function apagar() {
    setTermo("");
    setAtiva(-1);
    if (tagAtual) irParaTag("");
    document.getElementById(idCampo)?.focus();
  }

  const aviso = !mostrando
    ? ""
    : opcoes.length === 0
      ? "nada encontrado"
      : [contar(resultados.tags.length, "tag", "tags"), contar(resultados.poetas.length, "poeta", "poetas")]
          .filter(Boolean)
          .join(" e ");

  return (
    <form role="search" aria-label="Buscar no Verso" onSubmit={enviar} className={`relative px-4 ${naColuna ? "pt-2" : "py-2"}`}>
      <label htmlFor={idCampo} className="sr-only">
        Buscar tag ou poeta (nome ou @username)
      </label>
      <div className={CASCA}>
        <IconeBuscar className="h-5 w-5 shrink-0" />
        <input
          id={idCampo}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={mostrando}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={mostrando && ativa >= 0 ? idDaOpcao(ativa) : undefined}
          value={termo}
          maxLength={80}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onBlur={() => setAberta(false)}
          onKeyDown={teclar}
          placeholder="Buscar #tag ou poeta"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={ENTRADA}
        />
        {termo && (
          <button
            type="button"
            onClick={apagar}
            aria-label="Apagar a busca"
            className={BOTAO_APAGAR}
          >
            <IconeFechar className="h-5 w-5" />
          </button>
        )}
      </div>

      <p role="status" className="sr-only">
        {aviso}
      </p>

      <div
        id={idLista}
        role="listbox"
        aria-label="Resultados da busca"
        hidden={!mostrando}
        // Clicar numa opção não tira o foco do campo (senão o blur fecharia a lista antes).
        onMouseDown={(e) => e.preventDefault()}
        className={`absolute top-full z-20 inset-x-4 ${naColuna ? "mt-1" : ""} max-h-[min(70dvh,32rem)] overflow-y-auto rounded-xl border border-borda bg-papel-alto py-1 [scrollbar-width:thin]`}
      >
        {opcoes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-tinta-suave">Nenhuma tag ou poeta com “{limpo}”.</p>
        ) : (
          <>
            <Grupo titulo="Tags" mostrar={resultados.tags.length > 0}>
              {resultados.tags.map((t, i) => (
                <OpcaoDaLista key={t.tag} id={idDaOpcao(i)} ativa={ativa === i} aoEscolher={() => escolher(opcoes[i])}>
                  <span className="block font-bold break-words">{hashtag(t.tag)}</span>
                  <span className="block text-[0.8125rem] text-tinta-suave tabular-nums">
                    {t.poemas} {t.poemas === 1 ? "poema" : "poemas"}
                  </span>
                </OpcaoDaLista>
              ))}
            </Grupo>
            <Grupo titulo="Poetas" mostrar={resultados.poetas.length > 0}>
              {resultados.poetas.map((p, j) => {
                const i = resultados.tags.length + j;
                return (
                  <OpcaoDaLista key={p.id} id={idDaOpcao(i)} ativa={ativa === i} aoEscolher={() => escolher(opcoes[i])}>
                    <span className="flex items-center gap-3">
                      <Avatar usuario={p} />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate font-bold">{p.name}</span>
                          <SeloConsagrado usuario={p} />
                        </span>
                        <span className="block truncate text-sm text-tinta-suave">@{p.username}</span>
                      </span>
                    </span>
                  </OpcaoDaLista>
                );
              })}
              <OpcaoDaLista
                id={idDaOpcao(indiceDoAcervo)}
                ativa={ativa === indiceDoAcervo}
                aoEscolher={() => escolher({ tipo: "acervo", q: termoDoPoeta })}
              >
                <span className="text-sm font-semibold text-destaque">ver todos os poetas</span>
              </OpcaoDaLista>
            </Grupo>
          </>
        )}
      </div>
    </form>
  );
}

// O campo do topo sem a lista de sugestões: quem o usa mostra o resultado na própria
// tela (a aba Poetas do Explorar filtra o Acervo enquanto a pessoa digita).
export function CampoDaBusca({
  rotulo,
  placeholder,
  valor,
  aoMudar,
  aoEnviar,
  aoApagar,
}: {
  rotulo: string;
  placeholder: string;
  valor: string;
  aoMudar: (valor: string) => void;
  aoEnviar: () => void;
  aoApagar: () => void;
}) {
  const idCampo = useId();
  return (
    <form
      role="search"
      aria-label={rotulo}
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar();
      }}
      className="px-4 py-2"
    >
      <label htmlFor={idCampo} className="sr-only">
        {rotulo}
      </label>
      <div className={CASCA}>
        <IconeBuscar className="h-5 w-5 shrink-0" />
        <input
          id={idCampo}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={valor}
          maxLength={80}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={placeholder}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={ENTRADA}
        />
        {valor && (
          <button
            type="button"
            onClick={() => {
              aoApagar();
              document.getElementById(idCampo)?.focus();
            }}
            aria-label="Apagar a busca"
            className={BOTAO_APAGAR}
          >
            <IconeFechar className="h-5 w-5" />
          </button>
        )}
      </div>
    </form>
  );
}

function contar(n: number, um: string, varios: string): string {
  if (n === 0) return "";
  return `${n} ${n === 1 ? um : varios}`;
}

function Grupo({ titulo, mostrar, children }: { titulo: string; mostrar: boolean; children: React.ReactNode }) {
  const id = useId();
  if (!mostrar) return null;
  return (
    <div role="group" aria-labelledby={id} className="border-borda not-first:mt-1 not-first:border-t not-first:pt-1">
      <p id={id} className="px-4 pt-2 pb-1 text-[0.8125rem] font-bold tracking-wide text-tinta-suave uppercase">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function OpcaoDaLista({
  id,
  ativa,
  aoEscolher,
  children,
}: {
  id: string;
  ativa: boolean;
  aoEscolher: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={ativa}
      onClick={aoEscolher}
      className={`realce flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2 ${
        ativa ? "bg-tinta/[0.07] shadow-[inset_3px_0_0_var(--color-destaque)]" : ""
      }`}
    >
      {children}
    </div>
  );
}
