"use client";
// Perfil do poeta: cabeçalho (ou o formulário de edição, no próprio perfil) e os
// poemas, citações e reposts da pessoa, com rolagem infinita como o feed.

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

  if (erro) return <p className="rounded border border-destaque p-3 text-sm text-destaque">{erro}</p>;
  if (!perfil) return <p className="text-sm text-tinta-suave">carregando...</p>;

  return (
    <div className="space-y-10">
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

      <section className="space-y-6">
        <h2 className="border-b border-borda pb-2 text-xl">Poemas</h2>
        <ListaDePoemas
          key={username}
          buscar={buscarPoemas}
          textoDoFim="fim dos poemas"
          vazio={<p className="text-tinta-suave">Nenhum poema ainda.</p>}
        />
      </section>
    </div>
  );
}
