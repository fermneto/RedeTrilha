"use client";
// Uma renga: os autores no topo e as estrofes em ordem, cada uma com o seu autor.
// Aberta, mostra o campo da próxima estrofe (ou o motivo de não poder escrever);
// fechada, é lida como um poema só, de todos os autores. O criador encerra e,
// no modo convidados, convida mais gente.
// Aberta ou fechada, a renga tem as ações do poema (curtir, repostar, citar,
// guardar, enviar, #171) e recebe comentários e crítica ancorada no verso, como
// a página do poema: o corpo é o VersosComentaveis sobre o texto da renga (as
// estrofes juntas, uma linha em branco entre elas), com o autor de cada estrofe
// embaixo do último verso dela. No livro, como o poema: a renga na página da
// esquerda e, na da direita, as ações, quem curtiu, repostou e citou, e os
// comentários (no celular, a página seguinte).
// /rengas/3?versos=2-4 (do "comentar estes versos" no card) abre com os versos
// selecionados e o campo de comentário focado.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { ArvoreComentarios, ID_DO_CAMPO_DE_COMENTARIO } from "@/components/ArvoreComentarios";
import { AcoesDaRenga } from "@/components/BarraDeAcoes";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CadernoFolhas, useFolhas } from "@/components/CadernoFolhas";
import { ConversaDaRenga } from "@/components/CadernoPoema";
import { EditorDePoema } from "@/components/EditorDePoema";
import { EsqueletoDaPaginaDaRenga } from "@/components/Esqueleto";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { MaisDoAutor } from "@/components/MaisDoAutor";
import { NomeAutor } from "@/components/NomeAutor";
import { Repercussao } from "@/components/Repercussao";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import { VersosComentaveis } from "@/components/VersosComentaveis";
import {
  acrescentarEstrofe,
  buscarEu,
  buscarRenga,
  buscarVersosComentados,
  caminhoDoLogin,
  convidarParaRenga,
  encerrarRenga,
  ErroDaApi,
  fimDasEstrofes,
  formatarDataEHora,
  lerUsernames,
  lerVersosDaUrl,
  mensagemDeFalha,
  temToken,
  textoDaRenga,
  type RengaDetalhe,
  type SelecaoDeVersos,
  type User,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

const botaoPrincipal =
  "min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50";
const botaoSecundario =
  "realce min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm disabled:opacity-50";
// A moldura das rotas que não desenham as próprias folhas (components/Caderno.tsx).
const MOLDURA = "flex min-h-full flex-col px-(--recuo-da-folha) pb-6";
const campo =
  "w-full rounded-xl border border-borda bg-papel px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";

export default function RengaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [renga, setRenga] = useState<RengaDetalhe | null>(null);
  const [eu, setEu] = useState<User | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Crítica ancorada: versos selecionados, marcas por verso e o filtro da marca.
  const [selecao, setSelecao] = useState<SelecaoDeVersos | null>(null);
  const [marcas, setMarcas] = useState<Map<number, number>>(new Map());
  const [verso, setVerso] = useState<number | null>(null);
  // ?versos=2-4: lido uma vez, quando a renga chega, e passado uma vez aos versos.
  const [pedida, setPedida] = useState<SelecaoDeVersos | null>(null);
  const leuAUrl = useRef(false);

  // Também chamado pela árvore depois de comentar ou apagar. Sem as marcas, a
  // renga continua legível: só não mostra os números.
  const carregarMarcas = useCallback(
    () =>
      buscarVersosComentados({ tipo: "renga", id })
        .then(({ items }) => setMarcas(new Map(items.map((m) => [m.verso, m.comentarios]))))
        .catch(() => setMarcas(new Map())),
    [id],
  );

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setNaoExiste(true);
      return;
    }
    // As marcas chegam junto com a renga: entrando depois, elas quebram versos
    // longos no celular e empurram o campo que o ?versos= acabou de focar.
    Promise.all([buscarRenga(id), buscarEu(), carregarMarcas()])
      .then(([r, u]) => {
        setRenga(r);
        setEu(u);
      })
      .catch((e) => {
        if (e instanceof ErroDaApi && e.status === 404) setNaoExiste(true);
        else setErro(mensagemDeFalha(e, "não deu para carregar a renga"));
      });
  }, [id, router, carregarMarcas]);

  useEffect(() => {
    if (!renga || leuAUrl.current) return;
    leuAUrl.current = true;
    const versos = new URLSearchParams(window.location.search).get("versos");
    setPedida(lerVersosDaUrl(versos, textoSemMarcas(textoDaRenga(renga.estrofes))));
  }, [renga]);

  // Os versos aplicam o pedido no mesmo commit; depois ele se apaga.
  useEffect(() => {
    if (pedida) setPedida(null);
  }, [pedida]);

  const texto = renga ? textoDaRenga(renga.estrofes) : "";
  // O autor de cada estrofe, embaixo do último verso dela.
  const rodape = useMemo(() => {
    const mapa = new Map<number, React.ReactNode>();
    if (!renga) return mapa;
    fimDasEstrofes(renga.estrofes).forEach((fim, i) => {
      const e = renga.estrofes[i];
      mapa.set(
        fim,
        <span className="mt-1 mb-2 block font-sans text-[0.8125rem] text-tinta-suave">
          <span aria-hidden="true">— </span>
          <span className="sr-only">estrofe de </span>
          <NomeAutor usuario={e.autor} className="font-semibold" />
        </span>,
      );
    });
    return mapa;
  }, [renga]);

  const cabecalho = <CabecalhoPagina titulo="Renga" comoTitulo={false} voltar />;
  // Sem a renga (ou com erro), uma folha só, com o aviso ou o esqueleto.
  const umaFolha = (rotulo: string, conteudo: React.ReactNode) => (
    <CadernoFolhas
      key="estado"
      folhas={[
        {
          chave: "estado",
          rotulo,
          esquerda: (
            <div className={MOLDURA}>
              {cabecalho}
              {conteudo}
            </div>
          ),
        },
      ]}
    />
  );
  if (naoExiste)
    return umaFolha(
      "renga não encontrada",
      <div className="px-4 py-10 text-center">
        <h1 className="font-serifada text-xl">Renga não encontrada</h1>
        <Link
          href="/explorar?aba=rengas"
          className="mt-4 inline-flex min-h-11 items-center text-sm text-destaque hover:underline"
        >
          ver as rengas
        </Link>
      </div>,
    );
  if (erro)
    return umaFolha(erro, <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>);
  if (!renga) return umaFolha("carregando a renga", <EsqueletoDaPaginaDaRenga />);

  // Como o poema: na página dupla, a renga na esquerda e, na direita, as ações,
  // quem curtiu, repostou e citou, e os comentários; no celular, duas páginas, e
  // "comentar estes versos" vira até a dos comentários.
  return (
    <CadernoFolhas
      key={renga.id}
      anterior="voltar à renga"
      proxima="ver ações e comentários"
      folhas={[
        {
          chave: `renga-${renga.id}`,
          rotulo: `renga ${renga.titulo}`,
          rotuloDaDireita: "ações e comentários",
          esquerda: (
            <div className={`surgir ${MOLDURA}`}>
              {cabecalho}
              <PaginaDaRenga
                renga={renga}
                souCriador={eu?.id === renga.criador.id}
                aoMudar={setRenga}
                texto={texto}
                rodape={rodape}
                marcas={marcas}
                selecao={selecao}
                aoSelecionar={setSelecao}
                pedida={pedida}
                aoFiltrar={setVerso}
              />
            </div>
          ),
          direita: (
            <div className="surgir min-h-full">
              <ConversaDaRenga
                renga={renga}
                naPropriaPagina
                repercussao={<Repercussao alvo={{ tipo: "renga", id: renga.id }} eu={eu} />}
                comentarios={
                  <ArvoreComentarios
                    campoNoPe
                    alvo={{ tipo: "renga", id: renga.id }}
                    euId={eu?.id ?? null}
                    aoMudar={carregarMarcas}
                    textoDoPoema={texto}
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

// A renga na página da esquerda: os autores, as estrofes (que se selecionam para
// comentar ou citar), as datas, a próxima estrofe, o que o criador faz e, no pé,
// mais de quem abriu a renga. No celular, as ações vêm aqui também, com o
// caminho para a página da conversa.
function PaginaDaRenga({
  renga,
  souCriador,
  aoMudar,
  texto,
  rodape,
  marcas,
  selecao,
  aoSelecionar,
  pedida,
  aoFiltrar,
}: {
  renga: RengaDetalhe;
  souCriador: boolean;
  aoMudar: (renga: RengaDetalhe) => void;
  texto: string;
  rodape: Map<number, React.ReactNode>;
  marcas: Map<number, number>;
  selecao: SelecaoDeVersos | null;
  aoSelecionar: (s: SelecaoDeVersos | null) => void;
  pedida: SelecaoDeVersos | null;
  aoFiltrar: (verso: number) => void;
}) {
  const { duplo, mostrar } = useFolhas();
  // "comentar", no card do feed, abre /rengas/{id}#comentarios: no celular, já na página deles.
  useEffect(() => {
    if (window.location.hash === "#comentarios") mostrar("d");
  }, []);

  return (
    <>
      <header className="px-4 pt-2 pb-3">
        <h1 id="titulo-da-renga" className="poema-titulo break-words">
          {renga.titulo}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
          <span>{renga.fechada ? "um poema de" : "escrita por"}</span>
          <ListaDeAutores autores={renga.autores} />
        </p>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-tinta-suave">
          <SeloDaRenga fechada={renga.fechada} />{" "}
          <span className="tabular-nums">
            {renga.qtd_estrofes} de {renga.limite} estrofes
          </span>
          , {renga.modo === "aberta" ? "qualquer pessoa escreve" : "só convidados"}
        </p>
        {renga.modo === "convidados" && renga.convidados.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-tinta-suave">
            <span>convidados:</span>
            <ListaDeAutores autores={renga.convidados} />
          </p>
        )}
      </header>

      <article aria-labelledby="titulo-da-renga" className="border-b border-borda px-4 pt-2 pb-6">
        {/* As estrofes leem como um poema só, numeradas verso a verso (a linha em
            branco entre elas conta); o autor de cada uma fica logo abaixo dela, discreto. */}
        <div className="mt-5">
          <VersosComentaveis
            texto={texto}
            citar={{ tipo: "renga", id: renga.id }}
            rodape={rodape}
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
        </div>

        <p className="mt-8 text-xs text-tinta-suave">
          começada em <time dateTime={renga.created_at}>{formatarDataEHora(renga.created_at)}</time>
          {renga.fechada_em && (
            <>
              {" "}
              · fechada em <time dateTime={renga.fechada_em}>{formatarDataEHora(renga.fechada_em)}</time>
            </>
          )}
        </p>

        {/* Na página dupla, as ações ficam na página da direita, presas no topo. */}
        {!duplo && (
          <>
            <div className="mt-6">
              <AcoesDaRenga key={renga.id} renga={renga} />
            </div>
            <IrParaAConversa comentarios={renga.comentarios} aoIr={() => mostrar("d")} />
          </>
        )}
      </article>

      {!renga.fechada && (
        <section aria-labelledby="titulo-proxima-estrofe" className="border-b border-borda px-4 py-5">
          <h2 id="titulo-proxima-estrofe" className="text-sm font-semibold tracking-normal">
            Próxima estrofe
            <span className="font-normal text-tinta-suave tabular-nums">
              {" "}
              · {renga.qtd_estrofes + 1}ª de {renga.limite}
            </span>
          </h2>
          {renga.posso_escrever ? (
            <ProximaEstrofe renga={renga} aoAcrescentar={aoMudar} />
          ) : (
            <p className="mt-2 text-sm text-tinta-suave">{renga.motivo}</p>
          )}
        </section>
      )}

      {souCriador && !renga.fechada && (
        <section aria-label="ações de quem criou" className="space-y-5 border-b border-borda px-4 py-5">
          {renga.modo === "convidados" && <Convidar rengaId={renga.id} aoConvidar={aoMudar} />}
          <Encerrar rengaId={renga.id} aoEncerrar={aoMudar} />
        </section>
      )}

      <div className="px-4">
        <MaisDoAutor autor={renga.criador} aberto={{ tipo: "renga", id: renga.id }} />
      </div>
    </>
  );
}

// No celular, o caminho da renga para a página da conversa, como no poema.
function IrParaAConversa({ comentarios, aoIr }: { comentarios: number; aoIr: () => void }) {
  return (
    <button
      type="button"
      onClick={aoIr}
      className="mt-4 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-borda px-4 text-left text-sm whitespace-nowrap transition-colors duration-150 hover:border-tinta-suave"
    >
      <IconeComentar className="h-[1.125rem] w-[1.125rem] shrink-0 text-tinta-suave" />
      <span className="min-w-0 truncate">
        <span className="text-tinta-suave tabular-nums">
          {comentarios === 0
            ? "nenhum comentário"
            : `${comentarios} ${comentarios === 1 ? "comentário" : "comentários"}`}
        </span>
        <span className="text-tinta-suave"> · </span>
        <span className="font-semibold text-destaque">{comentarios > 0 ? "ver a conversa" : "comentar"}</span>
      </span>
    </button>
  );
}

function ListaDeAutores({ autores }: { autores: User[] }) {
  return (
    <>
      {autores.map((autor, i) => (
        <span key={autor.id} className="inline-flex items-center">
          <NomeAutor usuario={autor} className="font-semibold text-tinta" />
          {i < autores.length - 1 && <span aria-hidden="true">,</span>}
        </span>
      ))}
    </>
  );
}

function ProximaEstrofe({
  renga,
  aoAcrescentar,
}: {
  renga: RengaDetalhe;
  aoAcrescentar: (renga: RengaDetalhe) => void;
}) {
  const rengaId = renga.id;
  const anterior = renga.estrofes[renga.estrofes.length - 1];
  const ultima = renga.qtd_estrofes + 1 >= renga.limite;
  const idAjuda = useId();
  const idErro = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) {
      setErro("a estrofe não pode ficar vazia");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      // Vai como foi escrita: quebras e recuos fazem parte do poema.
      aoAcrescentar(await acrescentarEstrofe(rengaId, texto));
      setTexto("");
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para acrescentar a estrofe"));
      // 409: outra pessoa escreveu antes ou a renga fechou; recarrega para mostrar.
      if (err instanceof ErroDaApi && err.status === 409) {
        buscarRenga(rengaId).then(aoAcrescentar).catch(() => undefined);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-2 space-y-3">
      <p id={idAjuda} className="text-sm text-tinta-suave">
        {anterior ? <>É a sua vez: responda à estrofe de {anterior.autor.name}.</> : "É a sua vez."}
        {ultima && " É a última: com ela, a renga fecha."}
      </p>
      <EditorDePoema
        valor={texto}
        aoMudar={setTexto}
        idRotulo="titulo-proxima-estrofe"
        idAjuda={erro ? `${idAjuda} ${idErro}` : idAjuda}
        invalido={Boolean(erro)}
        linhas={5}
        classe={campo}
      />
      {erro && (
        <p id={idErro} role="alert" className="text-sm text-destaque">
          {erro}
        </p>
      )}
      <button type="submit" disabled={enviando} className={botaoPrincipal}>
        {enviando ? "enviando..." : "Acrescentar estrofe"}
      </button>
    </form>
  );
}

function Convidar({
  rengaId,
  aoConvidar,
}: {
  rengaId: number;
  aoConvidar: (renga: RengaDetalhe) => void;
}) {
  const idCampo = useId();
  const idErro = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const usernames = lerUsernames(texto);
    if (usernames.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      aoConvidar(await convidarParaRenga(rengaId, usernames));
      setTexto("");
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para convidar"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-2">
      <label htmlFor={idCampo} className="block text-sm">
        Convidar mais gente
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={idCampo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="@username, @outro"
          aria-describedby={erro ? idErro : undefined}
          className={`${campo} min-h-11 min-w-0 flex-1 basis-40`}
        />
        <button type="submit" disabled={enviando} className={botaoSecundario}>
          {enviando ? "convidando..." : "Convidar"}
        </button>
      </div>
      {erro && (
        <p id={idErro} role="alert" className="text-sm text-destaque">
          {erro}
        </p>
      )}
    </form>
  );
}

// Encerrar pede confirmação ali mesmo: fechada, a renga não aceita mais estrofes.
function Encerrar({
  rengaId,
  aoEncerrar,
}: {
  rengaId: number;
  aoEncerrar: (renga: RengaDetalhe) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function encerrar() {
    setEnviando(true);
    setErro(null);
    try {
      aoEncerrar(await encerrarRenga(rengaId));
    } catch (err) {
      setErro(mensagemDeFalha(err, "não deu para encerrar a renga"));
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      {confirmando ? (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span>Encerrar a renga? Ninguém mais poderá escrever.</span>
          <button type="button" onClick={encerrar} disabled={enviando} className={botaoPrincipal}>
            {enviando ? "encerrando..." : "Encerrar"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className={botaoSecundario}>
            Cancelar
          </button>
        </p>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className={botaoSecundario}>
          Encerrar a renga
        </button>
      )}
      {erro && <p className="text-sm text-destaque">{erro}</p>}
    </div>
  );
}
