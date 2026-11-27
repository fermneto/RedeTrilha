"use client";
// Detalhe da antologia: nome, descrição, dono e os poemas e as rengas (#171)
// numa lista só, na ordem em que foram guardados. O dono edita (inline), apaga
// (com confirmação) e tira poemas e rengas. No livro, a antologia fica na página
// da esquerda e a ficha dela (quem reuniu, quando, quantos poemas, as outras da
// mesma pessoa) na da direita; no celular, a ficha é a página seguinte.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AntologiaFormulario } from "@/components/AntologiaFormulario";
import { SeloPrivada } from "@/components/AntologiaLista";
import { ouvirMudancas } from "@/components/AntologiaSeletor";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CadernoFolhas, useFolhas } from "@/components/CadernoFolhas";
import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { EsqueletoDaPaginaDaAntologia } from "@/components/Esqueleto";
import { FichaDaAntologia } from "@/components/FichaDaAntologia";
import { NomeAutor } from "@/components/NomeAutor";
import { PoemaCard } from "@/components/PoemaCard";
import { RengaCard } from "@/components/RengaCard";
import {
  apagarAntologia,
  buscarAntologia,
  buscarEu,
  caminhoDoLogin,
  editarAntologia,
  ErroDaApi,
  marcarNaAntologia,
  mensagemDeFalha,
  temToken,
  type Alvo,
  type AntologiaDetalhe,
  type Post,
  type RengaDetalhe,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

// A moldura das rotas que não desenham as próprias folhas (components/Caderno.tsx).
const MOLDURA = "flex min-h-full flex-col px-(--recuo-da-folha) pb-6";

// Uma folha do livro: a página da esquerda e, se houver, a da direita.
function Folha({
  rotulo,
  esquerda,
  direita,
}: {
  rotulo: string;
  esquerda: React.ReactNode;
  direita?: React.ReactNode;
}) {
  return (
    <CadernoFolhas
      key={rotulo}
      anterior="voltar à antologia"
      proxima="ver a ficha da antologia"
      folhas={[
        {
          chave: "antologia",
          rotulo,
          rotuloDaDireita: "ficha da antologia",
          esquerda: <div className={MOLDURA}>{esquerda}</div>,
          direita,
        },
      ]}
    />
  );
}

export default function AntologiaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [antologia, setAntologia] = useState<AntologiaDetalhe | null>(null);
  const [meuId, setMeuId] = useState<number | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setNaoExiste(true);
      return;
    }
    Promise.all([buscarAntologia(id), buscarEu()])
      .then(([a, eu]) => {
        setAntologia(a);
        setMeuId(eu.id);
        setErro(null);
      })
      .catch((e) => {
        // Privada de outra pessoa também dá 404: a tela não revela que ela existe.
        if (e instanceof ErroDaApi && e.status === 404) setNaoExiste(true);
        else setErro(mensagemDeFalha(e, "não deu para carregar a antologia"));
      });
  }, [id, router]);

  // Desmarcar esta antologia no popover de um card aqui dentro tira o poema (ou a
  // renga) da lista na hora (o popover manda o id do original; repost puro conta como ele).
  useEffect(
    () =>
      ouvirMudancas(({ antologiaId, alvo, contem }) => {
        if (antologiaId === id && !contem) setAntologia((a) => a && semOAlvo(a, alvo));
      }),
    [id],
  );

  const cabecalho = <CabecalhoPagina titulo="Antologia" comoTitulo={false} voltar />;
  if (naoExiste)
    return (
      <Folha
        rotulo="antologia não encontrada"
        esquerda={
          <>
            {cabecalho}
            <div className="px-4 py-10 text-center">
              <h1 className="font-serifada text-xl">Antologia não encontrada</h1>
              <p className="mt-1 text-sm text-tinta-suave">Ela pode ter sido apagada ou ser privada.</p>
              <Link
                href="/antologias"
                className="mt-4 inline-flex min-h-11 items-center text-sm text-destaque hover:underline"
              >
                ver minhas antologias
              </Link>
            </div>
          </>
        }
      />
    );
  if (erro)
    return (
      <Folha
        rotulo={erro}
        esquerda={
          <>
            {cabecalho}
            <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
          </>
        }
      />
    );
  if (!antologia)
    return (
      <Folha
        rotulo="carregando a antologia"
        esquerda={
          <>
            {cabecalho}
            <EsqueletoDaPaginaDaAntologia />
          </>
        }
      />
    );

  const dono = antologia.dono_id === meuId;

  async function tirar(alvo: Alvo) {
    await marcarNaAntologia(antologia!.id, alvo, false);
    setAntologia((a) => a && semOAlvo(a, alvo));
  }
  const itens = itensDaAntologia(antologia);

  return (
    <Folha
      rotulo={`antologia ${antologia.nome}`}
      direita={
        <div className="surgir">
          <FichaDaAntologia antologia={antologia} />
        </div>
      }
      esquerda={
        <div className="surgir">
          {cabecalho}
          <div className="linha-da-folha border-b border-borda pt-8 pb-6">
            {editando ? (
              <AntologiaFormulario
                inicial={antologia}
                textoDoBotao="Salvar"
                aoEnviar={async (dados) => {
                  const nova = await editarAntologia(antologia.id, dados);
                  setAntologia((a) => a && { ...a, ...nova });
                  setEditando(false);
                }}
                aoCancelar={() => setEditando(false)}
              />
            ) : (
              <Cabecalho
                antologia={antologia}
                dono={dono}
                aoEditar={() => setEditando(true)}
                aoApagar={async () => {
                  await apagarAntologia(antologia.id);
                  router.push("/antologias");
                }}
              />
            )}
          </div>

          {itens.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-serifada text-lg">Nenhum poema nesta antologia ainda.</p>
              {dono && (
                <p className="mx-auto mt-1 max-w-sm text-sm text-tinta-suave">
                  Nos poemas do feed, use o botão “adicionar à antologia” para trazê-los para cá.
                </p>
              )}
              {dono && (
                <Link
                  href="/"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold realce"
                >
                  Ir para o feed
                </Link>
              )}
            </div>
          ) : (
            <>
              {itens.length > 1 && <Indice itens={itens} />}
              <h2 className="sr-only">Poemas</h2>
              <ol className="lista-da-folha divide-y divide-borda border-b border-borda">
                {itens.map((item) => (
                  <li
                    key={ancora(item)}
                    id={ancora(item)}
                    className="scroll-mt-14 transition-colors duration-700 ease-out target:bg-painel"
                  >
                    {item.tipo === "poema" ? (
                      <>
                        <PoemaCard post={item.poema} />
                        {dono && (
                          <TirarDaAntologia
                            qual={qualPoema(item.poema)}
                            aoTirar={() => tirar({ tipo: "poema", id: item.poema.id })}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <RengaCard renga={item.renga} />
                        {dono && (
                          <TirarDaAntologia
                            qual={`a renga “${item.renga.titulo}”`}
                            aoTirar={() => tirar({ tipo: "renga", id: item.renga.id })}
                            recuo={false}
                          />
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      }
    />
  );
}

// A antologia sem o poema (ele mesmo, ou um repost puro dele) ou sem a renga.
function semOAlvo(antologia: AntologiaDetalhe, alvo: Alvo): AntologiaDetalhe {
  if (alvo.tipo === "renga") {
    const rengas = (antologia.rengas ?? []).filter((r) => r.id !== alvo.id);
    return { ...antologia, rengas, qtd: antologia.qtd - ((antologia.rengas ?? []).length - rengas.length) };
  }
  const fica = (p: Post) => p.id !== alvo.id && !(p.texto === "" && p.repost_de?.id === alvo.id);
  const poemas = antologia.poemas.filter(fica);
  return { ...antologia, poemas, qtd: antologia.qtd - (antologia.poemas.length - poemas.length) };
}

// O nome do poema no botão de tirar (repost puro mostra o original).
function qualPoema(poema: Post): string {
  const original = poema.repost_de && poema.texto === "" ? poema.repost_de : poema;
  return original.titulo ? `“${original.titulo}”` : `o poema de @${original.autor.username}`;
}

// Um poema ou uma renga da antologia.
type Item = { tipo: "poema"; poema: Post } | { tipo: "renga"; renga: RengaDetalhe };

// Poemas e rengas numa lista só, na `ordem` em que foram guardados. Sem a ordem
// (resposta antiga), os poemas e depois as rengas.
function itensDaAntologia(antologia: AntologiaDetalhe): Item[] {
  const poemas = antologia.poemas.map((poema): Item => ({ tipo: "poema", poema }));
  const rengas = (antologia.rengas ?? []).map((renga): Item => ({ tipo: "renga", renga }));
  if (!antologia.ordem) return [...poemas, ...rengas];
  const porChave = new Map([...poemas, ...rengas].map((item) => [ancora(item), item]));
  return antologia.ordem.flatMap(({ tipo, id }) => porChave.get(`${tipo}-${id}`) ?? []);
}

// O poema que o leitor vê no card: num repost puro, o original.
function poemaVisivel(p: Post): Post {
  return p.repost_de && p.texto === "" ? p.repost_de : p;
}

function ancora(item: Item): string {
  return item.tipo === "poema" ? `poema-${item.poema.id}` : `renga-${item.renga.id}`;
}

// Como nos livros de poemas: o poema sem título entra no índice pelo primeiro verso.
function primeiroVerso(texto: string): string {
  return textoSemMarcas(texto).split("\n").find((linha) => linha.trim() !== "")?.trim() ?? "";
}

// O que o índice mostra de cada item: a renga pelo título, com os autores dela.
function linhaDoIndice(item: Item): { titulo: string | null; primeiro: string; autor: string } {
  if (item.tipo === "renga") {
    const { renga } = item;
    return { titulo: renga.titulo, primeiro: "", autor: `renga de ${renga.autores.map((a) => a.name).join(", ")}` };
  }
  const poema = poemaVisivel(item.poema);
  return {
    titulo: poema.titulo,
    primeiro: primeiroVerso(poema.texto),
    autor: poema.autor.name || `@${poema.autor.username}`,
  };
}

// Antologia com mais poemas que isto é "longa": o índice abre recolhido, para os
// poemas não ficarem lá embaixo; com até tantos, ele abre aberto e nem recolhe.
const POEMAS_NO_INDICE_ABERTO = 8;

// O índice da antologia, na ordem em que os poemas entraram: cada linha leva
// ao poema mais abaixo na página.
function Indice({ itens }: { itens: Item[] }) {
  const longa = itens.length > POEMAS_NO_INDICE_ABERTO;
  const [aberto, setAberto] = useState(!longa);
  const idLista = useId();

  return (
    <nav aria-labelledby="indice-da-antologia" className="linha-da-folha border-b border-borda pt-5 pb-4">
      {longa ? (
        <h2 id="indice-da-antologia" className="text-sm font-bold">
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={idLista}
            onClick={() => setAberto((a) => !a)}
            className="-mx-2 -my-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 realce"
          >
            Índice
            <span className="font-normal text-tinta-suave tabular-nums">{itens.length} poemas</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 text-tinta-suave transition-transform duration-150 ${aberto ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </h2>
      ) : (
        <h2 id="indice-da-antologia" className="text-sm font-bold">
          Índice
        </h2>
      )}
      <ol id={idLista} hidden={longa && !aberto} className="mt-2">
        {itens.map((item, i) => {
          const { titulo, primeiro, autor } = linhaDoIndice(item);
          return (
            <li key={ancora(item)}>
              <a
                href={`#${ancora(item)}`}
                className="group -mx-2 flex min-h-11 items-baseline gap-3 rounded-lg px-2 py-2 realce"
              >
                <span className="w-5 shrink-0 text-right text-[0.8125rem] text-tinta-suave tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {titulo ? (
                    <span className="block font-serifada font-semibold break-words group-hover:underline">
                      {titulo}
                    </span>
                  ) : (
                    <span className="block truncate font-serifada italic group-hover:underline">
                      {primeiro || "poema sem título"}
                    </span>
                  )}
                  <span className="block truncate text-[0.8125rem] text-tinta-suave">{autor}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Cabecalho({
  antologia,
  dono,
  aoEditar,
  aoApagar,
}: {
  antologia: AntologiaDetalhe;
  dono: boolean;
  aoEditar: () => void;
  aoApagar: () => Promise<void>;
}) {
  const { duplo } = useFolhas();
  return (
    <header>
      <h1 className="font-serifada text-[2rem] leading-tight font-semibold tracking-[-0.02em] break-words">
        {antologia.nome}
      </h1>
      {antologia.descricao && (
        <p className="mt-3 max-w-[60ch] font-serifada text-[1.0625rem] leading-relaxed break-words whitespace-pre-wrap italic">
          {antologia.descricao}
        </p>
      )}
      {/* Na página dupla, quem reuniu e quantos poemas ficam na ficha, à direita. */}
      {!duplo && (
        <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-tinta-suave">
          <span>reunida por</span>
          <NomeAutor usuario={antologia.dono} className="font-semibold text-tinta" />
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {antologia.qtd} {antologia.qtd === 1 ? "poema" : "poemas"}
          </span>
          {!antologia.publica && (
            <span className="inline-flex items-center gap-x-1.5">
              <span aria-hidden="true">·</span>
              <SeloPrivada />
            </span>
          )}
        </p>
      )}
      {dono && (
        <div className="mt-3">
          <AcoesDoDono aoEditar={aoEditar} aoApagar={aoApagar} />
        </div>
      )}
    </header>
  );
}

// "apagar" pede confirmação ali mesmo (ConfirmacaoInline): vira
// "apagar a antologia? sim / não"; Esc ou clique fora cancelam.
function AcoesDoDono({ aoEditar, aoApagar }: { aoEditar: () => void; aoApagar: () => Promise<void> }) {
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setApagando(true);
    setErro(null);
    try {
      await aoApagar();
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para apagar a antologia"));
      setApagando(false);
    }
  }

  const acao = "min-h-11 cursor-pointer text-sm text-tinta-suave hover:text-tinta disabled:opacity-50";
  return (
    <div>
      <div className="flex items-center gap-5">
        <button type="button" onClick={aoEditar} disabled={apagando} className={acao}>
          editar
        </button>
        <ConfirmacaoInline
          pergunta="apagar a antologia?"
          rotulo={apagando ? "apagando..." : "apagar"}
          classeDoBotao={acao}
          aoConfirmar={apagar}
          desabilitado={apagando}
        />
      </div>
      <p className="text-xs text-tinta-suave">Apagar a antologia não apaga os poemas.</p>
      {erro && <p className="mt-1 text-sm text-destaque">{erro}</p>}
    </div>
  );
}

// Alinhado ao texto do poema (depois da coluna do avatar, como as ações do card);
// na renga, que não tem avatar, ao texto dela (`recuo` falso).
function TirarDaAntologia({
  qual,
  aoTirar,
  recuo = true,
}: {
  qual: string;
  aoTirar: () => Promise<void>;
  recuo?: boolean;
}) {
  const [tirando, setTirando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function tirar() {
    setTirando(true);
    setErro(null);
    try {
      await aoTirar();
    } catch (e) {
      setErro(mensagemDeFalha(e, "não deu para tirar da antologia"));
      setTirando(false);
    }
  }

  // Um botão por poema ou renga: o rótulo diz qual.
  return (
    <div className={`pb-2 ${recuo ? "pl-[4.25rem]" : "px-4"}`}>
      <button
        type="button"
        onClick={tirar}
        aria-label={`tirar ${qual} da antologia`}
        disabled={tirando}
        className="min-h-11 cursor-pointer text-[0.8125rem] text-tinta-suave hover:text-destaque disabled:opacity-50"
      >
        {tirando ? "tirando..." : "tirar da antologia"}
      </button>
      {erro && <p className="text-xs text-destaque">{erro}</p>}
    </div>
  );
}
