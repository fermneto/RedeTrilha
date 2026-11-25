"use client";
// Detalhe da antologia: nome, descrição, dono e os poemas na ordem em que
// entraram. O dono edita (inline), apaga (com confirmação) e tira poemas.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AntologiaFormulario } from "@/components/AntologiaFormulario";
import { SeloPrivada } from "@/components/AntologiaLista";
import { ouvirMudancas } from "@/components/AntologiaSeletor";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ConfirmacaoInline } from "@/components/ConfirmacaoInline";
import { EsqueletoDaPaginaDaAntologia } from "@/components/Esqueleto";
import { NomeAutor } from "@/components/NomeAutor";
import { PoemaCard } from "@/components/PoemaCard";
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
  type AntologiaDetalhe,
  type Post,
} from "@/lib/api";
import { textoSemMarcas } from "@/lib/marcas";

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

  // Desmarcar esta antologia no popover de um card aqui dentro tira o poema da
  // lista na hora (o popover manda o id do original; repost puro conta como ele).
  useEffect(
    () =>
      ouvirMudancas(({ antologiaId, postId, contem }) => {
        if (antologiaId === id && !contem) setAntologia((a) => a && semOPoema(a, postId));
      }),
    [id],
  );

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
        <EsqueletoDaPaginaDaAntologia />
      </>
    );

  const dono = antologia.dono_id === meuId;

  async function tirar(postId: number) {
    await marcarNaAntologia(antologia!.id, postId, false);
    setAntologia((a) => a && semOPoema(a, postId));
  }

  return (
    <div>
      {cabecalho}
      <div className="border-b border-borda px-4 pt-8 pb-6">
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
          {antologia.poemas.length > 1 && <Indice poemas={antologia.poemas} />}
          <h2 className="sr-only">Poemas</h2>
          <ol className="divide-y divide-borda border-b border-borda">
            {antologia.poemas.map((p) => (
              <li
                key={p.id}
                id={ancora(p)}
                className="scroll-mt-14 transition-colors duration-700 ease-out target:bg-painel"
              >
                <PoemaCard post={p} />
                {dono && <TirarDaAntologia poema={p} aoTirar={() => tirar(p.id)} />}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

// A antologia sem o poema `postId` (ele mesmo, ou um repost puro dele).
function semOPoema(antologia: AntologiaDetalhe, postId: number): AntologiaDetalhe {
  const fica = (p: Post) => p.id !== postId && !(p.texto === "" && p.repost_de?.id === postId);
  const poemas = antologia.poemas.filter(fica);
  return { ...antologia, poemas, qtd: antologia.qtd - (antologia.poemas.length - poemas.length) };
}

// O poema que o leitor vê no card: num repost puro, o original.
function poemaVisivel(p: Post): Post {
  return p.repost_de && p.texto === "" ? p.repost_de : p;
}

function ancora(p: Post): string {
  return `poema-${p.id}`;
}

// Como nos livros de poemas: o poema sem título entra no índice pelo primeiro verso.
function primeiroVerso(texto: string): string {
  return textoSemMarcas(texto).split("\n").find((linha) => linha.trim() !== "")?.trim() ?? "";
}

// Antologia com mais poemas que isto é "longa": o índice abre recolhido, para os
// poemas não ficarem lá embaixo; com até tantos, ele abre aberto e nem recolhe.
const POEMAS_NO_INDICE_ABERTO = 8;

// O índice da antologia, na ordem em que os poemas entraram: cada linha leva
// ao poema mais abaixo na página.
function Indice({ poemas }: { poemas: Post[] }) {
  const longa = poemas.length > POEMAS_NO_INDICE_ABERTO;
  const [aberto, setAberto] = useState(!longa);
  const idLista = useId();

  return (
    <nav aria-labelledby="indice-da-antologia" className="border-b border-borda px-4 pt-5 pb-4">
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
            <span className="font-normal text-tinta-suave tabular-nums">{poemas.length} poemas</span>
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
        {poemas.map((p, i) => {
          const poema = poemaVisivel(p);
          return (
            <li key={p.id}>
              <a
                href={`#${ancora(p)}`}
                className="group -mx-2 flex min-h-11 items-baseline gap-3 rounded-lg px-2 py-2 realce"
              >
                <span className="w-5 shrink-0 text-right text-[0.8125rem] text-tinta-suave tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {poema.titulo ? (
                    <span className="block font-serifada font-semibold break-words group-hover:underline">
                      {poema.titulo}
                    </span>
                  ) : (
                    <span className="block truncate font-serifada italic group-hover:underline">
                      {primeiroVerso(poema.texto) || "poema sem título"}
                    </span>
                  )}
                  <span className="block truncate text-[0.8125rem] text-tinta-suave">
                    {poema.autor.name || `@${poema.autor.username}`}
                  </span>
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
      setErro(mensagemDeFalha(e, "não deu para tirar o poema"));
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
