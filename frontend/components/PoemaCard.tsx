"use client";
// Client component: as ações (curtir, repostar) têm estado otimista.

import Link from "next/link";
import { useState } from "react";

import { IconeCitar } from "@/components/icones/IconeCitar";
import { IconeComentar } from "@/components/icones/IconeComentar";
import { IconeCurtir } from "@/components/icones/IconeCurtir";
import { IconeRepostar } from "@/components/icones/IconeRepostar";
import { curtir, formatarData, nomeDaForma, repostar, type Post, type User } from "@/lib/api";

// No feed, poema com mais versos que isto aparece cortado, com link para o inteiro.
// Linhas em branco entre estrofes contam como verso.
const VERSOS_NO_FEED = 20;

type Props = {
  post: Post;
  // Original dentro de uma citação: sem ações, sem "repostado por" e sem aninhar de novo.
  aninhado?: boolean;
  // Na página do próprio poema o título não precisa ser link.
  linkarTitulo?: boolean;
  // Na página do poema ele aparece sempre inteiro; no resto, até VERSOS_NO_FEED.
  inteiro?: boolean;
};

export function PoemaCard({ post, aninhado = false, linkarTitulo = true, inteiro = false }: Props) {
  // Repost puro (texto vazio) fora do feed: mostra o original com o aviso de quem repostou.
  const repostPuro = post.repost_de !== null && post.texto === "";
  const poema = repostPuro && post.repost_de ? post.repost_de : post;
  const reposters = repostPuro ? [post.autor] : (post.repostado_por ?? []);
  const citacao = !repostPuro && (post.repost_de !== null || post.repost_removido);

  return (
    <article
      className={
        aninhado
          ? "rounded-md border border-borda bg-papel p-4"
          : "rounded-lg border border-borda bg-papel-alto p-6"
      }
    >
      {!aninhado && reposters.length > 0 && <RepostadoPor usuarios={reposters} />}

      <Autor autor={poema.autor} criadoEm={poema.created_at} />

      {poema.titulo &&
        (linkarTitulo ? (
          <h2 className="poema-titulo mt-4">
            <Link href={`/poema/${poema.id}`} className="hover:underline">
              {poema.titulo}
            </Link>
          </h2>
        ) : (
          <h1 className="poema-titulo mt-4">{poema.titulo}</h1>
        ))}

      {poema.texto && <Corpo poema={poema} inteiro={inteiro} />}

      {citacao && !aninhado && (
        <div className="mt-4">
          {poema.repost_de ? (
            <PoemaCard post={poema.repost_de} aninhado />
          ) : (
            <p className="rounded-md border border-dashed border-borda p-4 text-sm text-tinta-suave italic">
              poema removido pelo autor
            </p>
          )}
        </div>
      )}

      <Detalhes poema={poema} />

      {!aninhado && <Acoes key={poema.id} poema={poema} />}
    </article>
  );
}

// Corta só a exibição: o texto do poema não muda, e o link leva à versão inteira.
function Corpo({ poema, inteiro }: { poema: Post; inteiro: boolean }) {
  const versos = poema.texto.split("\n");
  const cortar = !inteiro && versos.length > VERSOS_NO_FEED;
  return (
    <>
      <p className="poema-corpo mt-4">
        {cortar ? versos.slice(0, VERSOS_NO_FEED).join("\n") : poema.texto}
      </p>
      {cortar && (
        <Link href={`/poema/${poema.id}`} className="mt-2 inline-block text-sm text-destaque hover:underline">
          ler poema inteiro
        </Link>
      )}
    </>
  );
}

function RepostadoPor({ usuarios }: { usuarios: User[] }) {
  const [a, b] = usuarios;
  const resto = usuarios.length - 2;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-1 text-xs text-tinta-suave">
      <IconeRepostar className="h-3.5 w-3.5" />
      repostado por <NomeLink usuario={a} />
      {b && (resto > 0 ? ", " : " e ")}
      {b && <NomeLink usuario={b} />}
      {resto > 0 && ` e mais ${resto}`}
    </p>
  );
}

function NomeLink({ usuario }: { usuario: User }) {
  return (
    <Link href={`/u/${usuario.username}`} className="hover:underline">
      {usuario.username}
    </Link>
  );
}

function Autor({ autor, criadoEm }: { autor: User; criadoEm: string }) {
  const vida =
    autor.consagrado && autor.morte !== null
      ? autor.nascimento !== null
        ? `${autor.nascimento}–${autor.morte}`
        : `m. ${autor.morte}`
      : null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <Link href={`/u/${autor.username}`} className="font-medium hover:underline">
        {autor.name}
      </Link>
      <span className="text-tinta-suave">@{autor.username}</span>
      {autor.consagrado && (
        <span className="rounded-full border border-destaque px-2 text-xs text-destaque">
          Consagrado
        </span>
      )}
      {vida && <span className="text-xs text-tinta-suave">({vida})</span>}
      {!autor.consagrado && (
        <time dateTime={criadoEm} className="text-xs text-tinta-suave">
          · {formatarData(criadoEm)}
        </time>
      )}
    </div>
  );
}

function Detalhes({ poema }: { poema: Post }) {
  const origem = [poema.obra, poema.ano].filter(Boolean).join(", ");
  if (!poema.forma && !origem && !poema.fonte && poema.tags.length === 0) return null;
  return (
    <div className="mt-4 space-y-1 text-xs text-tinta-suave">
      {(poema.forma || origem || poema.fonte) && (
        <p className="flex flex-wrap gap-x-3">
          {poema.forma && <span className="italic">{nomeDaForma(poema.forma)}</span>}
          {origem && <span>{origem}</span>}
          {poema.fonte && (
            <a href={poema.fonte} target="_blank" rel="noreferrer" className="underline">
              fonte
            </a>
          )}
        </p>
      )}
      {poema.tags.length > 0 && (
        <ul className="flex flex-wrap gap-x-2">
          {poema.tags.map((tag) => (
            <li key={tag}>
              <Link href={`/explorar?tag=${encodeURIComponent(tag)}`} className="hover:text-tinta">
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Curtir e repostar mudam a tela antes da resposta e voltam atrás se o backend falhar.
function Acoes({ poema }: { poema: Post }) {
  const [curti, setCurti] = useState(poema.curti);
  const [curtidas, setCurtidas] = useState(poema.curtidas);
  const [repostei, setRepostei] = useState(poema.repostei);
  const [reposts, setReposts] = useState(poema.reposts);
  const [erro, setErro] = useState<string | null>(null);

  async function alternarCurtida() {
    const novo = !curti;
    setCurti(novo);
    setCurtidas((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await curtir(poema.id, novo);
    } catch (e) {
      setCurti(!novo);
      setCurtidas((n) => n + (novo ? -1 : 1));
      setErro(e instanceof Error ? e.message : "não deu para curtir");
    }
  }

  async function alternarRepost() {
    const novo = !repostei;
    setRepostei(novo);
    setReposts((n) => n + (novo ? 1 : -1));
    setErro(null);
    try {
      await repostar(poema.id, novo);
    } catch (e) {
      setRepostei(!novo);
      setReposts((n) => n + (novo ? -1 : 1));
      setErro(e instanceof Error ? e.message : "não deu para repostar");
    }
  }

  const botao = "inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-tinta";
  return (
    <div className="mt-5 border-t border-borda pt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-tinta-suave">
        <button
          type="button"
          onClick={alternarCurtida}
          aria-pressed={curti}
          className={`${botao} ${curti ? "text-destaque" : ""}`}
        >
          <IconeCurtir cheio={curti} /> curtir · {curtidas}
        </button>
        <button
          type="button"
          onClick={alternarRepost}
          aria-pressed={repostei}
          className={`${botao} ${repostei ? "text-destaque" : ""}`}
        >
          <IconeRepostar /> repostar · {reposts}
        </button>
        <Link href={`/escrever?citar=${poema.id}`} className={botao}>
          <IconeCitar /> citar
        </Link>
        <Link href={`/poema/${poema.id}#comentarios`} className={botao}>
          <IconeComentar /> comentar · {poema.comentarios}
        </Link>
      </div>
      {erro && <p className="mt-2 text-xs text-destaque">{erro}</p>}
    </div>
  );
}
