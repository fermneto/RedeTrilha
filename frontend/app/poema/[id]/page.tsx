"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApagarPoema } from "@/components/ApagarPoema";
import { ArvoreComentarios, ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CadernoFolhas, useFolhas } from "@/components/CadernoFolhas";
import { poemaDe, rotuloDoPoema, VersoDoPoema } from "@/components/CadernoPoema";
import { EsqueletoDaPaginaDoPoema } from "@/components/Esqueleto";
import { MaisDoAutor } from "@/components/MaisDoAutor";
import { PoemaCard } from "@/components/PoemaCard";
import { Repercussao } from "@/components/Repercussao";
import { VersosComentaveis } from "@/components/VersosComentaveis";
import {
  buscarEu,
  buscarPoema,
  buscarVersosComentados,
  caminhoDoLogin,
  formatarDataEHora,
  lerVersosDaUrl,
  mensagemDeFalha,
  temToken,
  type Post,
  type SelecaoDeVersos,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

// Abaixo do título da página ("← Poema"), as margens do livro (MARGEM_DA_PAGINA)
// com menos espaço em cima.
const MARGEM_DO_POEMA = "px-6 pt-2 pb-4 sm:px-10 lg:px-14 lg:pt-4";
// O título alinhado ao poema: com o px-4 do cabeçalho, a margem lateral do livro.
const topo = (
  <div className="px-2 sm:px-6 lg:px-10">
    <CabecalhoPagina titulo="Poema" comoTitulo={false} voltar />
  </div>
);

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

  useEffect(() => {
    if (!poema || leuAUrl.current) return;
    leuAUrl.current = true;
    const versos = new URLSearchParams(window.location.search).get("versos");
    setPedida(lerVersosDaUrl(versos, textoSemMarcas(textoComentado(poema))));
  }, [poema]);

  // Os versos aplicam o pedido no mesmo commit (o efeito do filho roda antes);
  // depois ele se apaga, para não voltar quando o original reaparece após a tradução.
  useEffect(() => {
    if (pedida) setPedida(null);
  }, [pedida]);

  // Sem o poema ainda (ou com erro), uma folha só, com o aviso ou o esqueleto.
  if (erro || !poema)
    return (
      <CadernoFolhas
        key="carregando"
        folhas={[
          {
            chave: "carregando",
            rotulo: erro ?? "carregando o poema",
            esquerda: (
              <>
                {topo}
                <div className={MARGEM_DO_POEMA}>
                  {erro ? (
                    <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
                  ) : (
                    <EsqueletoDaPaginaDoPoema />
                  )}
                </div>
              </>
            ),
          },
        ]}
      />
    );

  const original = poemaDe(poema);
  // Na página dupla, o poema na esquerda (com a data inteira e, no pé, mais do
  // autor) e, na direita, as ações, quem curtiu, repostou e citou, e os
  // comentários; no celular, duas páginas, e "comentar estes versos" vira até a
  // dos comentários.
  return (
    <CadernoFolhas
      key={poema.id}
      anterior="voltar ao poema"
      proxima="ver ações e comentários"
      folhas={[
        {
          chave: `poema-${poema.id}`,
          rotulo: rotuloDoPoema(poema),
          rotuloDaDireita: "ações e comentários",
          esquerda: (
            <div className="surgir">
              {topo}
              <div className={MARGEM_DO_POEMA}>
                <PaginaDoPoema
                  poema={poema}
                  marcas={marcas}
                  selecao={selecao}
                  aoSelecionar={setSelecao}
                  pedida={pedida}
                  aoFiltrar={setVerso}
                />
                {/* A data do consagrado é a da importação, não a da obra: fica de fora, como no card. */}
                {!original.autor.consagrado && (
                  <p className="mt-3 text-[0.8125rem] text-tinta-suave">
                    publicado em <time dateTime={original.created_at}>{formatarDataEHora(original.created_at)}</time>
                  </p>
                )}
                {/* Repost puro mostra o original; ele se desfaz pelo botão "repostar". */}
                {euId === poema.autor_id && !repostPuro(poema) && (
                  <div className="mt-8">
                    <ApagarPoema postId={poema.id} aoApagar={() => router.replace(`/u/${poema.autor.username}`)} />
                  </div>
                )}
                <MaisDoAutor autor={original.autor} aberto={{ tipo: "poema", id: original.id }} />
              </div>
            </div>
          ),
          direita: (
            <div className="surgir min-h-full">
              <VersoDoPoema
                poema={original}
                repercussao={<Repercussao alvo={{ tipo: "poema", id: original.id }} />}
                comentarios={
                  <ArvoreComentarios
                    campoNoPe
                    total={original.comentarios}
                    alvo={{ tipo: "poema", id: poema.id }}
                    euId={euId}
                    aoMudar={carregarPoema}
                    textoDoPoema={textoComentado(poema)}
                    selecao={selecao}
                    aoLimparSelecao={() => setSelecao(null)}
                    verso={verso}
                    aoLimparFiltro={() => setVerso(null)}
                  />
                }
              />
            </div>
          ),
        },
      ]}
    />
  );
}

// O poema na página da esquerda, com os versos que se selecionam (#71). Comentar
// os versos ou filtrar pela marca de um verso mostra a página dos comentários.
function PaginaDoPoema({
  poema,
  marcas,
  selecao,
  aoSelecionar,
  pedida,
  aoFiltrar,
}: {
  poema: Post;
  marcas: Map<number, number>;
  selecao: SelecaoDeVersos | null;
  aoSelecionar: (s: SelecaoDeVersos | null) => void;
  pedida: SelecaoDeVersos | null;
  aoFiltrar: (verso: number) => void;
}) {
  const { mostrar } = useFolhas();
  // "comentar", no card do feed, abre /poema/{id}#comentarios: no celular, já na página deles.
  useEffect(() => {
    if (window.location.hash === "#comentarios") mostrar("d");
  }, []);
  return (
    <PoemaCard
      post={poema}
      folha
      linkarTitulo={false}
      // A seleção é de versos do original: some quando a tradução entra na tela.
      aoTraduzir={() => aoSelecionar(null)}
      corpo={(exibido) => (
        <VersosComentaveis
          texto={exibido.texto}
          comTitulo={Boolean(exibido.titulo)}
          citar={{ tipo: "poema", id: exibido.id }}
          marcas={marcas}
          selecao={selecao}
          aoSelecionar={aoSelecionar}
          selecaoPedida={pedida}
          aoComentar={(suave) =>
            mostrar("d", () => {
              const campo = document.getElementById(ID_DO_CAMPO_DE_COMENTARIO);
              campo?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
              campo?.focus({ preventScroll: true });
            })
          }
          aoFiltrar={(n) => {
            aoFiltrar(n);
            mostrar("d", () => document.getElementById("comentarios")?.scrollIntoView({ behavior: "smooth" }));
          }}
        />
      )}
    />
  );
}

function repostPuro(poema: Post): boolean {
  return poema.repost_de !== null && poema.texto === "";
}

// O texto que recebe os comentários: num repost puro, o do original (como no backend).
function textoComentado(poema: Post): string {
  return repostPuro(poema) && poema.repost_de ? poema.repost_de.texto : poema.texto;
}
