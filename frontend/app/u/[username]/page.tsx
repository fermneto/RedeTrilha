"use client";
// Perfil do poeta: cabeçalho (ou o formulário de edição, no próprio perfil) e os
// poemas, citações e reposts da pessoa, com rolagem infinita como o feed, e
// numa segunda aba as antologias públicas dela.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Abas } from "@/components/Abas";
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
  // Eu bloqueei a pessoa: o perfil mostra só o cabeçalho, com o "Desbloquear".
  const [bloqueei, setBloqueei] = useState(false);
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
    setBloqueei(false);
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
            aoMudarBloqueio={setBloqueei}
          />
        )}
      </div>

      {!bloqueei && (
        <Abas key={username} abas={ABAS} atual={aba} aoMudar={trocarAba} rotulo="Conteúdo do perfil" bordaEmCima>
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
      )}
    </div>
  );
}
