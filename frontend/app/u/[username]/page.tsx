"use client";
// Perfil do poeta: cabeçalho (ou o formulário de edição, no próprio perfil) e os
// poemas, citações e reposts da pessoa, com rolagem infinita como o feed.

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ListaDePoemas } from "@/components/ListaDePoemas";
import { PerfilCabecalho } from "@/components/PerfilCabecalho";
import { PerfilEdicao } from "@/components/PerfilEdicao";
import { buscarEu, buscarPerfil, buscarPoemasDoPerfil, temToken, type Perfil } from "@/lib/api";

export default function PerfilPage() {
  const router = useRouter();
  const username = decodeURIComponent(useParams<{ username: string }>().username);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace("/login");
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
      .catch((e) => setErro(e instanceof Error ? e.message : "não deu para carregar o perfil"));
  }, [username, router]);

  const buscarPoemas = useCallback(
    (cursor: string | null) => buscarPoemasDoPerfil(username, cursor),
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

      <section>
        <h2 className="border-y border-borda px-4 py-3 text-lg">Poemas</h2>
        <ListaDePoemas
          key={username}
          buscar={buscarPoemas}
          textoDoFim="fim dos poemas"
          vazio={<p className="px-4 py-10 text-center text-tinta-suave">Nenhum poema ainda.</p>}
        />
      </section>
    </div>
  );
}
