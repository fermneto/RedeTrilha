"use client";
// Perfil do poeta: cabeçalho (ou o formulário de edição, no próprio perfil) e os
// poemas, citações e reposts da pessoa, com rolagem infinita como o feed, e
// numa segunda aba as antologias públicas dela.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";

import { AntologiaLista } from "@/components/AntologiaLista";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { PerfilCabecalho } from "@/components/PerfilCabecalho";
import { PerfilEdicao } from "@/components/PerfilEdicao";
import {
  buscarEu,
  buscarPerfil,
  buscarPoemasDoPerfil,
  caminhoDoLogin,
  listarAntologiasDe,
  mensagemDeFalha,
  temToken,
  type Perfil,
} from "@/lib/api";

const ABAS = [
  { valor: "poemas", rotulo: "Poemas" },
  { valor: "antologias", rotulo: "Antologias" },
] as const;

type Aba = (typeof ABAS)[number]["valor"];

// useSearchParams precisa de Suspense no build do Next.
export default function PerfilPage() {
  return (
    <Suspense>
      <PerfilDoPoeta />
    </Suspense>
  );
}

function PerfilDoPoeta() {
  const router = useRouter();
  const username = decodeURIComponent(useParams<{ username: string }>().username);
  // A aba fica na URL (?aba=antologias): o link direto abre nela. Sem o
  // parâmetro (ou com um valor desconhecido), "Poemas".
  const aba: Aba = useSearchParams().get("aba") === "antologias" ? "antologias" : "poemas";
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // replace, e não push: trocar de aba não enche o histórico do "voltar".
  function trocarAba(nova: Aba) {
    const caminho = `/u/${encodeURIComponent(username)}`;
    router.replace(nova === "poemas" ? caminho : `${caminho}?aba=${nova}`, { scroll: false });
  }

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    setPerfil(null);
    setEditando(false);
    Promise.all([buscarPerfil(username), buscarEu()])
      .then(([p, eu]) => {
        setPerfil(p);
        setMeuId(eu.id);
        setErro(null);
      })
      .catch((e) => setErro(mensagemDeFalha(e, "não deu para carregar o perfil")));
  }, [username, router]);

  const buscarPoemas = useCallback(
    (cursor: string | null) => buscarPoemasDoPerfil(username, cursor),
    [username],
  );

  const buscarAntologias = useCallback(
    (offset: number) => listarAntologiasDe(username, offset),
    [username],
  );

  const cabecalho = <CabecalhoPagina titulo={perfil?.name ?? "Perfil"} comoTitulo={false} />;
  if (erro)
    return (
      <>
        {cabecalho}
        <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
      </>
    );
  if (!perfil)
    return (
      <>
        {cabecalho}
        <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>
      </>
    );

  return (
    <div>
      {cabecalho}
      <div className="px-4 pt-5 pb-6">
        {editando ? (
          <PerfilEdicao
            perfil={perfil}
            aoSalvar={(novo) => {
              setPerfil(novo);
              setEditando(false);
            }}
            aoCancelar={() => setEditando(false)}
          />
        ) : (
          <PerfilCabecalho
            perfil={perfil}
            proprio={perfil.id === meuId}
            aoMudar={setPerfil}
            aoEditar={() => setEditando(true)}
          />
        )}
      </div>

      <Abas key={username} atual={aba} aoMudar={trocarAba}>
        {(valor) =>
          valor === "poemas" ? (
            <ListaDePoemas
              key={username}
              buscar={buscarPoemas}
              textoDoFim="fim dos poemas"
              vazio={<p className="px-4 py-10 text-center text-tinta-suave">Nenhum poema ainda.</p>}
            />
          ) : (
            <AntologiaLista
              key={username}
              buscar={buscarAntologias}
              vazio={
                <p className="px-4 py-10 text-center text-tinta-suave">Nenhuma antologia pública.</p>
              }
            />
          )
        }
      </Abas>
    </div>
  );
}

// Abas no padrão do WAI-ARIA: setas trocam de aba, e cada painel só monta na
// primeira vez que abre (depois fica escondido, sem perder a rolagem já carregada).
function Abas({
  atual,
  aoMudar,
  children,
}: {
  atual: Aba;
  aoMudar: (aba: Aba) => void;
  children: (aba: Aba) => React.ReactNode;
}) {
  const id = useId();
  const [abertas, setAbertas] = useState<Set<Aba>>(new Set([atual]));
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setAbertas((a) => (a.has(atual) ? a : new Set(a).add(atual)));
  }, [atual]);

  function aoTeclar(e: React.KeyboardEvent) {
    const i = ABAS.findIndex((a) => a.valor === atual);
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const proxima = ABAS[(i + passo + ABAS.length) % ABAS.length].valor;
    aoMudar(proxima);
    botoes.current[proxima]?.focus();
  }

  return (
    <section>
      <div role="tablist" aria-label="Conteúdo do perfil" onKeyDown={aoTeclar} className="flex border-y border-borda">
        {ABAS.map(({ valor, rotulo }) => {
          const ativa = valor === atual;
          return (
            <button
              key={valor}
              ref={(el) => {
                botoes.current[valor] = el;
              }}
              id={`${id}-aba-${valor}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`${id}-painel-${valor}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => aoMudar(valor)}
              className={`realce flex min-h-13 flex-1 cursor-pointer items-center justify-center text-[0.9375rem] ${
                ativa ? "font-bold text-tinta" : "text-tinta-suave"
              }`}
            >
              <span
                className={`flex h-full items-center border-b-4 py-3 ${ativa ? "border-destaque" : "border-transparent"}`}
              >
                {rotulo}
              </span>
            </button>
          );
        })}
      </div>
      {ABAS.map(({ valor }) => (
        <div
          key={valor}
          id={`${id}-painel-${valor}`}
          role="tabpanel"
          aria-labelledby={`${id}-aba-${valor}`}
          hidden={valor !== atual}
        >
          {abertas.has(valor) && children(valor)}
        </div>
      ))}
    </section>
  );
}
