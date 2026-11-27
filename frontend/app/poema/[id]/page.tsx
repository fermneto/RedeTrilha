"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApagarPoema } from "@/components/ApagarPoema";
import { ArvoreComentarios } from "@/components/ArvoreComentarios";
import { AvisoDeErro } from "@/components/AvisoDeErro";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CadernoFolhas } from "@/components/CadernoFolhas";
import { poemaDe, rotuloDoPoema, VersoDoPoema } from "@/components/CadernoPoema";
import { DaMesmaForma } from "@/components/DaMesmaForma";
import { EsqueletoDaPaginaDoPoema } from "@/components/Esqueleto";
import { MaisDoAutor } from "@/components/MaisDoAutor";
import { PoemaCard } from "@/components/PoemaCard";
import { Repercussao } from "@/components/Repercussao";
import { VersosComentaveis } from "@/components/VersosComentaveis";
import { useCriticaAncorada, type CriticaAncorada } from "@/hooks/useCriticaAncorada";
import { useIrParaComentarios } from "@/hooks/useIrParaComentarios";
import { useSessaoObrigatoria } from "@/hooks/useSessaoObrigatoria";
import { buscarPoema, formatarDataEHora, mensagemDeFalha, temToken, type Post } from "@/lib/api";

// Abaixo do título da página ("← Poema"), as margens do livro (MARGEM_DA_PAGINA)
// com menos espaço em cima.
const MARGEM_DO_POEMA = "px-(--margem-da-folha) pt-2 pb-4 lg:pt-4";
// O título alinhado ao poema: com o px-4 do cabeçalho, a margem lateral do livro.
const topo = (
  <div className="px-(--recuo-da-folha)">
    <CabecalhoPagina titulo="Poema" comoTitulo={false} voltar />
  </div>
);

export default function PoemaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [poema, setPoema] = useState<Post | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const critica = useCriticaAncorada({ tipo: "poema", id }, poema ? textoComentado(poema) : null);
  const { carregarMarcas } = critica;

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
    carregarMarcas();
  }, [id, carregarMarcas]);

  // Sem token, a sessão abaixo manda ao login; o poema vem antes de quem lê.
  useEffect(() => {
    if (temToken()) carregarPoema();
  }, [carregarPoema]);
  const eu = useSessaoObrigatoria();
  const euId = eu?.id ?? null;

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
                    <AvisoDeErro>{erro}</AvisoDeErro>
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
                <PaginaDoPoema poema={poema} critica={critica} />
                <DataDoPoema poema={original} />
                {/* Repost puro mostra o original; ele se desfaz pelo botão "repostar". */}
                {euId === poema.autor_id && !repostPuro(poema) && (
                  <div className="mt-8">
                    <ApagarPoema postId={poema.id} aoApagar={() => router.replace(`/u/${poema.autor.username}`)} />
                  </div>
                )}
                <MaisDoAutor autor={original.autor} aberto={{ tipo: "poema", id: original.id }} />
                <DaMesmaForma poema={original} />
              </div>
            </div>
          ),
          direita: (
            <div className="surgir min-h-full">
              <VersoDoPoema
                poema={original}
                repercussao={<Repercussao alvo={{ tipo: "poema", id: original.id }} eu={eu} />}
                comentarios={
                  <ArvoreComentarios
                    campoNoPe
                    total={original.comentarios}
                    alvo={{ tipo: "poema", id: poema.id }}
                    euId={euId}
                    aoMudar={carregarPoema}
                    textoDoPoema={textoComentado(poema)}
                    selecao={critica.selecao}
                    aoLimparSelecao={() => critica.setSelecao(null)}
                    verso={critica.verso}
                    aoLimparFiltro={() => critica.setVerso(null)}
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
function PaginaDoPoema({ poema, critica }: { poema: Post; critica: CriticaAncorada }) {
  const { aoComentar, aoFiltrar } = useIrParaComentarios(critica.setVerso);
  return (
    <PoemaCard
      post={poema}
      folha
      linkarTitulo={false}
      // A seleção é de versos do original: some quando a tradução entra na tela.
      aoTraduzir={() => critica.setSelecao(null)}
      corpo={(exibido) => (
        <VersosComentaveis
          texto={exibido.texto}
          comTitulo={Boolean(exibido.titulo)}
          citar={{ tipo: "poema", id: exibido.id }}
          marcas={critica.marcas}
          selecao={critica.selecao}
          aoSelecionar={critica.setSelecao}
          selecaoPedida={critica.pedida}
          aoComentar={aoComentar}
          aoFiltrar={aoFiltrar}
        />
      )}
    />
  );
}

// Quando o poema saiu: a data e a hora da publicação. No consagrado, a data é a
// da importação, não a da obra: no lugar dela, o ano e a obra ("1912 · Eu"),
// quando houver.
function DataDoPoema({ poema }: { poema: Post }) {
  const classe = "mt-3 text-[0.8125rem] text-tinta-suave";
  if (poema.autor.consagrado) {
    const origem = [poema.ano, poema.obra].filter(Boolean).join(" · ");
    return origem ? <p className={classe}>{origem}</p> : null;
  }
  return (
    <p className={classe}>
      publicado em <time dateTime={poema.created_at}>{formatarDataEHora(poema.created_at)}</time>
    </p>
  );
}

function repostPuro(poema: Post): boolean {
  return poema.repost_de !== null && poema.texto === "";
}

// O texto que recebe os comentários: num repost puro, o do original (como no backend).
function textoComentado(poema: Post): string {
  return repostPuro(poema) && poema.repost_de ? poema.repost_de.texto : poema.texto;
}
