"use client";
// Detalhe da antologia: nome, descrição, dono e os poemas na ordem em que
// entraram. O dono edita (inline), apaga (com confirmação) e tira poemas.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AntologiaFormulario } from "@/components/AntologiaFormulario";
import { SeloPrivada } from "@/components/AntologiaLista";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { NomeAutor } from "@/components/NomeAutor";
import { PoemaCard } from "@/components/PoemaCard";
import { useFecharAoSair } from "@/hooks/useFecharAoSair";
import {
  apagarAntologia,
  buscarAntologia,
  buscarEu,
  caminhoDoLogin,
  editarAntologia,
  ErroDaApi,
  marcarNaAntologia,
  temToken,
  type AntologiaDetalhe,
  type Post,
} from "@/lib/api";

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
        else setErro(e instanceof Error ? e.message : "não deu para carregar a antologia");
      });
  }, [id, router]);

  const cabecalho = <CabecalhoPagina titulo="Antologia" comoTitulo={false} />;
  if (naoExiste)
    return (
      <>
        {cabecalho}
        <div className="px-4 py-10 text-center">
          <h1 className="font-serifada text-xl">Antologia não encontrada</h1>
          <p className="mt-1 text-sm text-tinta-suave">Ela pode ter sido apagada ou ser privada.</p>
          <Link href="/antologias" className="mt-4 inline-flex min-h-11 items-center text-sm text-destaque hover:underline">
            ver minhas antologias
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
  if (!antologia)
    return (
      <>
        {cabecalho}
        <p className="px-4 py-8 text-sm text-tinta-suave">carregando...</p>
      </>
    );

  const dono = antologia.dono_id === meuId;

  async function tirar(postId: number) {
    await marcarNaAntologia(antologia!.id, postId, false);
    setAntologia((a) =>
      a && { ...a, qtd: a.qtd - 1, poemas: a.poemas.filter((p) => p.id !== postId) },
    );
  }

  return (
    <div>
      {cabecalho}
      <div className="border-b border-borda px-4 pt-5 pb-5">
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

      {antologia.poemas.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-serifada text-lg">Nenhum poema nesta antologia ainda.</p>
          {dono && (
            <p className="mt-1 text-sm text-tinta-suave">
              Nos poemas do feed, use “adicionar à antologia” para trazê-los para cá.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-borda border-b border-borda">
          {antologia.poemas.map((p) => (
            <li key={p.id}>
              <PoemaCard post={p} />
              {dono && <TirarDaAntologia poema={p} aoTirar={() => tirar(p.id)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-serifada text-3xl break-words">{antologia.nome}</h1>
        {!antologia.publica && <SeloPrivada />}
      </div>
      {antologia.descricao && <p className="break-words whitespace-pre-wrap">{antologia.descricao}</p>}
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-suave">
        <span>por</span>
        <NomeAutor usuario={antologia.dono} className="font-semibold text-tinta" />
        <span aria-hidden="true">·</span>
        <span>{antologia.publica ? "pública" : "privada"}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {antologia.qtd} {antologia.qtd === 1 ? "poema" : "poemas"}
        </span>
      </p>
      {dono && <AcoesDoDono aoEditar={aoEditar} aoApagar={aoApagar} />}
    </header>
  );
}

// "apagar" pede confirmação ali mesmo, como no apagar comentário: vira
// "apagar? sim / não"; Esc ou clique fora cancelam.
function AcoesDoDono({ aoEditar, aoApagar }: { aoEditar: () => void; aoApagar: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmacao = useRef<HTMLSpanElement>(null);
  const botaoApagar = useRef<HTMLButtonElement>(null);

  // O foco vai para o "não": Enter sem querer não apaga nada.
  useEffect(() => {
    if (confirmando) confirmacao.current?.querySelector<HTMLButtonElement>("button:last-of-type")?.focus();
  }, [confirmando]);

  // Esc devolve o foco ao "apagar"; o clique fora deixa o foco onde o clique o pôs.
  useFecharAoSair(confirmando, confirmacao, (e) => {
    setConfirmando(false);
    if (e.type === "keydown") requestAnimationFrame(() => botaoApagar.current?.focus());
  });

  async function apagar() {
    setConfirmando(false);
    setApagando(true);
    setErro(null);
    try {
      await aoApagar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para apagar a antologia");
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
        {confirmando ? (
          <span ref={confirmacao} className="text-sm text-tinta-suave">
            apagar a antologia?{" "}
            <button
              type="button"
              onClick={apagar}
              className="min-h-11 cursor-pointer text-destaque hover:underline"
            >
              sim
            </button>{" "}
            /{" "}
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                requestAnimationFrame(() => botaoApagar.current?.focus());
              }}
              className="min-h-11 cursor-pointer hover:text-tinta"
            >
              não
            </button>
          </span>
        ) : (
          <button
            ref={botaoApagar}
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={apagando}
            className={acao}
          >
            {apagando ? "apagando..." : "apagar"}
          </button>
        )}
      </div>
      <p className="text-xs text-tinta-suave">Apagar a antologia não apaga os poemas.</p>
      {erro && <p className="mt-1 text-sm text-destaque">{erro}</p>}
    </div>
  );
}

// Alinhado ao texto do poema (depois da coluna do avatar, como as ações do card).
function TirarDaAntologia({ poema, aoTirar }: { poema: Post; aoTirar: () => Promise<void> }) {
  const [tirando, setTirando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function tirar() {
    setTirando(true);
    setErro(null);
    try {
      await aoTirar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para tirar o poema");
      setTirando(false);
    }
  }

  // Um botão por poema: o rótulo diz qual (repost puro mostra o original).
  const original = poema.repost_de && poema.texto === "" ? poema.repost_de : poema;
  const qual = original.titulo ? `“${original.titulo}”` : `o poema de @${original.autor.username}`;
  return (
    <div className="pb-2 pl-[4.25rem]">
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
