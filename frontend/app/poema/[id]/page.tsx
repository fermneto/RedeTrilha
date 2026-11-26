"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApagarPoema } from "@/components/ApagarPoema";
import { ArvoreComentarios, ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { CadernoFolhas, useFolhas } from "@/components/CadernoFolhas";
import { MARGEM_DA_PAGINA, poemaDe, rotuloDoPoema, VersoDoPoema } from "@/components/CadernoPoema";
import { EsqueletoDaPaginaDoPoema } from "@/components/Esqueleto";
import { PoemaCard } from "@/components/PoemaCard";
import { VersosComentaveis } from "@/components/VersosComentaveis";
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
              <div className={MARGEM_DA_PAGINA}>
                {erro ? (
                  <p className="rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
                ) : (
                  <EsqueletoDaPaginaDoPoema />
                )}
              </div>
            ),
          },
        ]}
      />
    );

  // Na página dupla, o poema na esquerda e os comentários na direita; no
  // celular, duas páginas, e "comentar estes versos" vira até a dos comentários.
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
            <div className={`surgir ${MARGEM_DA_PAGINA}`}>
              <PaginaDoPoema
                poema={poema}
                marcas={marcas}
                selecao={selecao}
                aoSelecionar={setSelecao}
                pedida={pedida}
                aoFiltrar={setVerso}
              />
              {/* Repost puro mostra o original; ele se desfaz pelo botão "repostar". */}
              {euId === poema.autor_id && !repostPuro(poema) && (
                <div className="mt-8">
                  <ApagarPoema postId={poema.id} aoApagar={() => router.replace(`/u/${poema.autor.username}`)} />
                </div>
              )}
            </div>
          ),
          direita: (
            <div className="surgir min-h-full">
              <VersoDoPoema
                poema={poemaDe(poema)}
                comentarios={
                  <ArvoreComentarios
                    campoNoPe
                    total={poemaDe(poema).comentarios}
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
