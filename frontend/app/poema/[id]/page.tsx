"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApagarPoema } from "@/components/ApagarPoema";
import { ArvoreComentarios, ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EsqueletoDaPaginaDoPoema } from "@/components/Esqueleto";
import { PoemaCard } from "@/components/PoemaCard";
import { VersosComentaveis } from "@/components/VersosComentaveis";
import { useEsperaMinima } from "@/hooks/useEsperaMinima";
import {
  buscarEu,
  buscarPoema,
  buscarVersosComentados,
  caminhoDoLogin,
  lerVersosDaUrl,
  mensagemDeFalha,
  temToken,
  type Post,
  type SelecaoDeVersos,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

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
  // Versos pedidos por ?versos=2-4 (vindo de "comentar estes versos" num card):
  // lidos uma vez, quando o poema chega, e passados uma vez aos versos.
  const [pedida, setPedida] = useState<SelecaoDeVersos | null>(null);
  const leuAUrl = useRef(false);
  // O esqueleto fica pelo menos 500 ms; o poema entra depois.
  const esperando = useEsperaMinima(!poema && !erro);

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
    buscarVersosComentados({ tipo: "poema", id })
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

  // Só com o poema na tela: os versos recebem o pedido no mesmo commit.
  useEffect(() => {
    if (!poema || esperando || leuAUrl.current) return;
    leuAUrl.current = true;
    const versos = new URLSearchParams(window.location.search).get("versos");
    setPedida(lerVersosDaUrl(versos, textoSemMarcas(textoComentado(poema))));
  }, [poema, esperando]);

  // Os versos aplicam o pedido no mesmo commit (o efeito do filho roda antes);
  // depois ele se apaga, para não voltar quando o original reaparece após a tradução.
  useEffect(() => {
    if (pedida) setPedida(null);
  }, [pedida]);

  const cabecalho = <CabecalhoPagina titulo="Poema" comoTitulo={false} />;
  if (erro)
    return (
      <>
        {cabecalho}
        <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
      </>
    );
  if (!poema || esperando)
    return (
      <>
        {cabecalho}
        <EsqueletoDaPaginaDoPoema />
      </>
    );

  return (
    <div>
      {cabecalho}
      <div className="surgir border-b border-borda">
        <PoemaCard
          post={poema}
          linkarTitulo={false}
          inteiro
          // A seleção é de versos do original: some quando a tradução entra na tela.
          aoTraduzir={() => setSelecao(null)}
          corpo={(exibido) => (
            <VersosComentaveis
              texto={exibido.texto}
              comTitulo={Boolean(exibido.titulo)}
              citarPostId={exibido.id}
              marcas={marcas}
              selecao={selecao}
              aoSelecionar={setSelecao}
              selecaoPedida={pedida}
              aoComentar={(suave) => {
                const campo = document.getElementById(ID_DO_CAMPO_DE_COMENTARIO);
                campo?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
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
      <div className="surgir px-4 py-6">
        <ArvoreComentarios
          alvo={{ tipo: "poema", id: poema.id }}
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
