"use client";
// Uma renga: os autores no topo e as estrofes em ordem, cada uma com o seu autor.
// Aberta, mostra o campo da próxima estrofe (ou o motivo de não poder escrever);
// fechada, é lida como um poema só, de todos os autores. O criador encerra e,
// no modo convidados, convida mais gente.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NomeAutor } from "@/components/NomeAutor";
import { SeloDaRenga } from "@/components/SeloDaRenga";
import {
  acrescentarEstrofe,
  buscarEu,
  buscarRenga,
  caminhoDoLogin,
  convidarParaRenga,
  encerrarRenga,
  ErroDaApi,
  formatarData,
  lerUsernames,
  mensagemDeFalha,
  temToken,
  type RengaDetalhe,
  type User,
} from "@/lib/api";

const botaoPrincipal =
  "min-h-11 cursor-pointer rounded-full bg-destaque px-5 text-sm font-bold text-papel transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-50";
const botaoSecundario =
  "realce min-h-11 cursor-pointer rounded-full border border-borda px-5 text-sm disabled:opacity-50";
const campo =
  "w-full rounded-xl border border-borda bg-papel px-3 py-2 text-tinta transition-colors duration-150 focus:border-destaque focus:ring-2 focus:ring-destaque/25 focus:outline-none";

export default function RengaPage() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const [renga, setRenga] = useState<RengaDetalhe | null>(null);
  const [eu, setEu] = useState<User | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temToken()) {
      router.replace(caminhoDoLogin());
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setNaoExiste(true);
      return;
    }
    Promise.all([buscarRenga(id), buscarEu()])
      .then(([r, u]) => {
        setRenga(r);
        setEu(u);
      })
      .catch((e) => {
        if (e instanceof ErroDaApi && e.status === 404) setNaoExiste(true);
        else setErro(mensagemDeFalha(e, "não deu para carregar a renga"));
      });
  }, [id, router]);

  const cabecalho = <CabecalhoPagina titulo="Renga" comoTitulo={false} />;
  if (naoExiste)
    return (
      <>
        {cabecalho}
        <div className="px-4 py-10 text-center">
          <h1 className="font-serifada text-xl">Renga não encontrada</h1>
          <Link href="/rengas" className="mt-4 inline-flex min-h-11 items-center text-sm text-destaque hover:underline">
            ver as rengas
          </Link>
        </div>
      </>
    );
  if (erro)
    return (
      <>
        {cabecalho}
        <p className="m-4 rounded-xl border border-destaque p-3 text-sm text-destaque">{erro}</p>
      </>
    );
  if (!renga)
    return (
      <>
        {cabecalho}
        <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>
      </>
    );

  const souCriador = eu?.id === renga.criador.id;

  return (
    <div>
      {cabecalho}
      <article className="border-b border-borda px-4 pt-5 pb-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="poema-titulo break-words">{renga.titulo}</h1>
            <SeloDaRenga fechada={renga.fechada} />
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
            <span>{renga.fechada ? "um poema de" : "escrita por"}</span>
            <ListaDeAutores autores={renga.autores} />
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-tinta-suave">
            <span className="tabular-nums">
              {renga.qtd_estrofes} de {renga.limite} estrofes
            </span>
            <span aria-hidden="true">·</span>
            <span>{renga.modo === "aberta" ? "qualquer pessoa escreve" : "só convidados"}</span>
            <span aria-hidden="true">·</span>
            <span>começada em {formatarData(renga.created_at)}</span>
            {renga.fechada_em && (
              <>
                <span aria-hidden="true">·</span>
                <span>fechada em {formatarData(renga.fechada_em)}</span>
              </>
            )}
          </p>
          {renga.modo === "convidados" && renga.convidados.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-tinta-suave">
              <span>convidados:</span>
              <ListaDeAutores autores={renga.convidados} />
            </p>
          )}
        </header>

        <ol className="mt-6 space-y-6">
          {renga.estrofes.map((e) => (
            <li key={e.id}>
              <p className="poema-corpo">{e.texto}</p>
              <p className="mt-1 text-xs text-tinta-suave">
                — <NomeAutor usuario={e.autor} className="font-semibold" />
              </p>
            </li>
          ))}
        </ol>
      </article>

      {!renga.fechada && (
        <section aria-label="próxima estrofe" className="border-b border-borda px-4 py-5">
          {renga.posso_escrever ? (
            <ProximaEstrofe rengaId={renga.id} aoAcrescentar={setRenga} />
          ) : (
            <p className="text-sm text-tinta-suave">{renga.motivo}</p>
          )}
        </section>
      )}

      {souCriador && !renga.fechada && (
        <section aria-label="ações de quem criou" className="space-y-4 border-b border-borda px-4 py-5">
          {renga.modo === "convidados" && <Convidar rengaId={renga.id} aoConvidar={setRenga} />}
          <Encerrar rengaId={renga.id} aoEncerrar={setRenga} />
        </section>
      )}
    </div>
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
  rengaId,
  aoAcrescentar,
}: {
  rengaId: number;
  aoAcrescentar: (renga: RengaDetalhe) => void;
}) {
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
    <form onSubmit={enviar} noValidate className="space-y-3">
      <label className="block text-sm">
        Próxima estrofe
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          className={`${campo} poema-corpo mt-1 resize-y`}
        />
      </label>
      {erro && <p className="text-sm text-destaque">{erro}</p>}
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
      <label className="block text-sm">
        Convidar mais gente
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="@username, @outro"
          className={`${campo} mt-1`}
        />
      </label>
      {erro && <p className="text-sm text-destaque">{erro}</p>}
      <button type="submit" disabled={enviando} className={botaoSecundario}>
        {enviando ? "convidando..." : "Convidar"}
      </button>
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
