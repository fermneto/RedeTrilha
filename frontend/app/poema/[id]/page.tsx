"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApagarPoema } from "@/components/ApagarPoema";
import { ArvoreComentarios, ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { PoemaCard } from "@/components/PoemaCard";
import { VersosComentaveis } from "@/components/VersosComentaveis";
import {
  buscarEu,
  buscarPoema,
  buscarVersosComentados,
  caminhoDoLogin,
  mensagemDeFalha,
  temToken,
  type Post,
  type SelecaoDeVersos,
} from "@/lib/api";

export default function PoemaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [poema, setPoema] = useState<Post | null>(null);
  const [euId, setEuId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Crítica ancorada (#71): versos selecionados, marcas por verso e o filtro da marca.
  const [selecao, setSelecao] = useState<SelecaoDeVersos | null>(null);
  const [marcas, setMarcas] = useState<Map<number, number>>(new Map());
  const [verso, setVerso] = useState<number | null>(null);

  // Também chamado pela árvore depois de comentar ou apagar: o contador de
  // comentários do card e as marcas nos versos vêm do poema. A árvore se carrega sozinha.
  const carregarPoema = useCallback(async () => {
    try {
      setPoema(await buscarPoema(id));
      setErro(null);
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para carregar o poema"));
      return;
    }
    // Sem as marcas, o poema continua legível: só não mostra os números.
    buscarVersosComentados(id)
      .then(({ items }) => setMarcas(new Map(items.map((m) => [m.verso, m.comentarios]))))
      .catch(() => setMarcas(new Map()));
  }, [id]);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    carregarPoema();
    buscarEu()
      .then((eu) => setEuId(eu.id))
      .catch(() => setEuId(null));
  }, [carregarPoema, router]);

  const cabecalho = <CabecalhoPagina titulo="Poema" comoTitulo={false} />;
  if (erro)
    return (
      <>
        {cabecalho}
        <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
      </>
    );
  if (!poema)
    return (
      <>
        {cabecalho}
        <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>
      </>
    );

  return (
    <div>
      {cabecalho}
      <div className="border-b border-borda">
        <PoemaCard
          post={poema}
          linkarTitulo={false}
          inteiro
          // A seleção é de versos do original: some quando a tradução entra na tela.
          aoTraduzir={() => setSelecao(null)}
          corpo={(exibido) => (
            <VersosComentaveis
              poema={exibido}
              marcas={marcas}
              selecao={selecao}
              aoSelecionar={setSelecao}
              aoComentar={() => {
                const campo = document.getElementById(ID_DO_CAMPO_DE_COMENTARIO);
                campo?.scrollIntoView({ behavior: "smooth", block: "center" });
                campo?.focus({ preventScroll: true });
              }}
              aoFiltrar={(n) => {
                setVerso(n);
                document.getElementById("comentarios")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          )}
        />
        {/* Repost puro mostra o original; ele se desfaz pelo botão "repostar" do card. */}
        {euId === poema.autor_id && !repostPuro(poema) && (
          <ApagarPoema postId={poema.id} aoApagar={() => router.replace(`/u/${poema.autor.username}`)} />
        )}
      </div>
      <div className="px-4 py-6">
        <ArvoreComentarios
          postId={poema.id}
          euId={euId}
          aoMudar={carregarPoema}
          textoDoPoema={textoComentado(poema)}
          selecao={selecao}
          aoLimparSelecao={() => setSelecao(null)}
          verso={verso}
          aoLimparFiltro={() => setVerso(null)}
        />
      </div>
    </div>
  );
}

function repostPuro(poema: Post): boolean {
  return poema.repost_de !== null && poema.texto === "";
}

// O texto que recebe os comentários: num repost puro, o do original (como no backend).
function textoComentado(poema: Post): string {
  return repostPuro(poema) && poema.repost_de ? poema.repost_de.texto : poema.texto;
}
